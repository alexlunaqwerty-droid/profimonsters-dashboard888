'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

/* ---------- Иконки (простые линии, 20×20) ---------- */
const paths: Record<string, string> = {
  plus: 'M10 4v12M4 10h12',
  refresh: 'M15.5 7A6 6 0 1 0 16 11M16 3.5V7h-3.5',
  upload: 'M10 13V4M6.5 7.5 10 4l3.5 3.5M4 13v2.5h12V13',
  download: 'M10 4v9M6.5 9.5 10 13l3.5-3.5M4 13v2.5h12V13',
  close: 'M5 5l10 10M15 5 5 15',
  check: 'M4.5 10.5 8 14l7.5-8',
  chevron: 'M6 8l4 4 4-4',
  info: 'M10 9v5M10 6.2v.1M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z',
  edit: 'M4 16h3l8.5-8.5-3-3L4 13v3ZM11 6l3 3',
  trash: 'M4.5 6h11M8 6V4.5h4V6M6 6l.7 10h6.6L14 6',
  up: 'M10 15V5M5.5 9.5 10 5l4.5 4.5',
  down: 'M10 5v10M5.5 10.5 10 15l4.5-4.5',
  flat: 'M4.5 10h11',
  search: 'M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM13.5 13.5 17 17',
  reset: 'M4 10a6 6 0 1 0 2-4.5M4 3.5V7h3.5',
  plug: 'M7 3v4M13 3v4M5.5 7h9v3a4.5 4.5 0 0 1-9 0V7ZM10 14.5V17',
  table: 'M3.5 4.5h13v11h-13zM3.5 8.5h13M3.5 12h13M8 8.5v7',
  chart: 'M3.5 16.5h13M5.5 13l3.5-4 3 2.5 4-5.5',
  alert: 'M10 7.5v4M10 14v.1M8.7 3.6 2.6 14.5A1.5 1.5 0 0 0 3.9 16.7h12.2a1.5 1.5 0 0 0 1.3-2.2L11.3 3.6a1.5 1.5 0 0 0-2.6 0Z',
  filter: 'M3.5 5h13M6 10h8M8.5 15h3',
  eye: 'M2.5 10s2.7-5 7.5-5 7.5 5 7.5 5-2.7 5-7.5 5-7.5-5-7.5-5ZM10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
};

export function Icon({ name, className = 'h-4 w-4', strokeWidth = 1.7 }: { name: keyof typeof paths | string; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

/* ---------- Кнопки ---------- */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger';
export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; icon?: string }) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap';
  const sizes = { sm: 'h-8 px-3 text-[12.5px]', md: 'h-10 px-4 text-[13.5px]' };
  const variants: Record<BtnVariant, string> = {
    primary: 'bg-gradient-to-b from-[#9a7bff] to-[#5b2be0] text-white shadow-[0_8px_28px_-10px_rgba(124,86,255,0.9),inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-110',
    secondary: 'border border-white/10 bg-white/[0.03] text-white/90 backdrop-blur-sm hover:border-white/30 hover:bg-white/[0.06]',
    ghost: 'text-white/70 hover:bg-white/[0.06] hover:text-white',
    accent: 'bg-accent text-accent-ink hover:brightness-105',
    danger: 'bg-bad text-[#2a0508] hover:brightness-105',
  };
  return (
    <button type="button" className={cx(base, sizes[size], variants[variant], className)} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

/* ---------- Модальное окно ---------- */
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'flex max-h-[92vh] w-full flex-col rounded-t-card border border-white/10 bg-[#120b22] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] sm:rounded-card',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg',
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 className="font-serif-display text-[26px] font-medium leading-none">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface2 hover:text-ink" aria-label="Закрыть">
            <Icon name="close" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.06] px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Выпадающая панель ---------- */
export function Popover({ trigger, children, align = 'left', width = 300 }: { trigger: (open: boolean, toggle: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; width?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      {trigger(open, () => setOpen((o) => !o))}
      {open && (
        <div
          className={cx('absolute z-40 mt-2 rounded-2xl border border-white/10 bg-[#140c26]/95 p-2 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.9)] backdrop-blur-xl', align === 'right' ? 'right-0' : 'left-0')}
          style={{ width: `min(${width}px, calc(100vw - 32px))` }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/* ---------- Сегментированный переключатель ---------- */
export function Segmented<T extends string>({ value, options, onChange, size = 'md', label }: { value: T | null; options: { id: T; label: string }[]; onChange: (v: T) => void; size?: 'sm' | 'md'; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-0.5 rounded-full border border-white/[0.07] bg-white/[0.03] p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cx(
            'rounded-full font-medium transition-colors duration-300',
            size === 'sm' ? 'px-3 py-1 text-[12.5px]' : 'px-3.5 py-1.5 text-[13px]',
            value === o.id ? 'bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]' : 'text-white/60 hover:text-white',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Подсказка ---------- */
export function InfoTip({ text, label = 'Пояснение' }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        className="rounded-full p-0.5 text-muted hover:text-primary"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <Icon name="info" className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span role="tooltip" className="absolute left-1/2 top-full z-50 mt-1.5 w-64 -translate-x-1/2 rounded-xl bg-[#f6f4fc] px-3 py-2 text-[12px] font-normal leading-snug text-[#140c26] shadow-[0_16px_40px_-10px_rgba(0,0,0,0.8)]">
          {text}
        </span>
      )}
    </span>
  );
}

/* ---------- Уведомления ---------- */
type Toast = { id: number; kind: 'success' | 'error' | 'info'; text: string };
const ToastCtx = createContext<(kind: Toast['kind'], text: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s.slice(-2), { id, kind, text }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto flex max-w-md items-center gap-2 rounded-full px-5 py-3 text-[13.5px] font-medium shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8)]',
              t.kind === 'success' && 'bg-ink text-surface',
              t.kind === 'error' && 'bg-bad text-[#2a0508]',
              t.kind === 'info' && 'glass-pill border border-white/15 text-white',
            )}
          >
            {t.kind === 'success' && <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-ink"><Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.2} /></span>}
            {t.kind === 'error' && <Icon name="alert" />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

/* ---------- Поле формы ---------- */
export function Field({ label, error, hint, children, htmlFor, required }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor: string; required?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink2">
        {label}
        {required && <span className="text-bad"> *</span>}
      </label>
      {children}
      {error ? <span className="text-[12px] text-bad">{error}</span> : hint ? <span className="text-[12px] text-muted">{hint}</span> : null}
    </div>
  );
}

export const inputCls =
  'h-10 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-ink placeholder:text-white/35 transition-colors focus:border-primary/70 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/20';

/* ---------- Тема (для цветов графика) ---------- */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const read = () => {
      const t = root.getAttribute('data-theme');
      setDark(t === 'dark' || (t !== 'light' && mq.matches));
    };
    read();
    mq.addEventListener('change', read);
    const mo = new MutationObserver(read);
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', read);
      mo.disconnect();
    };
  }, []);
  return dark;
}

export function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const f = () => setM(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [q]);
  return m;
}
