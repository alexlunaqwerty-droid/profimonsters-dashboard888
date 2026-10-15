-- Схема для переноса хранилища в PostgreSQL (вместо data/records.json).
-- Уникальный индекс по (date, project, metric_id) — защита от дублей на уровне базы.
CREATE TABLE IF NOT EXISTS metric_records (
  id          TEXT PRIMARY KEY,           -- детерминированный id из ключа
  date        DATE        NOT NULL,
  project     TEXT        NOT NULL,
  metric_id   TEXT        NOT NULL,
  value       NUMERIC     NOT NULL,
  plan        NUMERIC,
  note        VARCHAR(300),
  source      TEXT        NOT NULL DEFAULT 'manual',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS metric_records_key ON metric_records (date, lower(project), metric_id);
CREATE INDEX IF NOT EXISTS metric_records_metric_date ON metric_records (metric_id, date);
