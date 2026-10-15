// §5 Components — QRow
// One line per question: # · Result · Reason (W/S only) · Time · more▾
// "more" expands to show Fmt, Level, Q-type.
// Row tint follows result. Tab order flows left→right, then next row.
import React, { useState } from 'react';
import type { Q, Res, Fmt, Lvl } from '../types';
import { Select } from '../ui/Select';
import { TimeInput } from '../ui/TimeInput';
import {
  WRONG_REASONS_COMMON, SKIP_REASONS_Q, LEVELS,
} from '../data/options';

const RES_OPTIONS = [
  { value: '',  label: '—' },
  { value: 'C', label: 'Correct' },
  { value: 'W', label: 'Wrong' },
  { value: 'S', label: 'Skipped' },
] as const;

const FMT_OPTIONS = [
  { value: 'MCQ',  label: 'MCQ' },
  { value: 'TITA', label: 'TITA' },
];

const LEVEL_OPTIONS = [
  { value: '',  label: '—' },
  ...LEVELS.map((l) => ({ value: l.value, label: l.label })),
];

const ROW_TINT: Record<string, string> = {
  C: 'bg-emerald-950/30 border-l-2 border-emerald-700',
  W: 'bg-rose-950/30 border-l-2 border-rose-700',
  S: 'bg-zinc-800/30 border-l-2 border-zinc-600',
  '': '',
};

interface QRowProps {
  index: number;                // 1-based display number
  q: Q;
  onChange: (updated: Q) => void;
  // Optional: provide specific reason lists (RC, VA, DILR; defaults to common)
  wrongReasons?: typeof WRONG_REASONS_COMMON;
  skipReasons?: typeof SKIP_REASONS_Q;
  // Optional: extra fields displayed in main row (e.g. subject/topic for QA)
  extra?: React.ReactNode;
  qtype?: string;
  qtypeOptions?: string[];
  showQType?: boolean;
  lockedFmt?: 'MCQ' | 'TITA';
  showValidation?: boolean;
}

