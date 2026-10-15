import type { MetricDefinition, MetricGroup, MetricUnit } from '@/domain/types';

/**
 * Каталог показателей Profimonsters.
 * Названия и описания — из файла «Данные для Дашборта.xlsx».
 * Колонка «Откуда тянем» в файле пустая, поэтому source = null у всех метрик.
 *
 * Формулы расчёта (например, как именно считать текучку или конверсию) в файле не заданы,
 * поэтому дашборд НЕ вычисляет одни метрики из других: каждое значение вводится готовым.
 * Единицы, направление и способ свёртки ниже — рабочие допущения, их можно поменять здесь,
 * не трогая интерфейс и расчёты.
 */
export const METRICS: MetricDefinition[] = [
  {
    id: 'shift_1',
    name: '1 смена',
    shortName: '1 смена',
    description:
      'Сколько исполнителей вышли на первую смену. Вместе с 3-й и 5-й сменой показывает работу координаторов с исполнителями по статусам в AMO, «жизнь» исполнителя и текучесть — помогает оценивать каждого координатора и находить проблемные зоны.',
    unit: 'people',
    direction: 'up',
    periodAggregation: 'sum',
    projectAggregation: 'sum',
    allowNegative: false,
    source: null,
    group: 'staff',
  },
  {
    id: 'shift_3',
    name: '3 смена',
    shortName: '3 смена',
    description:
      'Сколько исполнителей дошли до третьей смены. Показывает, удерживаются ли исполнители после первых выходов; часть общего контроля работы координаторов в AMO.',
    unit: 'people',
    direction: 'up',
    periodAggregation: 'sum',
    projectAggregation: 'sum',
    allowNegative: false,
    source: null,
    group: 'staff',
  },
  {
    id: 'shift_5',
    name: '5 смена',
    shortName: '5 смена',
    description:
      'Сколько исполнителей дошли до пятой смены. Показывает закрепление исполнителя в проекте; часть общего контроля работы координаторов в AMO.',
    unit: 'people',
    direction: 'up',
    periodAggregation: 'sum',
    projectAggregation: 'sum',
    allowNegative: false,
    source: null,
    group: 'staff',
  },
  {
    id: 'avg_daily_turnout',
    name: 'Среднедневной выход',
    shortName: 'Ср. дневной выход',
    description:
      'Фактическая явка исполнителей на смены в среднем за день. При снижении — адресный прозвон исполнителей, которые не выходят на работу.',
    unit: 'people',
    direction: 'up',
    periodAggregation: 'avg',
    projectAggregation: 'sum',
    allowNegative: false,
    source: null,
    group: 'staff',
  },
  {
    id: 'dismissals',
    name: 'Увольнения',
    shortName: 'Увольнения',
    description:
      'Число увольнений. Нужно для актуального штата в AMO и личных кабинетах, работы с текучестью и контроля оттока. Важно, чтобы координаторы отрабатывали показатель в AMO по регламенту.',
    unit: 'people',
    direction: 'down',
    periodAggregation: 'sum',
    projectAggregation: 'sum',
    allowNegative: false,
    source: null,
    group: 'staff',
  },
  {
    id: 'active_staff',
    name: 'Активный штат',
    shortName: 'Активный штат',
    description:
      'Число активных исполнителей. Помогает контролировать отток, видеть длительные невыходы и удерживать стабильный состав команды.',
    unit: 'people',
    direction: 'up',
    periodAggregation: 'last',
    projectAggregation: 'sum',
    allowNegative: false,
    source: null,
    group: 'staff',
  },
  {
    id: 'turnover',
    name: 'Текучка',
    shortName: 'Текучка',
    description:
      'Уровень текучести исполнителей. Помогает быстро реагировать на отток, выяснять причины увольнений и вовремя предлагать переход на другой проект. Формула в исходных данных не задана — значение вводится готовым.',
    unit: 'percent',
    direction: 'down',
    periodAggregation: 'avg',
    projectAggregation: 'avg',
    allowNegative: false,
    max: 100,
    source: null,
    group: 'staff',
  },
  {
    id: 'newbie_life',
    name: 'Жизнь новичка',
    shortName: 'Жизнь новичка',
    description:
      'Как долго новые исполнители остаются в проекте. По этим данным проводится NPS-опрос новичков, чтобы получать обратную связь и улучшать работу с ними.',
    unit: 'days',
    direction: 'up',
    periodAggregation: 'avg',
    projectAggregation: 'avg',
    allowNegative: false,
    source: null,
    group: 'staff',
  },
  {
    id: 'leads',
    name: 'Количество лидов',
    shortName: 'Лиды',
    description:
      'Сколько лидов пришло. Показывает эффективность маркетинговых каналов и изменения спроса; определяет нагрузку на колл-центр и проектную команду.',
    unit: 'count',
    direction: 'up',
    periodAggregation: 'sum',
    projectAggregation: 'sum',
    allowNegative: false,
    source: null,
    group: 'funnel',
  },
  {
    id: 'conv_lead_to_internship',
    name: 'Конверсия из лида в оформленного и назначенного на стаж',
    shortName: 'Лид → стаж',
    description:
      'Доля лидов, которые оформлены и назначены на стажировку. Показывает, как колл-центр обрабатывает заявки и насколько целевой трафик даёт маркетинг.',
    unit: 'percent',
    direction: 'up',
    periodAggregation: 'avg',
    projectAggregation: 'avg',
    allowNegative: false,
    max: 100,
    source: null,
    group: 'funnel',
  },
  {
    id: 'conv_internship_to_shift_1',
    name: 'Конверсия из оформленного и назначенного на стаж в 1 смену',
    shortName: 'Стаж → 1 смена',
    description:
      'Доля оформленных и назначенных на стаж, которые фактически вышли на первую смену. Показывает результативность проекта после оформления.',
    unit: 'percent',
    direction: 'up',
    periodAggregation: 'avg',
    projectAggregation: 'avg',
    allowNegative: false,
    max: 100,
    source: null,
    group: 'funnel',
  },
  {
    id: 'first_shift_cost',
    name: 'Стоимость первой смены',
    shortName: 'Стоимость 1 смены',
    description:
      'Сколько стоит привести исполнителя на первую смену. При росте — пауза в рекламе и работа над конверсией КЦ и проекта; при снижении — усиление найма и маркетинга.',
    unit: 'rub',
    direction: 'down',
    periodAggregation: 'avg',
    projectAggregation: 'avg',
    allowNegative: false,
    source: null,
    group: 'funnel',
  },
  {
    id: 'demand',
    name: 'Потребность',
    shortName: 'Потребность',
    description:
      'Потребность клиента в исполнителях. Нужна для прогноза нагрузки и планирования маркетинга и колл-центра. Рост или снижение не оцениваются как хорошо или плохо.',
    unit: 'people',
    direction: 'neutral',
    periodAggregation: 'last',
    projectAggregation: 'sum',
    allowNegative: false,
    source: null,
    group: 'funnel',
  },
  {
    id: 'revenue_total',
    name: 'Выручка Тотал',
    shortName: 'Выручка',
    description:
      'Оборот проекта. Если выходящих исполнителей больше, а выручка падает — слоты распределяются неравномерно или в урезанном формате: нужно связаться с клиентом, чтобы не терять маржинальность.',
    unit: 'rub',
    direction: 'up',
    periodAggregation: 'sum',
    projectAggregation: 'sum',
    allowNegative: false,
    source: null,
    group: 'finance',
  },
  {
    id: 'coefficient_sum',
    name: 'Коэффициент (Сумма)',
    shortName: 'Коэффициент',
    description:
      'Сколько заработал проект и какой бюджет можно направить на ФОТ команды проекта, маркетинг и колл-центр.',
    unit: 'rub',
    direction: 'up',
    periodAggregation: 'sum',
    projectAggregation: 'sum',
    allowNegative: true,
    source: null,
    group: 'finance',
  },
  {
    id: 'receivables',
    name: 'Дебиторка',
    shortName: 'Дебиторка',
    description:
      'Дебиторская задолженность клиентов. Контроль своевременности расчётов, реального финансового состояния проекта, кассовых разрывов и просрочки.',
    unit: 'rub',
    direction: 'down',
    periodAggregation: 'last',
    projectAggregation: 'sum',
    allowNegative: false,
    source: null,
    group: 'finance',
  },
  {
    id: 'nps',
    name: 'NPS',
    shortName: 'NPS',
    description:
      'Индекс лояльности. Помогает поддерживать уровень сервиса, понимать ситуацию на стороне клиента и быстро реагировать на изменения в восприятии сервиса.',
    unit: 'points',
    direction: 'up',
    periodAggregation: 'avg',
    projectAggregation: 'avg',
    allowNegative: true,
    max: 100,
    source: null,
    group: 'quality',
  },
];

