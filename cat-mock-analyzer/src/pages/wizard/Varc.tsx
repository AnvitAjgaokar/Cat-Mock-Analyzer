import React, { useState } from 'react';
import type { Mock, Set as SetType, VAType } from '../../types';
import { SetCard } from '../../components/SetCard';
import { QRow } from '../../components/QRow';
import { Card, Chip } from '../../ui/Card';
import { NumInput } from '../../ui/NumInput';
import { varcScore, varcTime, vaTypeTime, listMarks, fmtSecs, readingTime, sumQTime } from '../../calc';
import { WRONG_REASONS_VA, VA_TYPES, SKIP_REASONS_Q } from '../../data/options';

interface VarcProps {
  mock: Mock;
  onChange: (mock: Mock) => void;
  marking: { correct: number; wrong: number; skip: number };
  showValidation?: boolean;
}

export function Varc({ mock, onChange, marking, showValidation = false }: VarcProps) {
  const [tab, setTab] = useState<'RC' | 'VA'>('RC');

  function updateRcSet(index: number, updated: SetType) {
    const rc = [...mock.varc.rc];
    rc[index] = updated;
    onChange({ ...mock, varc: { ...mock.varc, rc } });
  }

  function updateVaType(index: number, updated: VAType) {
    const va = [...mock.varc.va];
    va[index] = updated;
    onChange({ ...mock, varc: { ...mock.varc, va } });
  }

  function updateMeta(updates: Partial<typeof mock.varc>) {
    onChange({ ...mock, varc: { ...mock.varc, ...updates } });
  }

  // RC time = Σ(reading time + question times) per passage
  const rcTime = mock.varc.rc.reduce((s, p) => s + p.t + sumQTime(p.qs), 0);
  const vaTime = mock.varc.va.reduce((s, v) => s + vaTypeTime(v), 0);
  const totalMarks = varcScore(mock, marking);
  const totalTime = varcTime(mock);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 border-b border-zinc-800 pb-2">
        <h2 className="text-xl font-bold">2. VARC</h2>
        <div className="flex bg-zinc-800 rounded-lg p-1 ml-auto">
          <button
            onClick={() => setTab('RC')}
            className={`px-4 py-1 text-sm rounded-md transition-colors ${
              tab === 'RC' ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            RC Passages
          </button>
          <button
            onClick={() => setTab('VA')}
            className={`px-4 py-1 text-sm rounded-md transition-colors ${
              tab === 'VA' ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Verbal Ability
          </button>
        </div>
      </div>

      {tab === 'RC' && (
        <div className="flex flex-col gap-2">
          {mock.varc.rc.map((set, i) => (
            <SetCard
              key={i}
              index={i + 1}
              set={set}
              onChange={(updated) => updateRcSet(i, updated)}
              marking={marking}
              showValidation={showValidation}
            />
          ))}
        </div>
      )}

      {tab === 'VA' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mock.varc.va.map((va, i) => {
            const time = vaTypeTime(va);
            const marks = listMarks(va.qs, marking);
            return (
              <Card key={i} className="flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="font-semibold text-sm text-zinc-300">
                    {VA_TYPES.find(t => t.value === va.type)?.label ?? va.type}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 font-mono">{fmtSecs(time)}</span>
                    <Chip size="xs" label={`${marks > 0 ? '+' : ''}${marks}`} variant={marks > 0 ? 'success' : marks < 0 ? 'danger' : 'default'} />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  {va.qs.map((q, qIndex) => (
                    <QRow
                      key={qIndex}
                      index={qIndex + 1}
                      q={q}
                      onChange={(updated) => {
                        const newQs = [...va.qs];
                        newQs[qIndex] = updated;
                        updateVaType(i, { ...va, qs: newQs });
                      }}
                      wrongReasons={WRONG_REASONS_VA}
                      skipReasons={SKIP_REASONS_Q}
                      lockedFmt={(va.type === 'PJ' || va.type === 'OS') ? 'TITA' : 'MCQ'}
                      showValidation={showValidation}
                    />
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Footer card */}
      <Card className="mt-4 bg-zinc-900/50">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500 uppercase tracking-wide">Time Breakdown</span>
            <div className="flex gap-4 text-sm font-mono">
              <span className="text-zinc-400">RC: {fmtSecs(rcTime)}</span>
              <span className="text-zinc-400">VA: {fmtSecs(vaTime)}</span>
              <span className="text-white font-bold">Total: {fmtSecs(totalTime)}</span>
            </div>
          </div>
          
          <div className="flex gap-6 items-center">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500 uppercase tracking-wide">Calculated Marks</span>
              <span className="text-xl font-bold tabular-nums text-accent">{totalMarks}</span>
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500 uppercase tracking-wide mb-0.5">Official Score override</span>
              <NumInput
                value={mock.varc.score}
                onChange={(v) => updateMeta({ score: v })}
                min={0}
                max={72}
              />
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500 uppercase tracking-wide mb-0.5">Section %ile</span>
              <NumInput
                value={mock.varc.pct}
                onChange={(v) => updateMeta({ pct: v })}
                min={0}
                max={100}
                step={0.01}
                decimals={2}
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default Varc;