export function QRow({
  index, q, onChange, wrongReasons = WRONG_REASONS_COMMON,
  skipReasons = SKIP_REASONS_Q, extra, qtypeOptions, showQType = false,
  lockedFmt, showValidation = false,
}: QRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  function markTouched(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function set<K extends keyof Q>(key: K, value: Q[K]) {
    const next = { ...q, [key]: value };
    // Reset reason when result changes to C or cleared
    if (key === 'res' && (value === 'C' || value === '')) {
      next.reason = undefined;
      next.reasonOther = undefined;
    }
    // Prefill time with 0 when result is set (so time pill activates for all result types)
    if (key === 'res' && (value === 'C' || value === 'W' || value === 'S') && next.t === undefined) {
      next.t = 0;
    }
    onChange(next);
  }

  const reasonOptions =
    q.res === 'W'
      ? [...wrongReasons.map((r) => ({ value: r.value, label: r.label }))]
      : q.res === 'S'
      ? [...skipReasons.map((r) => ({ value: r.value, label: r.label }))]
      : [];

  const resError = (showValidation || touched.res) && !q.res;
  // Time is required whenever a result has been chosen
  const timeError = q.res && (showValidation || touched.t) && q.t === undefined;
  const reasonError = (showValidation || touched.reason) && (q.res === 'W' || q.res === 'S') && !q.reason;

  return (
    <div
      className={[
        'rounded px-2 py-1.5 flex flex-col gap-1 transition-colors cursor-pointer',
        ROW_TINT[q.res] ?? '',
      ].join(' ')}
      onClick={() => setExpanded(true)}
      onFocus={() => setExpanded(true)}
    >
      {/* Main row */}
      <div className="flex items-end gap-2 flex-wrap">
        {/* # */}
        <span className="w-5 text-xs text-zinc-500 text-right tabular-nums flex-shrink-0 pb-1.5">
          {index}
        </span>

        {/* Extra fields (e.g. subject/topic for QA) */}
        {extra && <div className="pb-0" onClick={(e) => e.stopPropagation()}>{extra}</div>}

        {/* Result */}
        <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
          <label className="text-[10px] text-zinc-500 font-medium">Result</label>
          <div className="relative">
            <Select<Res>
              value={q.res}
              onChange={(v) => { set('res', v); markTouched('res'); }}
              options={RES_OPTIONS as unknown as { value: Res; label: string }[]}
              className={`w-24 ${resError ? 'border-rose-500' : ''}`}
              placeholder="Select"
            />
            {resError && <span className="absolute -top-3 right-0 text-[9px] text-rose-500">Required</span>}
          </div>
        </div>

        {/* Reason — only when W or S */}
        {(q.res === 'W' || q.res === 'S') && (
          <div className="flex flex-col gap-0.5 flex-1 min-w-28" onClick={(e) => e.stopPropagation()}>
            <label className="text-[10px] text-zinc-500 font-medium">Reason</label>
            <div className="relative">
              <Select
                value={q.reason ?? ''}
                onChange={(v) => { set('reason', v); markTouched('reason'); }}
                options={reasonOptions}
                placeholder="Reason"
                className={`w-full ${reasonError ? 'border-rose-500' : ''}`}
              />
              {reasonError && <span className="absolute -top-3 right-0 text-[9px] text-rose-500">Required</span>}
            </div>
          </div>
        )}

        {/* reasonOther text input */}
        {q.reason === 'other' && (
          <div className="flex flex-col gap-0.5 flex-1 min-w-24" onClick={(e) => e.stopPropagation()}>
            <label className="text-[10px] text-zinc-500 font-medium">Describe</label>
            <input
              type="text"
              value={q.reasonOther ?? ''}
              onChange={(e) => set('reasonOther', e.target.value)}
              placeholder="describe…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-[5px] text-xs focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        )}

        {/* Time */}
        <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
          <label className="text-[10px] text-zinc-500 font-medium">Time (mm:ss)</label>
          <div className="relative">
            <div onBlur={() => markTouched('t')} className="h-full">
              <TimeInput
                value={q.t ?? 0}
                onChange={(s) => set('t', s)}
                className={timeError ? 'border-rose-500' : ''}
              />
            </div>
            {timeError && <span className="absolute -top-3 right-0 text-[9px] text-rose-500">Required</span>}
          </div>
        </div>

        {/* More ▾ toggle */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded((e) => !e); }}
          className="text-xs text-zinc-500 hover:text-zinc-300 ml-auto pb-1.5"
          aria-label="Toggle more fields"
        >
          {expanded ? 'less ▴' : 'more ▾'}
        </button>
      </div>

      {/* Expanded row */}
      {expanded && (
        <div className="flex items-center gap-2 flex-wrap pl-7" onClick={(e) => e.stopPropagation()}>
          <label className="text-xs text-zinc-500">Fmt</label>
          {lockedFmt ? (
            <span className="text-xs font-mono bg-zinc-800 px-2 py-1 rounded text-zinc-300">
              {lockedFmt}
            </span>
          ) : (
            <Select<Fmt>
              value={q.fmt}
              onChange={(v) => set('fmt', v)}
              options={FMT_OPTIONS as { value: Fmt; label: string }[]}
              className="w-20"
            />
          )}
          <label className="text-xs text-zinc-500">Level</label>
          <Select<Lvl>
            value={q.lvl ?? ''}
            onChange={(v) => set('lvl', v)}
            options={LEVEL_OPTIONS as { value: Lvl; label: string }[]}
            className="w-24"
          />
          {showQType && qtypeOptions && (
            <>
              <label className="text-xs text-zinc-500">Type</label>
              <Select
                value={q.qtype ?? ''}
                onChange={(v) => set('qtype', v)}
                options={[
                  { value: '', label: '—' },
                  ...qtypeOptions.map((t) => ({ value: t, label: t })),
                ]}
                className="w-40"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default QRow;
