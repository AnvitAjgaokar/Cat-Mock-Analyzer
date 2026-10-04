import React, { useState } from 'react';
import type { Mock, Set as SetType, Q } from '../../types';
import { SetCard } from '../../components/SetCard';
import { Card, Chip } from '../../ui/Card';
import { NumInput } from '../../ui/NumInput';
import { dilrScore, dilrTime, fmtSecs, accuracy, attempts } from '../../calc';

interface DilrProps {
  mock: Mock;
  onChange: (mock: Mock) => void;
  marking: { correct: number; wrong: number; skip: number };
  showValidation?: boolean;
}

function emptySet(kind: 'DI' | 'LR'): SetType {
  const qs: Q[] = Array(4).fill(null).map(() => ({ res: '', fmt: 'MCQ' }));
  return { kind, type: '', attempted: true, t: 0, qs };
}

export function Dilr({ mock, onChange, marking, showValidation = false }: DilrProps) {
  const [tab, setTab] = useState<'DI' | 'LR'>('DI');

  const sets = mock.dilr.sets;
  const filteredSets = sets.filter(s => s.kind === tab);
  
  const loggedQs = sets.reduce((sum, s) => sum + s.qs.length, 0);

  function addSet() {
    onChange({
      ...mock,
      dilr: { ...mock.dilr, sets: [...sets, emptySet(tab)] }
    });
  }

  function updateSet(idStr: string, updated: SetType) {
    // idStr is just index in the original array, but since we filter, we need original index.
    // Actually, passing original index is better.
    const newSets = [...sets];
    newSets[parseInt(idStr, 10)] = updated;
    onChange({ ...mock, dilr: { ...mock.dilr, sets: newSets } });
  }

  function deleteSet(originalIndex: number) {
    const newSets = [...sets];
    newSets.splice(originalIndex, 1);
    onChange({ ...mock, dilr: { ...mock.dilr, sets: newSets } });
  }

  function updateMeta(updates: Partial<typeof mock.dilr>) {
    onChange({ ...mock, dilr: { ...mock.dilr, ...updates } });
  }

  // Subtotals
  const diSets = sets.filter(s => s.kind === 'DI');
  const lrSets = sets.filter(s => s.kind === 'LR');

  function calcSub(ss: SetType[]) {
    const time = ss.reduce((sum, s) => sum + s.t, 0);
    const qs = ss.flatMap(s => s.attempted ? s.qs : s.qs.map(q => ({ ...q, res: 'S' as const })));
    return { time, att: attempts(qs), acc: accuracy(qs) };
  }

  const di = calcSub(diSets);
  const lr = calcSub(lrSets);
  const totalMarks = dilrScore(mock, marking);
  const totalTime = dilrTime(mock);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 border-b border-zinc-800 pb-2 flex-wrap">
        <h2 className="text-xl font-bold">3. DILR</h2>
        <span className={`text-sm ${loggedQs === 22 ? 'text-emerald-400' : 'text-amber-400'}`}>
          {loggedQs} / 22 qs logged
        </span>

        <div className="flex bg-zinc-800 rounded-lg p-1 ml-auto">
          <button
            onClick={() => setTab('DI')}
            className={`px-4 py-1 text-sm rounded-md transition-colors ${
              tab === 'DI' ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Data Interpretation
          </button>
          <button
            onClick={() => setTab('LR')}
            className={`px-4 py-1 text-sm rounded-md transition-colors ${
              tab === 'LR' ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Logical Reasoning
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {sets.map((set, i) => {
          if (set.kind !== tab) return null;
          return (
            <SetCard
              key={i}
              index={i + 1}
              set={set}
              onChange={(updated) => updateSet(i.toString(), updated)}
              onDelete={() => deleteSet(i)}
              marking={marking}
              showValidation={showValidation}
            />
          );
        })}
        <button
          onClick={addSet}
          className="border border-dashed border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 rounded-xl py-3 flex items-center justify-center gap-2 transition-colors"
        >
          <span>+ Add {tab} Set</span>
        </button>
      </div>

      {/* Footer card */}
      <Card className="mt-4 bg-zinc-900/50">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex gap-8">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500 uppercase tracking-wide">DI Subtotal</span>
              <div className="flex gap-3 text-sm text-zinc-300">
                <span className="font-mono">{fmtSecs(di.time)}</span>
                <span>{di.att} att</span>
                <span>{Math.round(di.acc * 100)}% acc</span>
              </div>
            </div>
            <div className="flex flex-col gap-1 border-l border-zinc-800 pl-8">
              <span className="text-xs text-zinc-500 uppercase tracking-wide">LR Subtotal</span>
              <div className="flex gap-3 text-sm text-zinc-300">
                <span className="font-mono">{fmtSecs(lr.time)}</span>
                <span>{lr.att} att</span>
                <span>{Math.round(lr.acc * 100)}% acc</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-6 items-center">
            <div className="flex flex-col gap-1 border-l border-zinc-800 pl-8">
              <span className="text-xs text-zinc-500 uppercase tracking-wide">Total Time</span>
              <span className="text-sm font-bold font-mono">{fmtSecs(totalTime)}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500 uppercase tracking-wide">Calculated Marks</span>
              <span className="text-xl font-bold tabular-nums text-accent">{totalMarks}</span>
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500 uppercase tracking-wide mb-0.5">Official Score override</span>
              <NumInput
                value={mock.dilr.score}
                onChange={(v) => updateMeta({ score: v })}
                min={0}
                max={66}
              />
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500 uppercase tracking-wide mb-0.5">Section %ile</span>
              <NumInput
                value={mock.dilr.pct}
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

export default Dilr;
