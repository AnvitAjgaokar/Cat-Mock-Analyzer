// §5 Components — StickyBar
// Always-visible bottom bar: section time mm:ss / limit, attempts, accuracy,
// calculated marks, save status.
import React from 'react';
import { fmtSecs } from '../calc';

interface SectionSummary {
  label: string;
  usedSecs: number;
  limitSecs: number;
  attempts: number;
  accuracy: number;   // 0–1
  marks: number;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface StickyBarProps {
  sections: SectionSummary[];
  saveStatus: SaveStatus;
  onSave?: () => void;
}

function ProgressBar({ value, max, warn }: { value: number; max: number; warn: boolean }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-1 w-full bg-zinc-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${warn ? 'bg-amber-400' : 'bg-accent'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function SaveBadge({ status }: { status: SaveStatus }) {
  const map: Record<SaveStatus, { text: string; cls: string }> = {
    idle:   { text: '',          cls: '' },
    saving: { text: 'Saving…',  cls: 'text-zinc-400' },
    saved:  { text: 'Saved ✓',  cls: 'text-emerald-400' },
    error:  { text: 'Error ✗',  cls: 'text-rose-400' },
  };
  const { text, cls } = map[status];
  if (!text) return null;
  return <span className={`text-xs ${cls}`}>{text}</span>;
}

export function StickyBar({ sections, saveStatus }: StickyBarProps) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-zinc-950/90 backdrop-blur border-t border-zinc-800 px-4 py-2">
      <div className="max-w-[1100px] mx-auto flex items-center gap-4 flex-wrap">
        {sections.map((sec) => {
          const over = sec.usedSecs > sec.limitSecs;
          return (
            <div key={sec.label} className="flex flex-col gap-0.5 min-w-36">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-zinc-400 font-medium">{sec.label}</span>
                <span className={`text-xs font-mono tabular-nums ${over ? 'text-amber-400' : 'text-zinc-300'}`}>
                  {fmtSecs(sec.usedSecs)} / {fmtSecs(sec.limitSecs)}
                </span>
              </div>
              <ProgressBar value={sec.usedSecs} max={sec.limitSecs} warn={over} />
              <div className="flex gap-3 text-xs text-zinc-400">
                <span>{sec.attempts} att</span>
                <span>{Math.round(sec.accuracy * 100)}% acc</span>
                <span className={sec.marks >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {sec.marks > 0 ? '+' : ''}{sec.marks}
                </span>
              </div>
            </div>
          );
        })}

        <div className="ml-auto">
          <SaveBadge status={saveStatus} />
        </div>
      </div>
    </div>
  );
}

export default StickyBar;
