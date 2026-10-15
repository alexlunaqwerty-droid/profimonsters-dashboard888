'use client';
import { useEffect, useState } from 'react';
import { formatValue } from '@/analytics/format';
import { getMetric, METRIC_GROUPS, METRICS, UNIT_LABELS } from '@/config/metrics';
import { finalizeRecord, hasErrors, NOTE_MAX, parseNumber, validateDraft, type FieldErrors } from '@/domain/records';
import type { MetricRecord } from '@/domain/types';
import { DuplicateRecordError, type SaveOptions } from '@/data/sources/types';
import { formatDateLong } from '@/filters/period';
import { Button, Field, Icon, inputCls, Modal } from './ui';

interface Props {
  open: boolean;
  onClose: () => void;
  editing: MetricRecord | null;
  defaults: { date: string; metricId: string; project?: string };
  projects: string[];
  findExisting: (id: string) => MetricRecord | undefined;
  onSave: (r: MetricRecord, opts: SaveOptions) => Promise<void>;
}

export function RecordForm({ open, onClose, editing, defaults, projects, findExisting, onSave }: Props) {
  const [date, setDate] = useState('');
  const [project, setProject] = useState('');
  const [metricId, setMetricId] = useState('');
  const [value, setValue] = useState('');
  const [plan, setPlan] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [dup, setDup] = useState<MetricRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDate(editing?.date ?? defaults.date);
    setProject(editing?.project ?? defaults.project ?? '');
    setMetricId(editing?.metricId ?? defaults.metricId);
    setValue(editing ? String(editing.value).replace('.', ',') : '');
    setPlan(editing?.plan !== null && editing?.plan !== undefined ? String(editing.plan).replace('.', ',') : '');
    setNote(editing?.note ?? '');
    setErrors({});
    setDup(null);
    setSubmitError('');
  }, [open, editing, defaults.date, defaults.metricId, defaults.project]);

  const metric = getMetric(metricId);

  const build = () => {
    const v = parseNumber(value);
    const pl = plan.trim() === '' ? null : parseNumber(plan);
    const draft = { date, project, metricId, value: v, plan: pl, note };
    const errs = validateDraft(draft);
    if (plan.trim() !== '' && pl === null) errs.plan = 'Введите число';
    if (value.trim() !== '' && v === null) errs.value = 'Введите число';
    return { errs, record: hasErrors(errs) ? null : finalizeRecord({ date, project, metricId, value: v as number, plan: pl, note, source: editing?.source && editing.source !== 'demo' ? editing.source : 'manual' }) };
  };

  // Предупреждаем о дубликате ещё до сохранения.
  useEffect(() => {
    if (!open || !date || !project.trim() || !metricId) return setDup(null);
    const { record } = build();
    const probeId = record?.id ?? finalizeRecord({ date, project, metricId, value: 0, source: 'manual' }).id;
    const ex = findExisting(probeId);
    setDup(ex && ex.id !== editing?.id ? ex : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date, project, metricId]);

  const submit = async (overwrite: boolean) => {
    const { errs, record } = build();
    setErrors(errs);
    if (!record) return;
    setSaving(true);
    setSubmitError('');
    try {
      await onSave(record, { overwrite, replaceId: editing?.id });
      onClose();
    } catch (e) {
      if (e instanceof DuplicateRecordError) setDup(e.existing);
      else setSubmitError((e as Error).message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Изменить запись' : 'Новая запись'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          {dup ? (
            <Button variant="danger" onClick={() => submit(true)} disabled={saving}>
              Перезаписать
            </Button>
          ) : (
            <Button variant="primary" icon="check" onClick={() => submit(false)} disabled={saving}>
              {saving ? 'Сохраняем…' : 'Сохранить'}
            </Button>
          )}
        </>
      }
    >
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(!!dup);
        }}
        noValidate
      >
        <Field label="Дата" htmlFor="rf-date" error={errors.date} required>
          <input id="rf-date" type="date" className={inputCls + ' tnum'} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Проект" htmlFor="rf-project" error={errors.project} required hint={projects.length ? 'Выберите из списка или введите новый' : 'Введите название проекта'}>
          <input id="rf-project" list="rf-projects" className={inputCls} value={project} onChange={(e) => setProject(e.target.value)} placeholder="Название проекта" autoComplete="off" />
          <datalist id="rf-projects">
            {projects.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Показатель" htmlFor="rf-metric" error={errors.metricId} required hint={metric ? metric.description : undefined}>
            <select id="rf-metric" className={inputCls} value={metricId} onChange={(e) => setMetricId(e.target.value)}>
              <option value="">Выберите показатель</option>
              {Object.entries(METRIC_GROUPS).map(([g, title]) => (
                <optgroup key={g} label={title}>
                  {METRICS.filter((m) => m.group === g).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
        </div>
        <Field label={`Значение${metric ? `, ${UNIT_LABELS[metric.unit]}` : ''}`} htmlFor="rf-value" error={errors.value} required hint={metric?.unit === 'percent' ? 'Числом, например 34,5' : metric && !metric.allowNegative ? 'Не меньше нуля' : undefined}>
          <input id="rf-value" inputMode="decimal" className={inputCls + ' tnum'} value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
        </Field>
        <Field label="План" htmlFor="rf-plan" error={errors.plan} hint="Необязательно">
          <input id="rf-plan" inputMode="decimal" className={inputCls + ' tnum'} value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="—" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Примечание" htmlFor="rf-note" error={errors.note} hint={`${note.length} / ${NOTE_MAX}`}>
            <textarea id="rf-note" rows={2} maxLength={NOTE_MAX} className={inputCls + ' h-auto py-2'} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например: клиент сократил слоты" />
          </Field>
        </div>
        {dup && (
          <div role="alert" className="flex gap-2.5 rounded-xl border border-bad/30 bg-bad-soft p-3 text-[13px] text-ink sm:col-span-2">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-bad" />
            <div>
              <p className="font-semibold">Такая запись уже есть</p>
              <p className="text-ink2">
                {dup.project}, {formatDateLong(dup.date)}: {formatValue(dup.value, getMetric(dup.metricId)!)}
                {dup.note ? ` — «${dup.note}»` : ''}. На одну дату у проекта может быть только одно значение показателя. Сохранить новое значение вместо старого?
              </p>
            </div>
          </div>
        )}
        {submitError && (
          <p role="alert" className="text-[13px] text-bad sm:col-span-2">
            {submitError}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