export const METRIC_GROUPS: Record<MetricGroup, string> = {
  staff: 'Исполнители',
  funnel: 'Найм и воронка',
  finance: 'Финансы',
  quality: 'Качество',
};

export const UNIT_LABELS: Record<MetricUnit, string> = {
  people: 'чел.',
  count: 'шт.',
  percent: '%',
  rub: '₽',
  days: 'дн.',
  points: 'балл.',
};

export const AGGREGATION_LABELS = {
  sum: 'сумма за период',
  avg: 'среднее за период',
  last: 'последнее значение периода',
} as const;

const byId = new Map(METRICS.map((m) => [m.id, m]));

export function getMetric(id: string): MetricDefinition | undefined {
  return byId.get(id);
}

/** Ищет показатель по id или названию (для импорта): без учёта регистра, пробелов и опечаток в пробелах. */
export function findMetricByName(raw: string): MetricDefinition | undefined {
  const norm = normalizeName(raw);
  if (!norm) return undefined;
  return METRICS.find(
    (m) => m.id === raw.trim() || normalizeName(m.name) === norm || normalizeName(m.shortName) === norm || ALIASES[norm] === m.id,
  );
}

export function normalizeName(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Написания из исходного файла и частые варианты. */
const ALIASES: Record<string, string> = {
  'средне дневной выход': 'avg_daily_turnout',
  'среднедневной выход': 'avg_daily_turnout',
  'выручка тотал': 'revenue_total',
  выручка: 'revenue_total',
  'коэффициент сумма': 'coefficient_sum',
  коэффициент: 'coefficient_sum',
  'конверсия из лида в оформленного и назначен на стаж': 'conv_lead_to_internship',
  'конверсия из оформелного и назначенного на стаж в 1 смену': 'conv_internship_to_shift_1',
  'конверсия из оформленного и назначенного на стаж в 1 смену': 'conv_internship_to_shift_1',
  'активный штат': 'active_staff',
  текучесть: 'turnover',
  дебиторская: 'receivables',
  'дебиторская задолженность': 'receivables',
  лиды: 'leads',
  'первая смена': 'shift_1',
  'третья смена': 'shift_3',
  'пятая смена': 'shift_5',
};
