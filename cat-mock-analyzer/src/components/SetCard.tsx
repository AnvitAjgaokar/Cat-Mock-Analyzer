// §5 Components — SetCard
// RC passage card / DI/LR set card:
// genre/type, level, Attempted toggle, total time, skip-reason or question rows.
import React, { useState } from 'react';
import type { Set as SetType, Q } from '../types';
import { Card } from '../ui/Card';
import { Select } from '../ui/Select';
import { TimeInput } from '../ui/TimeInput';
import { QRow } from './QRow';
import {
  RC_GENRES, RC_Q_TYPES, DI_TYPES, LR_TYPES, LEVELS,
  SKIP_REASONS_SET, WRONG_REASONS_RC, WRONG_REASONS_DILR,
  SKIP_REASONS_Q,
} from '../data/options';
import { accuracy, attempts, corrects, readingTime, listMarks, fmtSecs } from '../calc';
import { Chip } from '../ui/Card';

const LEVEL_OPTIONS = [
  { value: '',  label: '—' },
  ...LEVELS.map((l) => ({ value: l.value, label: l.label })),
];

const Q_COUNT_OPTIONS = [3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }));

interface SetCardProps {
  set: SetType;
  onChange: (updated: SetType) => void;
  onDelete?: () => void;
  index: number;
  marking?: { correct: number; wrong: number; skip: number };
  showValidation?: boolean;
}

function makeQs(count: number, existing: Q[], kind: SetType['kind']): Q[] {
  const fmt = kind === 'RC' ? 'MCQ' : 'MCQ';
  return Array.from({ length: count }, (_, i) => existing[i] ?? { res: '', fmt });
}

export function SetCard({ set, onChange, onDelete, index, marking, showValidation = false }: SetCardProps) {
  const [collapsed, setCollapsed] = useState(false);

  const typeOptions =
    set.kind === 'RC'
      ? RC_GENRES.map((g) => ({ value: g, label: g }))
      : set.kind === 'DI'
      ? DI_TYPES.map((t) => ({ value: t, label: t }))
      : LR_TYPES.map((t) => ({ value: t, label: t }));

  const wrongReasons = set.kind === 'RC' ? WRONG_REASONS_RC : WRONG_REASONS_DILR;

  function update<K extends keyof SetType>(key: K, value: SetType[K]) {
    onChange({ ...set, [key]: value });
  }

  function updateQ(i: number, q: Q) {
    const qs = [...set.qs];
    qs[i] = q;
    onChange({ ...set, qs });
  }

  function updateQCount(n: number) {
    onChange({ ...set, qs: makeQs(n, set.qs, set.kind) });
  }

  const acc = set.attempted ? accuracy(set.qs) : 0;
  const att = set.attempted ? attempts(set.qs) : 0;
  const cor = set.attempted ? corrects(set.qs) : 0;
  const marks = set.attempted ? listMarks(set.qs, marking) : 0;
  const readT = set.attempted ? readingTime(set) : 0;

  const kindLabel =
    set.kind === 'RC' ? `Passage ${index}` :
    set.kind === 'DI' ? `DI Set ${index}` :
    `LR Set ${index}`;

  return (
    <Card className="mb-3">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className="text-xs font-semibold text-zinc-400 w-16 flex-shrink-0">{kindLabel}</span>

        {/* Type */}
        <Select
          value={set.type}
          onChange={(v) => update('type', v)}
          options={typeOptions}
          placeholder="type…"
          className="flex-1 min-w-28"
        />

        {/* Level */}
        <Select
          value={set.lvl ?? ''}
          onChange={(v) => update('lvl', v || undefined)}
          options={LEVEL_OPTIONS}
          className="w-24"
        />

        {/* Q count (DILR only) */}
        {set.kind !== 'RC' && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-500">Qs</span>
            <Select
              value={String(set.qs.length || 4)}
              onChange={(v) => updateQCount(Number(v))}
              options={Q_COUNT_OPTIONS}
              className="w-14"
            />
          </div>
        )}

        {/* Attempted toggle */}
        <label className="flex items-center gap-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={set.attempted}
            onChange={(e) => update('attempted', e.target.checked)}
            className="accent-accent w-4 h-4"
          />
          <span className="text-xs">Attempted</span>
        </label>

        {/* Total time */}
        <TimeInput value={set.t} onChange={(s) => update('t', s)} />

        {/* Stats pills */}
        {set.attempted && (
          <div className="flex gap-1 ml-auto">
            <Chip label={`${cor}/${att}`} variant="default" size="xs" />
            <Chip label={`${Math.round(acc * 100)}%`} variant={acc >= 0.7 ? 'success' : acc >= 0.4 ? 'warn' : 'danger'} size="xs" />
            <Chip label={`${marks > 0 ? '+' : ''}${marks}`} variant={marks > 0 ? 'success' : marks < 0 ? 'danger' : 'default'} size="xs" />
          </div>
        )}

        {/* Delete & collapse */}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            {collapsed ? '▸' : '▾'}
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="text-xs text-rose-500 hover:text-rose-300"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <>
          {!set.attempted ? (
            /* Skip reason */
            <div className="flex items-center gap-2 pl-2">
              <span className="text-xs text-zinc-500">Skip reason</span>
              <Select
                value={set.skipReason ?? ''}
                onChange={(v) => update('skipReason', v)}
                options={[
                  { value: '', label: '—' },
                  ...SKIP_REASONS_SET.map((r) => ({ value: r.value, label: r.label })),
                ]}
                placeholder="skip reason…"
                className="flex-1"
              />
            </div>
          ) : (
            /* Question rows */
            <div className="flex flex-col gap-1">
              {set.qs.map((q, i) => (
                <QRow
                  key={i}
                  index={i + 1}
                  q={q}
                  onChange={(updated) => updateQ(i, updated)}
                  wrongReasons={wrongReasons}
                  skipReasons={SKIP_REASONS_Q}
                  showQType={set.kind === 'RC'}
                  qtypeOptions={RC_Q_TYPES}
                  lockedFmt={set.kind === 'RC' ? 'MCQ' : undefined}
                  showValidation={showValidation}
                />
              ))}

              {/* Reading/setup time (RC only) */}
              {set.kind === 'RC' && set.t > 0 && (
                <div className={`text-xs pl-7 mt-1 ${readT < 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
                  Reading/setup: {fmtSecs(readT)}
                  {readT < 0 && ' ⚠ negative'}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export default SetCard;
