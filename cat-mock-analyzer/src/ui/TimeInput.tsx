// §5 UI primitives — TimeInput
// Pill showing mm:ss. Click → popover with two scroll-snap wheel columns (0-59)
// + quick chips (+30s, +1m, Clear). Also accepts typing "3:25".
// Returns/accepts seconds. Closes on outside-click or Escape.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fmtSecs } from '../calc';

interface TimeInputProps {
  value: number;          // seconds
  onChange: (secs: number) => void;
  id?: string;
  className?: string;
}

function buildItems(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

function WheelCol({
  items, selected, onChange,
}: {
  items: number[];
  selected: number;
  onChange: (v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const itemH = 32;

  // Scroll to selected on mount/change
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = selected * itemH;
    }
  }, [selected]);

  const onScroll = useCallback(() => {
    if (!ref.current) return;
    const idx = Math.round(ref.current.scrollTop / itemH);
    onChange(Math.min(items.length - 1, Math.max(0, idx)));
  }, [items.length, onChange]);

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      className="overflow-y-scroll h-24 w-12 snap-y snap-mandatory scrollbar-none"
      style={{ scrollbarWidth: 'none' }}
    >
      {/* padding sentinels */}
      <div style={{ height: itemH }} />
      {items.map((v) => (
        <div
          key={v}
          onClick={() => onChange(v)}
          className={[
            'h-8 flex items-center justify-center snap-center cursor-pointer select-none text-sm',
            v === selected
              ? 'text-accent font-semibold'
              : 'text-zinc-400 hover:text-white',
          ].join(' ')}
        >
          {String(v).padStart(2, '0')}
        </div>
      ))}
      <div style={{ height: itemH }} />
    </div>
  );
}

export function TimeInput({ value, onChange, id, className }: TimeInputProps) {
  const [open, setOpen] = useState(false);
  const [typedStr, setTypedStr] = useState('');
  const [typing, setTyping] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const mins = Math.floor(value / 60);
  const secs = value % 60;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setTyping(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setTyping(false); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  function commitTyped(str: string) {
    const match = str.match(/^(\d{1,2}):(\d{2})$/) ?? str.match(/^(\d+)$/);
    if (!match) return;
    let total = 0;
    if (match[2] !== undefined) {
      total = parseInt(match[1]) * 60 + parseInt(match[2]);
    } else {
      total = parseInt(match[1]);
    }
    onChange(Math.max(0, total));
    setTyping(false);
    setOpen(false);
  }

  const MINUTES = buildItems(60);
  const SECONDS = buildItems(60);

  return (
    <div ref={rootRef} className={`relative inline-block ${className ?? ''}`}>
      {/* Pill trigger */}
      <button
        id={id}
        type="button"
        onClick={() => { setOpen((o) => !o); setTyping(false); }}
        className={[
          'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-mono tabular-nums',
          'bg-zinc-700 hover:bg-zinc-600 border border-zinc-600',
          'focus:outline-none focus:ring-1 focus:ring-accent',
          value > 0 ? 'text-white' : 'text-zinc-400',
        ].join(' ')}
      >
        {value > 0 ? fmtSecs(value) : '--:--'}
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-3 w-44">
          {typing ? (
            /* Text entry mode */
            <div className="flex flex-col gap-2">
              <input
                autoFocus
                type="text"
                value={typedStr}
                onChange={(e) => setTypedStr(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTyped(typedStr);
                  if (e.key === 'Escape') { setTyping(false); }
                }}
                placeholder="mm:ss"
                className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm font-mono text-center focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => commitTyped(typedStr)}
                  className="flex-1 text-xs bg-accent/80 hover:bg-accent rounded py-1"
                >
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => setTyping(false)}
                  className="flex-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded py-1"
                >
                  ←
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Wheel columns */}
              <div className="flex items-center gap-2 justify-center mb-2">
                <div className="flex flex-col items-center">
                  <span className="text-xs text-zinc-500 mb-1">mm</span>
                  <WheelCol
                    items={MINUTES}
                    selected={mins}
                    onChange={(m) => onChange(m * 60 + secs)}
                  />
                </div>
                <span className="text-zinc-400 text-lg font-bold mb-0">:</span>
                <div className="flex flex-col items-center">
                  <span className="text-xs text-zinc-500 mb-1">ss</span>
                  <WheelCol
                    items={SECONDS}
                    selected={secs}
                    onChange={(s) => onChange(mins * 60 + s)}
                  />
                </div>
              </div>

              {/* Selected display */}
              <div className="text-center text-sm font-mono text-accent mb-2">
                {fmtSecs(value)}
              </div>

              {/* Quick chips */}
              <div className="flex flex-wrap gap-1 justify-center mb-2">
                {[
                  { label: '+30s', delta: 30 },
                  { label: '+1m',  delta: 60 },
                  { label: '+2m',  delta: 120 },
                ].map(({ label, delta }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onChange(Math.max(0, value + delta))}
                    className="text-xs px-2 py-0.5 bg-zinc-700 hover:bg-zinc-600 rounded-full"
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => { onChange(0); setOpen(false); }}
                  className="text-xs px-2 py-0.5 bg-zinc-700 hover:bg-zinc-600 rounded-full text-rose-400"
                >
                  Clear
                </button>
              </div>

              {/* Type link */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setTypedStr(''); setTyping(true); }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 underline"
                >
                  type mm:ss
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default TimeInput;
