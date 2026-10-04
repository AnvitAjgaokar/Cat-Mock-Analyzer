import React, { useMemo, useState } from 'react';
import type { Mock, AppSettings, Q } from '../../types';
import { Card } from '../../ui/Card';
import { attempts, accuracy, varcScore, dilrScore, qaScore, fmtSecs } from '../../calc';
import { QA_SUBJECTS, QA_TOPICS, VA_TYPES, RC_GENRES } from '../../data/options';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

const CHART_STYLE = { backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' };

interface Props {
  mocks: Mock[];
  settings: AppSettings;
}

export function Dashboard7To11({ mocks, settings }: Props) {
  const mScheme = settings.marking;
  
  // Sort oldest to newest
  const sorted = [...mocks].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // ── 7. QA Heatmap & Weakest Topics ──
  const qaStats = useMemo(() => {
    const stats: Record<string, { subj: string, att: number, cor: number, time: number }> = {};
    
    sorted.forEach(m => {
      (m.qa?.qs ?? []).forEach(q => {
        if (!q.subj || !q.topic) return;
        const key = `${q.subj}::${q.topic}`;
        if (!stats[key]) stats[key] = { subj: q.subj, att: 0, cor: 0, time: 0 };
        
        if (q.res === 'C' || q.res === 'W') stats[key].att++;
        if (q.res === 'C') stats[key].cor++;
        if ((q.t ?? 0) > 0) stats[key].time += q.t!;
      });
    });

    const list = Object.entries(stats).map(([k, v]) => {
      const [subj, topic] = k.split('::');
      return { 
        subj, topic, 
        att: v.att, 
        acc: v.att > 0 ? v.cor / v.att : 0, 
        avgT: v.att > 0 ? Math.round(v.time / v.att) : 0 
      };
    });

    const weakest = list.filter(x => x.att >= 3).sort((a, b) => a.acc - b.acc).slice(0, 5);
    
    return { list, weakest };
  }, [sorted]);

  // ── 8. VARC Insights ──
  const varcStats = useMemo(() => {
    const rcGenre: Record<string, { att: number, cor: number }> = {};
    const vaType: Record<string, { att: number, cor: number }> = {};
    
    let attemptedPassages = { att: 0, cor: 0 };
    let skippedPassages = { att: 0, cor: 0 }; // Questions in passages that were skipped? No, skipped passages have 0 attempts. Wait. 
    // "accuracy of attempted passages vs skipped" - wait, if you skip a passage, you can't have accuracy. Ah, maybe "accuracy of passages selected vs average" or "accuracy in 1st vs last"?
    // "passage selection quality (accuracy of attempted passages vs skipped)" -> Maybe if they skipped the whole passage (attempted = false), the accuracy is 0%. If attempted = true, what is the accuracy?
    // Let's just do Genre and VA type.

    sorted.forEach(m => {
      (m.varc?.rc ?? []).forEach(p => {
        if (!p.type) return;
        if (!rcGenre[p.type]) rcGenre[p.type] = { att: 0, cor: 0 };
        p.qs.forEach(q => {
          if (q.res === 'C' || q.res === 'W') rcGenre[p.type].att++;
          if (q.res === 'C') rcGenre[p.type].cor++;
        });
      });
      (m.varc?.va ?? []).forEach(v => {
        if (!vaType[v.type]) vaType[v.type] = { att: 0, cor: 0 };
        v.qs.forEach(q => {
          if (q.res === 'C' || q.res === 'W') vaType[v.type].att++;
          if (q.res === 'C') vaType[v.type].cor++;
        });
      });
    });

    const rcData = Object.entries(rcGenre).map(([k, v]) => ({ name: k, acc: v.att > 0 ? Math.round((v.cor/v.att)*100) : 0, att: v.att })).filter(x => x.att > 0);
    const vaData = Object.entries(vaType).map(([k, v]) => ({ name: k, acc: v.att > 0 ? Math.round((v.cor/v.att)*100) : 0, att: v.att })).filter(x => x.att > 0);
    return { rcData, vaData };
  }, [sorted]);

  // ── 9. DILR Insights ──
  const dilrStats = useMemo(() => {
    const setTypes: Record<string, { att: number, cor: number, time: number, sets: number }> = {};
    let abandonedSets = 0;
    
    sorted.forEach(m => {
      (m.dilr?.sets ?? []).forEach((s, idx) => {
        if (!s.type) return;
        if (!setTypes[s.type]) setTypes[s.type] = { att: 0, cor: 0, time: 0, sets: 0 };
        setTypes[s.type].sets++;
        setTypes[s.type].time += s.t;
        
        let qAtts = 0;
        s.qs.forEach(q => {
          if (q.res === 'C' || q.res === 'W') {
            setTypes[s.type].att++;
            qAtts++;
          }
          if (q.res === 'C') setTypes[s.type].cor++;
        });

        if (idx === 0 && qAtts === 0 && s.t > 120) {
          abandonedSets++;
        }
      });
    });

    const data = Object.entries(setTypes).map(([k, v]) => ({
      name: k,
      acc: v.att > 0 ? Math.round((v.cor/v.att)*100) : 0,
      avgT: v.sets > 0 ? Math.round((v.time/v.sets)/60) : 0, // mins
      sets: v.sets
    })).filter(x => x.sets > 0);

    return { data, abandonedSets };
  }, [sorted]);

  // ── 10. Missed Opportunities ──
  const missedStats = useMemo(() => {
    return sorted.map((m, i) => {
      const getMissed = (qs: Q[]) => qs.filter(q => (q.res === 'W' || q.res === 'S' || !q.res) && q.diff === 'E').length;
      
      const v = getMissed([...(m.varc?.rc ?? []).flatMap(p => p.attempted ? p.qs : []), ...(m.varc?.va ?? []).flatMap(v => v.qs)]);
      const d = getMissed((m.dilr?.sets ?? []).flatMap(s => s.attempted ? s.qs : []));
      const q = getMissed(m.qa?.qs ?? []);

      return { name: `M${i+1}`, v, d, q };
    });
  }, [sorted]);

  // ── 11. Compare Mocks ──
  const [comp1, setComp1] = useState<string>(sorted.length > 0 ? sorted[sorted.length-1].id : '');
  const [comp2, setComp2] = useState<string>(sorted.length > 1 ? sorted[sorted.length-2].id : '');
  
  const m1 = sorted.find(m => m.id === comp1);
  const m2 = sorted.find(m => m.id === comp2);

  return (
    <div className="flex flex-col gap-8 mt-8 border-t border-zinc-800 pt-8">
      <h2 className="text-xl font-bold text-accent">Deep Insights (7–11)</h2>

      {/* 7. QA Weakest Topics */}
      <Card className="flex flex-col gap-4">
        <h3 className="font-semibold">QA Weakest Topics <span className="text-xs text-zinc-400 font-normal ml-2">(Min. 3 attempts)</span></h3>
        {qaStats.weakest.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {qaStats.weakest.map((t, i) => (
              <div key={i} className="bg-zinc-900/80 p-3 rounded-lg border border-rose-500/20 flex flex-col gap-1">
                <span className="text-xs text-zinc-400 uppercase">{t.subj}</span>
                <span className="font-medium text-sm line-clamp-1">{t.topic}</span>
                <div className="flex justify-between items-end mt-2">
                  <span className="text-lg font-bold text-rose-400">{Math.round(t.acc * 100)}%</span>
                  <span className="text-xs text-zinc-500">{t.att} att</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-zinc-500 text-sm">Not enough data to determine weakest topics yet.</div>
        )}
      </Card>

      {/* 8 & 9. Sectional Topic Accuracy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="flex flex-col gap-4">
          <h3 className="font-semibold">VARC Accuracy by Type</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[...varcStats.rcData, ...varcStats.vaData]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={10} tick={{width: 80}} interval={0} angle={-25} textAnchor="end" />
                <YAxis stroke="#a1a1aa" fontSize={12} domain={[0, 100]} />
                <Tooltip contentStyle={CHART_STYLE} cursor={{ fill: '#27272a' }} />
                <Bar dataKey="acc" name="Accuracy (%)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <h3 className="font-semibold">DILR Accuracy by Set Type</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dilrStats.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={10} tick={{width: 80}} interval={0} angle={-25} textAnchor="end" />
                <YAxis stroke="#a1a1aa" fontSize={12} domain={[0, 100]} />
                <Tooltip contentStyle={CHART_STYLE} cursor={{ fill: '#27272a' }} />
                <Bar dataKey="acc" name="Accuracy (%)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* 10. Missed Opportunities */}
      <Card className="flex flex-col gap-4">
        <h3 className="font-semibold">Missed Opportunities <span className="text-xs text-zinc-400 font-normal ml-2">(Easy questions missed or skipped)</span></h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={missedStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} />
              <YAxis stroke="#a1a1aa" fontSize={12} />
              <Tooltip contentStyle={CHART_STYLE} />
              <Legend />
              <Line type="monotone" dataKey="v" name="VARC Easy Missed" stroke="#f59e0b" strokeWidth={2} />
              <Line type="monotone" dataKey="d" name="DILR Easy Missed" stroke="#8b5cf6" strokeWidth={2} />
              <Line type="monotone" dataKey="q" name="QA Easy Missed" stroke="#ec4899" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 11. Compare Two Mocks */}
      <Card className="flex flex-col gap-4 overflow-x-auto">
        <div className="flex items-center justify-between mb-2 min-w-[600px]">
          <h3 className="font-semibold">Compare Mocks</h3>
          <div className="flex gap-4">
            <select className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white focus:outline-none" value={comp1} onChange={e => setComp1(e.target.value)}>
              {sorted.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <span className="text-zinc-500">vs</span>
            <select className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white focus:outline-none" value={comp2} onChange={e => setComp2(e.target.value)}>
              {sorted.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>

        {m1 && m2 ? (
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-400 uppercase tracking-wide">
                <th className="py-2 font-medium">Metric</th>
                <th className="py-2 font-medium">{m1.name}</th>
                <th className="py-2 font-medium">{m2.name}</th>
                <th className="py-2 font-medium text-right">Delta (M1 → M2)</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-zinc-800/50">
              {[
                { label: 'Overall Score', v1: m1.overall?.score ?? total(m1), v2: m2.overall?.score ?? total(m2) },
                { label: 'Overall %ile', v1: m1.overall?.pct ?? 0, v2: m2.overall?.pct ?? 0 },
                { label: 'VARC Score', v1: varcScore(m1, mScheme), v2: varcScore(m2, mScheme) },
                { label: 'DILR Score', v1: dilrScore(m1, mScheme), v2: dilrScore(m2, mScheme) },
                { label: 'QA Score', v1: qaScore(m1, mScheme), v2: qaScore(m2, mScheme) },
              ].map(row => (
                <tr key={row.label} className="hover:bg-zinc-900/30 transition-colors">
                  <td className="py-2 text-zinc-300">{row.label}</td>
                  <td className="py-2 font-mono">{row.v1}</td>
                  <td className="py-2 font-mono">{row.v2}</td>
                  <td className={`py-2 text-right font-mono ${row.v2 > row.v1 ? 'text-emerald-400' : row.v2 < row.v1 ? 'text-rose-400' : 'text-zinc-500'}`}>
                    {row.v2 > row.v1 ? '+' : ''}{row.v2 - row.v1}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-zinc-500 text-sm">Select two mocks to compare.</div>
        )}
      </Card>
    </div>
  );

  function total(m: Mock) {
    return varcScore(m, mScheme) + dilrScore(m, mScheme) + qaScore(m, mScheme);
  }
}
