// §5 UI primitives — NumInput (stepper for score/percentile/rank)
import React from 'react';

interface NumInputProps {
  id?: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  placeholder?: string;
  className?: string;
}

export function NumInput({
  id, value, onChange, min, max, step = 1, decimals = 0, placeholder, className,
}: NumInputProps) {
  function clamp(v: number) {
    if (min !== undefined && v < min) return min;
    if (max !== undefined && v > max) return max;
    return v;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw === '' || raw === '-') { onChange(undefined); return; }
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) onChange(clamp(parsed));
  }

  function step_(delta: number) {
    const cur = value ?? 0;
    onChange(clamp(parseFloat((cur + delta).toFixed(decimals))));
  }

  return (
    <div className={`inline-flex items-center border border-zinc-700 rounded overflow-hidden ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => step_(-step)}
        className="px-1.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-sm select-none"
        aria-label="Decrement"
      >
        −
      </button>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={value !== undefined ? value : ''}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        className="w-16 text-center bg-zinc-800 text-sm py-1 focus:outline-none tabular-nums [appearance:textfield]"
      />
      <button
        type="button"
        onClick={() => step_(step)}
        className="px-1.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-sm select-none"
        aria-label="Increment"
      >
        +
      </button>
    </div>
  );
}

export default NumInput;
