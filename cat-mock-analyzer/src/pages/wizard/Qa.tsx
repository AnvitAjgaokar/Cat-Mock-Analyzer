import React from 'react';
import type { Mock, QA_Q } from '../../types';
import { QRow } from '../../components/QRow';
import { Card } from '../../ui/Card';
import { NumInput } from '../../ui/NumInput';
import { Select } from '../../ui/Select';
import { qaSubjectStats, qaScore, qaTime, fmtSecs } from '../../calc';
import { QA_SUBJECTS, QA_TOPICS, WRONG_REASONS_COMMON } from '../../data/options';

interface QaProps {
  mock: Mock;
  onChange: (mock: Mock) => void;
  marking: { correct: number; wrong: number; skip: number };
  showValidation?: boolean;
}

export function Qa({ mock, onChange, marking, showValidation = false }: QaProps) {
  const qs = mock.qa.qs;

  function addRow() {
    onChange({
      ...mock,
      qa: { ...mock.qa, qs: [...qs, { res: '', fmt: 'MCQ', subj: '', topic: '' }] }
    });
  }

  function updateQ(i: number, updated: QA_Q) {
    const newQs = [...qs];
    // Reset topic if subject changed
    if (updated.subj !== newQs[i].subj) {
      updated.topic = '';
    }
    newQs[i] = updated;
    onChange({ ...mock, qa: { ...mock.qa, qs: newQs } });
  }

  function removeQ(i: number) {
    const newQs = [...qs];
    newQs.splice(i, 1);
    onChange({ ...mock, qa: { ...mock.qa, qs: newQs } });
  }

  function updateMeta(updates: Partial<typeof mock.qa>) {
    onChange({ ...mock, qa: { ...mock.qa, ...updates } });
  }

  const stats = qaSubjectStats(qs);
  const totalMarks = qaScore(mock, marking);
  const totalTime = qaTime(mock);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 border-b border-zinc-800 pb-2">
        <h2 className="text-xl font-bold">4. Quantitative Ability</h2>
        <span className={`text-sm ${qs.length === 22 ? 'text-emerald-400' : 'text-amber-400'}`}>
          {qs.length} / 22 qs logged
        </span>
      </div>

      {/* Summary strip */}
      <div className="flex flex-wrap gap-2">
        {stats.map(s => (
          <div key={s.subj} className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-1.5 flex gap-3 text-sm items-center">
            <span className="font-medium text-zinc-300">{s.subj}</span>
            <span className="text-zinc-400 text-xs">{s.attempted}/{s.total} att</span>
            <span className="text-zinc-400 text-xs">{Math.round(s.accuracy * 100)}% acc</span>
          </div>
        ))}
      </div>

      <Card className="flex flex-col gap-1">
        {qs.map((q, i) => {
          const topics = q.subj && (q.subj in QA_TOPICS) ? QA_TOPICS[q.subj as keyof typeof QA_TOPICS] : [];
          
          const extra = (
            <div className="flex flex-col gap-0.5 mr-2" onClick={(e) => e.stopPropagation()}>
              <label className="text-[10px] text-zinc-500 font-medium">Subject & Topic</label>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Select
                    value={q.subj}
                    onChange={(v) => updateQ(i, { ...q, subj: v, topic: '' })}
                    options={[
                      { value: '', label: 'subject…' },
                      ...QA_SUBJECTS.map(s => ({ value: s, label: s }))
                    ]}
                    className={`w-32 ${showValidation && !q.subj ? 'border-rose-500' : ''}`}
                  />
                  {showValidation && !q.subj && <span className="absolute -top-3 right-0 text-[9px] text-rose-500">Required</span>}
                </div>
                <div className="relative">
                  <Select
                    value={q.topic}
                    onChange={(v) => updateQ(i, { ...q, topic: v })}
                    options={[
                      { value: '', label: 'topic…' },
                      ...topics.map(t => ({ value: t, label: t }))
                    ]}
                    className={`w-40 ${showValidation && !q.topic ? 'border-rose-500' : ''}`}
                    disabled={!q.subj}
                  />
                  {showValidation && !q.topic && <span className="absolute -top-3 right-0 text-[9px] text-rose-500">Required</span>}
                </div>
              </div>
            </div>
          );

          return (
            <div key={i} className="flex items-start gap-1 group relative">
              <div className="flex-1">
                <QRow
                  index={i + 1}
                  q={q}
                  onChange={(updated) => updateQ(i, updated as QA_Q)}
                  wrongReasons={WRONG_REASONS_COMMON}
                  extra={extra}
                  showValidation={showValidation}
                />
              </div>
              <button
                onClick={() => removeQ(i)}
                className="text-zinc-600 hover:text-rose-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove question"
              >
                ✕
              </button>
            </div>
          );
        })}
        
        <button
          onClick={addRow}
          className="border border-dashed border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 rounded px-2 py-1.5 mt-2 text-sm flex justify-center transition-colors"
        >
          + Add Question
        </button>
      </Card>

      {/* Footer card */}
      <Card className="mt-2 bg-zinc-900/50">
        <div className="flex flex-wrap items-center justify-end gap-6">
          <div className="flex flex-col gap-1 border-l border-zinc-800 pl-8 mr-auto">
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
              value={mock.qa.score}
              onChange={(v) => updateMeta({ score: v })}
              min={0}
              max={66}
            />
          </div>
          
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500 uppercase tracking-wide mb-0.5">Section %ile</span>
            <NumInput
              value={mock.qa.pct}
              onChange={(v) => updateMeta({ pct: v })}
              min={0}
              max={100}
              step={0.01}
              decimals={2}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

export default Qa;
