/**
 * Цвета линий проектов. Восемь проверенных на различимость (в т.ч. при дальтонизме) цветов
 * в фиксированном порядке. Цвет закрепляется за проектом по его месту в общем списке,
 * поэтому не «перекрашивается» при фильтрации. Проекты 9–16 и далее получают тот же цвет
 * с другим типом линии — второй признак, чтобы линии не путались.
 */
const LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
const DASHES = [undefined, '7 4', '2 3', '10 3 2 3'];

export interface SeriesStyle {
  color: string;
  dash?: string;
}

export function seriesStyle(indexInAllProjects: number, dark: boolean): SeriesStyle {
  const pal = dark ? DARK : LIGHT;
  const i = Math.max(0, indexInAllProjects);
  return { color: pal[i % pal.length], dash: DASHES[Math.floor(i / pal.length) % DASHES.length] };
}

export function chartChrome(dark: boolean) {
  return dark
    ? { grid: 'rgba(255,255,255,0.06)', axis: 'rgba(255,255,255,0.14)', tick: 'rgba(230,224,255,0.5)', ink: '#f6f4fc', surface: '#120b22', plan: '#bef254' }
    : { grid: '#ebe8f2', axis: '#d6d2e2', tick: '#807a94', ink: '#1b1530', surface: '#ffffff', plan: '#5b8a00' };
}
