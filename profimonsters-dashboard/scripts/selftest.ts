/* Проверка расчётов: npm test */
import assert from 'node:assert/strict';
import { buildIndex, buildSeries, compare, metricSummary, projectTable } from '../src/analytics';
import { getMetric } from '../src/config/metrics';
import { buildPreview } from '../src/data/import/importer';
import { MemorySource } from '../src/data/sources/memorySource';
import { DuplicateRecordError } from '../src/data/sources/types';
import { finalizeRecord, parseNumber, recordId, validateDraft } from '../src/domain/records';
import { comparisonRange, previousRange, quickRange } from '../src/filters/period';

const R = (date: string, project: string, metricId: string, value: number, plan: number | null = null) =>
  finalizeRecord({ date, project, metricId, value, plan, source: 'test' });

// Периоды
assert.deepEqual(previousRange({ from: '2026-10-08', to: '2026-10-14' }), { from: '2026-10-01', to: '2026-10-07' });
assert.deepEqual(quickRange('prev_month', '2026-10-14'), { from: '2026-09-01', to: '2026-09-30' });
assert.deepEqual(comparisonRange(quickRange('month', '2026-10-14'), '2026-10-14'), { from: '2026-09-01', to: '2026-09-14' });
assert.deepEqual(comparisonRange(quickRange('prev_month', '2026-10-14'), '2026-10-14'), { from: '2026-08-01', to: '2026-08-31' });

// Ключ уникальности не зависит от регистра и пробелов в названии проекта
assert.equal(recordId('2026-10-01', 'Альфа ', 'leads'), recordId('2026-10-01', ' альфа', 'leads'));
assert.notEqual(recordId('2026-10-01', 'Альфа', 'leads'), recordId('2026-10-02', 'Альфа', 'leads'));

// Числа
assert.equal(parseNumber('1 234,5'), 1234.5);
assert.equal(parseNumber('34,5%'), 34.5);
assert.equal(parseNumber('12 000 ₽'), 12000);
assert.equal(parseNumber(''), null);

// Проверки
assert.ok(validateDraft({ date: '2026-10-01', project: 'А', metricId: 'leads', value: -1 }).value);
assert.ok(!validateDraft({ date: '2026-10-01', project: 'А', metricId: 'nps', value: -20 }).value);
assert.ok(validateDraft({ date: '2026-10-01', project: 'А', metricId: 'turnover', value: 120 }).value);
assert.ok(validateDraft({ date: '2026-02-30', project: 'А', metricId: 'leads', value: 1 }).date);

// Свёртка и сравнение
const recs = [
  R('2026-10-01', 'А', 'leads', 10, 12),
  R('2026-10-02', 'А', 'leads', 20, 12),
  R('2026-09-30', 'А', 'leads', 15),
  R('2026-09-29', 'А', 'leads', 5),
  R('2026-10-01', 'Б', 'leads', 31),
  R('2026-09-30', 'Б', 'leads', 40),
  R('2026-10-01', 'А', 'dismissals', 2),
  R('2026-09-30', 'А', 'dismissals', 4),
  R('2026-10-01', 'А', 'active_staff', 100),
  R('2026-10-02', 'А', 'active_staff', 110),
  R('2026-10-01', 'А', 'turnover', 4),
  R('2026-10-02', 'А', 'turnover', 6),
];
const idx = buildIndex(recs);
const cur = { from: '2026-10-01', to: '2026-10-02' };
const prev = { from: '2026-09-29', to: '2026-09-30' };

const leads = metricSummary(idx, 'leads', ['А', 'Б'], cur, prev)!;
assert.equal(leads.change.current, 61); // 10+20+31
assert.equal(leads.change.previous, 60); // 15+5+40
assert.equal(leads.change.trend, 'up');
assert.equal(leads.best?.project, 'Б');
assert.equal(leads.worst?.project, 'Б'); // 40 → 31
assert.equal(leads.plan?.fact, 30);
assert.equal(leads.plan?.plan, 24);

const dis = metricSummary(idx, 'dismissals', ['А'], cur, prev)!;
assert.equal(dis.change.trend, 'down');
assert.equal(dis.change.verdict, 'good'); // увольнений меньше — хорошо

const staff = metricSummary(idx, 'active_staff', ['А'], cur, prev)!;
assert.equal(staff.change.current, 110); // последнее значение периода
assert.equal(staff.change.previous, null);
assert.equal(staff.change.verdict, 'none');

const turnover = metricSummary(idx, 'turnover', ['А'], cur, prev)!;
assert.equal(turnover.change.current, 5); // среднее

const rows = projectTable(idx, getMetric('leads')!, ['А', 'Б'], cur, prev);
assert.equal(rows[0].project, 'Б');
assert.equal(rows[0].rank, 1);
assert.equal(rows[1].change.pct, 50);

assert.equal(compare(5, 0, getMetric('leads')!).pct, null);

// Пропуски не превращаются в нули
const s = buildSeries(idx, getMetric('leads')!, ['А', 'Б'], cur, 'day');
assert.equal(s.points[1]['Б'], null);
assert.equal(s.missing, 1);

// Дубли в источнике
(async () => {
  const src = new MemorySource('demo', 'test', true, recs);
  await assert.rejects(src.save(R('2026-10-01', 'а', 'leads', 99), { overwrite: false }), DuplicateRecordError);
  await src.save(R('2026-10-01', 'а', 'leads', 99), { overwrite: true });
  assert.equal((await src.load()).length, recs.length);

  // Импорт
  const preview = buildPreview(
    [
      ['Дата', 'Проект', 'Показатель', 'Значение', 'План', 'Примечание'],
      ['01.10.2026', 'А', 'Количество лидов ', '12', '', ''],
      ['01.10.2026', 'А', 'Количество лидов', '13', '', 'повтор'],
      ['2026-10-02', 'А', 'Средне дневной выход ', '7', '', ''],
      ['2026-10-02', 'А', 'Неизвестно', '7', '', ''],
      ['2026-10-02', 'А', 'Увольнения', '-1', '', ''],
    ],
    'csv',
    new Set([recordId('2026-10-01', 'А', 'leads')]),
  );
  assert.equal(preview.records.length, 2);
  assert.equal(preview.duplicatesInFile, 1);
  assert.equal(preview.issues.length, 2);
  assert.equal(preview.existing, 1);
  console.log('Все проверки пройдены');
})();
