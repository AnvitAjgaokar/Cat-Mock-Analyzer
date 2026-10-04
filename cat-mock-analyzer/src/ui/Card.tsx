// §5 UI primitives — Card, Stat, Chip
import React from 'react';

// ── Card ──────────────────────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export function Card({ children, className, id }: CardProps) {
  return (
    <div
      id={id}
      className={[
        'bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-sm',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </div>
  );
}

// ── Stat ──────────────────────────────────────────────────────────────────────
interface StatProps {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  className?: string;
}

export function Stat({ label, value, sublabel, className }: StatProps) {
  return (
    <div className={`flex flex-col gap-0.5 ${className ?? ''}`}>
      <span className="text-xs text-zinc-500 uppercase tracking-wide">{label}</span>
      <span className="text-lg font-semibold tabular-nums leading-none">{value}</span>
      {sublabel && <span className="text-xs text-zinc-500">{sublabel}</span>}
    </div>
  );
}

// ── Chip ──────────────────────────────────────────────────────────────────────
interface ChipProps {
  label: string;
  variant?: 'default' | 'success' | 'warn' | 'danger' | 'accent';
  size?: 'sm' | 'xs';
  className?: string;
}

const CHIP_VARIANTS: Record<string, string> = {
  default: 'bg-zinc-700 text-zinc-300',
  success: 'bg-emerald-900/60 text-emerald-300',
  warn:    'bg-amber-900/60 text-amber-300',
  danger:  'bg-rose-900/60 text-rose-300',
  accent:  'bg-accent/20 text-accent',
};

export function Chip({ label, variant = 'default', size = 'sm', className }: ChipProps) {
  const sizeClass = size === 'xs' ? 'px-1.5 py-0 text-xs' : 'px-2 py-0.5 text-xs';
  return (
    <span
      className={[
        'inline-flex items-center rounded-full font-medium',
        sizeClass,
        CHIP_VARIANTS[variant] ?? CHIP_VARIANTS.default,
        className ?? '',
      ].join(' ')}
    >
      {label}
    </span>
  );
}
