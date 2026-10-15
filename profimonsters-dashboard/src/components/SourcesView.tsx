'use client';
import { AGGREGATION_LABELS, METRIC_GROUPS, METRICS, UNIT_LABELS } from '@/config/metrics';
import type { ConnectorInfo } from './DashboardApp';
import { Button, cx, Icon } from './ui';

const DIR = { up: 'Рост — хорошо', down: 'Снижение — хорошо', neutral: 'Не оценивается' };

export function SourcesView({ connectors, activeLabel, onSync, syncing }: { connectors: ConnectorInfo[]; activeLabel: string; onSync?: () => void; syncing?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <section className="panel p-4 sm:p-6">
        <h2 className="font-serif-display text-[28px] font-medium leading-tight">Источники данных</h2>
        <p className="mt-1 max-w-2xl text-[13px] text-ink2">
          Данные хранятся в базе сайта ({activeLabel.toLowerCase()}): вносятся вручную, импортом файла или загружаются из подключённых источников. Внешние источники подключаются отдельным модулем: интерфейс и расчёты при этом не меняются.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Card title="Ручной ввод" text="Форма «Добавить запись», редактирование и удаление в журнале." on />
          <Card title="Импорт CSV и Excel" text="Загрузка файла по шаблону с проверкой строк и защитой от дублей." on />
          {connectors.map((c) => (
            <Card key={c.id} title={c.title} text={c.description} on={c.configured} env={c.env} action={c.id === 'google-sheets' && onSync ? <Button size="sm" variant="primary" icon="refresh" onClick={onSync} disabled={syncing}>{syncing ? 'Загружаем…' : 'Загрузить сейчас'}</Button> : undefined} />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="p-4 sm:p-5">
          <h2 className="font-serif-display text-[28px] font-medium leading-tight">Показатели</h2>
          <p className="mt-1 max-w-2xl text-[13px] text-ink2">
            Список и описания взяты из файла «Данные для Дашборта». Формулы расчёта в нём не заданы, поэтому каждое значение вводится готовым. Единицы, направление оценки и способ свёртки за период можно поменять в одном месте — в каталоге показателей.
          </p>
        </div>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-[13px]">
            <thead className="border-y border-white/[0.06] bg-white/[0.025] text-[12px] text-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Показатель</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Группа</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Ед.</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Оценка</th>
                <th scope="col" className="px-3 py-2.5 font-medium">За период</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Источник</th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => (
                <tr key={m.id} className="border-b border-line align-top last:border-0">
                  <td className="max-w-md px-4 py-2.5">
                    <div className="font-medium">{m.name}</div>
                    <div className="mt-0.5 text-[12px] leading-snug text-muted">{m.description}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-ink2">{METRIC_GROUPS[m.group]}</td>
                  <td className="px-3 py-2.5 text-ink2">{UNIT_LABELS[m.unit]}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-ink2">{DIR[m.direction]}</td>
                  <td className="px-3 py-2.5 text-ink2">{AGGREGATION_LABELS[m.periodAggregation]}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted">{m.source ?? 'не определён'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Card({ title, text, on, env, action }: { title: string; text: string; on: boolean; env?: string[]; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium">
          <Icon name="plug" className="h-4 w-4 text-primary" />
          {title}
        </span>
        <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-semibold', on ? 'bg-accent text-accent-ink' : 'bg-surface2 text-muted')}>{on ? 'Работает' : 'Не подключено'}</span>
      </div>
      <p className="text-[12.5px] text-ink2">{text}</p>
      {env && !on && env.length > 0 && <p className="text-[11.5px] text-muted">Нужна настройка в Netlify: {env.join(', ')}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
