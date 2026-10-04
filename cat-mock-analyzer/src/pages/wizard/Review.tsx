import React from 'react';
import type { Mock, Q } from '../../types';
import { Card, Stat, Chip } from '../../ui/Card';
import { NumInput } from '../../ui/NumInput';
import {
  varcScore, dilrScore, qaScore, totalScore,
  varcTime, dilrTime, qaTime,
  accuracy, attempts, unusedTime, fmtSecs,
  easyMissed, errorCategoryCounts, slowestQs,
  estimatePercentile,
} from '../../calc';
import { WRONG_REASONS_COMMON, WRONG_REASONS_RC, WRONG_REASONS_VA, WRONG_REASONS_DILR } from '../../data/options';

interface ReviewProps {
  mock: Mock;
  onChange: (mock: Mock) => void;
  marking: { correct: number; wrong: number; skip: number };
  limits: { varc: number; dilr: number; qa: number }; // in minutes
  pctTable: Array<{ score: number; percentile: number }>;
  missingFields?: { section: string; label: string }[];
  onSetValidation?: () => void;
  onGoToStep?: (step: string) => void;
}

export function Review({ mock, onChange, marking, limits, pctTable, missingFields = [], onSetValidation, onGoToStep }: ReviewProps) {
  function updateOverall(updates: Partial<typeof mock.overall>) {
    onChange({ ...mock, overall: { ...mock.overall, ...updates } });
  }

  // Gather all questions for analytics
  // Set-skipped questions are already handled in the calc helpers for score,
  // but for global stats we can just use all Qs where res is not empty.
  const rcQs = mock.varc.rc.flatMap(p => p.attempted ? p.qs : p.qs.map(q => ({ ...q, res: 'S' as const })));
  const vaQs = mock.varc.va.flatMap(v => v.qs);
  const dilrQs = mock.dilr.sets.flatMap(s => s.attempted ? s.qs : s.qs.map(q => ({ ...q, res: 'S' as const })));
  const qaQs = mock.qa.qs;

  const allQs = [...rcQs, ...vaQs, ...dilrQs, ...qaQs];

  // Section metrics
  const vScore = varcScore(mock, marking);
  const dScore = dilrScore(mock, marking);
  const qScore = qaScore(mock, marking);
  const tScore = mock.overall.score ?? (vScore + dScore + qScore);
  
  const vTime = varcTime(mock);
  const dTime = dilrTime(mock);
  const qTime = qaTime(mock);

  const sections = [
    {
      name: 'VARC', score: vScore, pct: mock.varc.pct,
      att: attempts([...rcQs, ...vaQs]), acc: accuracy([...rcQs, ...vaQs]),
      time: vTime, unused: unusedTime(vTime, limits.varc)
    },
    {
      name: 'DILR', score: dScore, pct: mock.dilr.pct,
      att: attempts(dilrQs), acc: accuracy(dilrQs),
      time: dTime, unused: unusedTime(dTime, limits.dilr)
    },
    {
      name: 'QA', score: qScore, pct: mock.qa.pct,
      att: attempts(qaQs), acc: accuracy(qaQs),
      time: qTime, unused: unusedTime(qTime, limits.qa)
    }
  ];

  // Derived metrics
  const easyMissedQs = easyMissed(allQs);
  
  // Aggregate errors - need to map reason string to category.
  // Actually, we need a flat map of all reason values to their category.
  const allReasons = [
    ...WRONG_REASONS_COMMON, ...WRONG_REASONS_RC, ...WRONG_REASONS_VA, ...WRONG_REASONS_DILR
  ];
  const reasonMap = Object.fromEntries(allReasons.map(r => [r.value, r.cat]));
  const errorCounts = errorCategoryCounts(allQs, reasonMap);
  const topErrors = Object.entries(errorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3); // top 3 categories

  const slowQs = slowestQs(allQs, 5);

  return (
    <div className="flex flex-col gap-6 max-w-4xl pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-2 gap-4">
        <h2 className="text-xl font-bold">5. Review & Finalize</h2>
        {mock.status === 'draft' ? (
          <div className="relative group self-start md:self-auto">
            <button
              onClick={() => {
                if (missingFields.length > 0) {
                  onSetValidation?.();
                } else {
                  onChange({ ...mock, status: 'complete' });
                }
              }}
              disabled={missingFields.length > 0}
              className="bg-accent hover:bg-accent-600 disabled:opacity-50 disabled:hover:bg-accent text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Mark as Complete
            </button>
            {missingFields.length > 0 && (
               <div className="absolute top-full mt-2 right-0 bg-zinc-800 text-xs text-white p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                 Fix missing required fields below
               </div>
            )}
          </div>
        ) : (
          <Chip label="Complete" variant="success" />
        )}
      </div>

      {missingFields.length > 0 && (
        <Card className="border-rose-900/50 bg-rose-950/20">
          <h3 className="text-sm font-bold text-rose-400 mb-2">Missing Required Fields</h3>
          <ul className="text-sm flex flex-col gap-2">
             {missingFields.map((f, i) => (
                <li key={i}>
                   <button 
                     onClick={() => {
                        onSetValidation?.();
                        onGoToStep?.(f.section);
                     }}
                     className="text-zinc-300 hover:text-white hover:underline text-left flex items-center gap-2"
                   >
                     <span className="font-semibold uppercase text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">{f.section}</span>
                     {f.label}
                   </button>
                </li>
             ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Overall Stats */}
        <Card className="col-span-1 md:col-span-3 flex flex-wrap gap-8 items-center bg-zinc-900/50">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500 uppercase tracking-wide">Overall Score</span>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold tabular-nums text-accent">{tScore}</span>
              <NumInput
                value={mock.overall.score}
                onChange={(v) => updateOverall({ score: v })}
                placeholder="Override"
                max={204}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500 uppercase tracking-wide">Percentile</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold tabular-nums">
                {mock.overall.pct ?? <span className="italic text-zinc-400">est. {estimatePercentile(tScore, pctTable).toFixed(2)}</span>}
              </span>
              <NumInput
                value={mock.overall.pct}
                onChange={(v) => updateOverall({ pct: v })}
                placeholder="Actual"
                max={100} step={0.01} decimals={2}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1 border-l border-zinc-800 pl-8">
            <span className="text-xs text-zinc-500 uppercase tracking-wide mb-0.5">Rank</span>
            <NumInput
              value={mock.overall.rank}
              onChange={(v) => updateOverall({ rank: v })}
              placeholder="e.g. 120"
            />
          </div>

          <div className="flex flex-col gap-1 border-l border-zinc-800 pl-8">
            <span className="text-xs text-zinc-500 uppercase tracking-wide mb-0.5">Test Takers</span>
            <NumInput
              value={mock.overall.takers}
              onChange={(v) => updateOverall({ takers: v })}
              placeholder="e.g. 15000"
            />
          </div>
        </Card>

        {/* Section Table */}
        <Card className="col-span-1 md:col-span-3 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
                <th className="pb-2 font-medium">Section</th>
                <th className="pb-2 font-medium text-right">Score</th>
                <th className="pb-2 font-medium text-right">%ile</th>
                <th className="pb-2 font-medium text-right">Att</th>
                <th className="pb-2 font-medium text-right">Acc</th>
                <th className="pb-2 font-medium text-right">Time</th>
                <th className="pb-2 font-medium text-right">Unused</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {sections.map(s => (
                <tr key={s.name} className="border-b border-zinc-800/50 last:border-0">
                  <td className="py-2 font-medium text-zinc-300">{s.name}</td>
                  <td className="py-2 text-right font-mono text-emerald-400">{s.score}</td>
                  <td className="py-2 text-right tabular-nums">
                    {s.pct ?? <span className="italic text-zinc-500">{estimatePercentile(s.score, pctTable).toFixed(2)}</span>}
                  </td>
                  <td className="py-2 text-right tabular-nums text-zinc-400">{s.att}</td>
                  <td className="py-2 text-right tabular-nums text-zinc-400">{Math.round(s.acc * 100)}%</td>
                  <td className="py-2 text-right font-mono text-zinc-400">{fmtSecs(s.time)}</td>
                  <td className={`py-2 text-right font-mono ${s.unused < 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
                    {fmtSecs(s.unused)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Auto-lists */}
        <Card className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-accent uppercase tracking-wide">Top Errors</h3>
          {topErrors.length === 0 ? (
            <span className="text-sm text-zinc-500 italic">No errors logged.</span>
          ) : (
            <ul className="text-sm flex flex-col gap-1.5">
              {topErrors.map(([cat, count]) => (
                <li key={cat} className="flex justify-between items-center">
                  <span className="text-zinc-300">{cat}</span>
                  <Chip size="xs" label={String(count)} variant="danger" />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-accent uppercase tracking-wide">Easy Missed</h3>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl font-bold tabular-nums text-rose-400">{easyMissedQs.length}</span>
            <span className="text-sm text-zinc-400 leading-tight">questions<br/>left on table</span>
          </div>
          {easyMissedQs.length > 0 && (
            <span className="text-xs text-zinc-500">Check rows marked Easy with W/S results.</span>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-accent uppercase tracking-wide">Slowest Qs</h3>
          {slowQs.length === 0 ? (
            <span className="text-sm text-zinc-500 italic">No times logged.</span>
          ) : (
            <ul className="text-sm flex flex-col gap-1.5">
              {slowQs.map((q, i) => (
                <li key={i} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-4 text-zinc-500 text-right">{i+1}.</span>
                    <span className={q.res === 'C' ? 'text-emerald-400' : q.res === 'W' ? 'text-rose-400' : 'text-zinc-400'}>
                      {q.res || '-'}
                    </span>
                  </div>
                  <span className="font-mono text-zinc-400">{fmtSecs(q.t ?? 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Free text */}
        <Card className="col-span-1 md:col-span-3 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-accent uppercase tracking-wide">Key Learnings</label>
            <textarea
              value={mock.overall.learnings ?? ''}
              onChange={(e) => updateOverall({ learnings: e.target.value })}
              placeholder="What worked? What didn't? e.g. 'Stuck too long on DI set 1'."
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent resize-y"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-accent uppercase tracking-wide">Action Items</label>
            <textarea
              value={mock.overall.actions ?? ''}
              onChange={(e) => updateOverall({ actions: e.target.value })}
              placeholder="Next steps? e.g. 'Revise AP/GP formulas'."
              rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent resize-y"
            />
          </div>
        </Card>

      </div>
    </div>
  );
}

export default Review;
