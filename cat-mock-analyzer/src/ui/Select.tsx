// §5 UI primitives — Select
import React from 'react';

interface Option<T extends string = string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string = string> {
  id?: string;
  value: T;
  onChange: (v: T) => void;
  options: Option<T>[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/** Result-colour map: green for Correct, red for Wrong, grey for Skipped. */
const RES_COLOUR: Record<string, string> = {
  C: 'text-emerald-400',
  W: 'text-rose-400',
  S: 'text-zinc-400',
};

export function Select<T extends string = string>({
  id, value, onChange, options, placeholder, className, disabled,
}: SelectProps<T>) {
  const isResult = options.some((o) => ['C', 'W', 'S'].includes(o.value));
  const colourClass = isResult && value ? (RES_COLOUR[value] ?? '') : '';

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      disabled={disabled}
      className={[
        'bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm',
        'focus:outline-none focus:ring-1 focus:ring-accent',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        colourClass,
        className ?? '',
      ].join(' ')}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((o) => (
        <option key={o.value} value={o.value} className={RES_COLOUR[o.value] ?? ''}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export default Select;
