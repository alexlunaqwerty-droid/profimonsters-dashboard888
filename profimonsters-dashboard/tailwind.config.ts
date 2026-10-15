import type { Config } from 'tailwindcss';

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', './artifact/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        surface2: v('surface-2'),
        ink: v('ink'),
        ink2: v('ink-2'),
        muted: v('muted'),
        line: v('line'),
        primary: v('primary'),
        'primary-deep': v('primary-deep'),
        'primary-ink': v('primary-ink'),
        'primary-soft': v('primary-soft'),
        accent: v('accent'),
        'accent-ink': v('accent-ink'),
        good: v('good'),
        bad: v('bad'),
        'good-soft': v('good-soft'),
        'bad-soft': v('bad-soft'),
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Cormorant Garamond', 'Cormorant', 'Georgia', 'serif'],
      },
      borderRadius: { card: '24px' },
      boxShadow: {
        soft: '0 1px 2px rgb(var(--shadow) / 0.06), 0 6px 24px -8px rgb(var(--shadow) / 0.14)',
        pop: '0 12px 40px -12px rgb(var(--shadow) / 0.35)',
      },
    },
  },
  plugins: [],
};
export default config;
