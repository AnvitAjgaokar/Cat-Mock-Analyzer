import React, { useMemo, useState } from 'react';
import type { Mock, AppSettings, Q } from '../../types';
import { Card } from '../../ui/Card';
import { attempts, accuracy, varcScore, dilrScore, qaScore, fmtSecs, varcTime, dilrTime, qaTime } from '../../calc';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, Cell, ReferenceLine
} from 'recharts';

const CHART_STYLE = { backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' };

const VA_LABEL: Record<string, string> = { PJ: 'Para Jumble', OS: 'Odd Sentence', PC: 'Para Completion', PS: 'Para Summary' };

interface Props {
  mocks: Mock[];
  settings: AppSettings;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={CHART_STYLE} className="px-3 py-2 text-xs">
      <p className="text-zinc-300 font-semibold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-mono">{typeof p.value === 'number' ? (Number.isInteger(p.value) ? p.value : p.value.toFixed(1)) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

function AccBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = value >= 70 ? '#10b981' : value >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="font-mono text-xs w-10 text-right" style={{ color }}>{value}%</span>
    </div>
  );
}

export function Dashboard7To11({ mocks, settings }: Props) {
  const mScheme = settings.marking;

  // Sort oldest to newest
  const sorted = [...mocks].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // ── 7. QA Deep Analysis: per-subject & per-topic ──────────────────────────────
  const qaStats = useMemo(() => {
    // Per-topic stats
    const topicMap: Record<string, { subj: string; att: number; cor: number; skip: number; timeSum: number; timeCount: number }> = {};
    // Per-subject stats
    const subjMap: Record<string, { att: number; cor: number; skip: number; total: number; timeSum: number }> = {};

    sorted.forEach(m => {
      (m.qa?.qs ?? []).forEach(q => {
        const subj = q.subj || 'Unknown';
        const topic = q.topic || 'Unknown';
        const key = `${subj}::${topic}`;

        if (!topicMap[key]) topicMap[key] = { subj, att: 0, cor: 0, skip: 0, timeSum: 0, timeCount: 0 };
        if (!subjMap[subj]) subjMap[subj] = { att: 0, cor: 0, skip: 0, total: 0, timeSum: 0 };

        subjMap[subj].total++;
        if (q.res === 'C' || q.res === 'W') {
          topicMap[key].att++;
          topicMap[key].cor += q.res === 'C' ? 1 : 0;
          subjMap[subj].att++;
          subjMap[subj].cor += q.res === 'C' ? 1 : 0;
        }
        if (q.res === 'S') {
          topicMap[key].skip++;
          subjMap[subj].skip++;
        }

        if ((q.t ?? 0) > 0) {
          topicMap[key].timeSum += q.t!;
          topicMap[key].timeCount++;
          subjMap[subj].timeSum += q.t!;
        }
      });
    });

    const topicList = Object.entries(topicMap).map(([k, v]) => ({
      key: k,
      subj: v.subj,
      topic: k.split('::')[1],
      total: v.att + v.skip,
      att: v.att,
      cor: v.cor,
      skip: v.skip,
      acc: v.att > 0 ? Math.round((v.cor / v.att) * 100) : 0,
      avgT: v.timeCount > 0 ? Math.round(v.timeSum / v.timeCount) : 0,
    }));

    // Weakest by accuracy (min 2 total seen)
    const weakest = topicList
      .filter(x => x.total >= 2)
      .sort((a, b) => a.acc - b.acc)
      .slice(0, 8);

    // Best (highlight what's going well)
    const strongest = topicList
      .filter(x => x.att >= 2 && x.acc >= 70)
      .sort((a, b) => b.acc - a.acc)
      .slice(0, 5);

    // Slowest topics (by avg time)
    const slowest = topicList
      .filter(x => x.att >= 2 && x.avgT > 0)
      .sort((a, b) => b.avgT - a.avgT)
      .slice(0, 8);

    // Per-subject bar data
    const subjData = Object.entries(subjMap).map(([subj, v]) => ({
      name: subj,
      acc: v.att > 0 ? Math.round((v.cor / v.att) * 100) : 0,
      att: v.att,
      skip: v.skip,
      total: v.total,
      avgT: v.att > 0 ? Math.round(v.timeSum / v.att) : 0,
    })).sort((a, b) => a.acc - b.acc);

    return { topicList, weakest, strongest, slowest, subjData };
  }, [sorted]);

  // ── 8. VARC Deep Insights ─────────────────────────────────────────────────────
  const varcStats = useMemo(() => {
    // RC Genre accuracy + time
    const rcGenre: Record<string, { att: number; cor: number; timeSum: number; passages: number }> = {};
    // RC Q-type accuracy
    const rcQtype: Record<string, { att: number; cor: number }> = {};
    // VA type accuracy + time
    const vaType: Record<string, { att: number; cor: number; timeSum: number }> = {};
    // Passage-level: attempted vs skipped
    let passAtt = 0, passSkip = 0;
    let passAttCor = 0;

    // Per-passage time efficiency
    const passageTimeData: { name: string; time: number; acc: number; label: string }[] = [];

    sorted.forEach((m, mi) => {
      (m.varc?.rc ?? []).forEach((p, pi) => {
        const genre = p.type || 'Unknown';
        if (!rcGenre[genre]) rcGenre[genre] = { att: 0, cor: 0, timeSum: 0, passages: 0 };
        rcGenre[genre].passages++;

        if (!p.attempted) {
          passSkip++;
          return;
        }
        passAtt++;

        // Time = p.t (setup) + sum of q times
        const qTimeSum = p.qs.reduce((s, q) => s + (q.t ?? 0), 0);
        const totalPassageTime = p.t + qTimeSum;
        const pCor = p.qs.filter(q => q.res === 'C').length;
        const pAtt = p.qs.filter(q => q.res === 'C' || q.res === 'W').length;

        passAttCor += pCor;
        rcGenre[genre].timeSum += totalPassageTime;
        rcGenre[genre].att += pAtt;
        rcGenre[genre].cor += pCor;

        passageTimeData.push({
          name: `M${mi + 1}P${pi + 1}`,
          label: `${m.name} – P${pi + 1} (${genre})`,
          time: Math.round(totalPassageTime / 60 * 10) / 10,
          acc: pAtt > 0 ? Math.round(pCor / pAtt * 100) : 0,
        });

        // Q-type accuracy
        p.qs.forEach(q => {
          if (q.qtype) {
            if (!rcQtype[q.qtype]) rcQtype[q.qtype] = { att: 0, cor: 0 };
            if (q.res === 'C' || q.res === 'W') rcQtype[q.qtype].att++;
            if (q.res === 'C') rcQtype[q.qtype].cor++;
          }
        });
      });

      (m.varc?.va ?? []).forEach(v => {
        const label = VA_LABEL[v.type] ?? v.type;
        if (!vaType[label]) vaType[label] = { att: 0, cor: 0, timeSum: 0 };
        v.qs.forEach(q => {
          if (q.res === 'C' || q.res === 'W') {
            vaType[label].att++;
            vaType[label].cor += q.res === 'C' ? 1 : 0;
          }
          if ((q.t ?? 0) > 0) vaType[label].timeSum += q.t!;
        });
      });
    });

    const rcGenreData = Object.entries(rcGenre)
      .filter(([, v]) => v.passages > 0)
      .map(([name, v]) => ({
        name,
        acc: v.att > 0 ? Math.round((v.cor / v.att) * 100) : 0,
        avgT: v.passages > 0 ? Math.round(v.timeSum / v.passages / 60 * 10) / 10 : 0,
        passages: v.passages,
        att: v.att,
      }))
      .sort((a, b) => a.acc - b.acc);

    const rcQtypeData = Object.entries(rcQtype)
      .filter(([, v]) => v.att >= 2)
      .map(([name, v]) => ({
        name,
        acc: Math.round((v.cor / v.att) * 100),
        att: v.att,
      }))
      .sort((a, b) => a.acc - b.acc);

    const vaData = Object.entries(vaType)
      .filter(([, v]) => v.att > 0)
      .map(([name, v]) => ({
        name,
        acc: Math.round((v.cor / v.att) * 100),
        avgT: v.att > 0 ? Math.round(v.timeSum / v.att) : 0,
        att: v.att,
      }))
      .sort((a, b) => a.acc - b.acc);

    return { rcGenreData, rcQtypeData, vaData, passageTimeData, passAtt, passSkip, passAttAcc: passAtt > 0 ? Math.round(passAttCor / (passAtt * 4) * 100) : 0 };
  }, [sorted]);

  // ── 9. DILR Deep Insights ─────────────────────────────────────────────────────
  const dilrStats = useMemo(() => {
    const setTypeMap: Record<string, { att: number; cor: number; timeSum: number; sets: number; kind: string }> = {};
    const setTimeData: { name: string; label: string; time: number; acc: number; attempted: boolean }[] = [];
    let abandonedSets = 0;

    sorted.forEach((m, mi) => {
      (m.dilr?.sets ?? []).forEach((s, si) => {
        const type = s.type || 'Unknown';
        if (!setTypeMap[type]) setTypeMap[type] = { att: 0, cor: 0, timeSum: 0, sets: 0, kind: s.kind };
        setTypeMap[type].sets++;

        const qTimeSum = s.qs.reduce((sum, q) => sum + (q.t ?? 0), 0);
        const totalSetTime = s.t + (s.attempted ? qTimeSum : 0);
        setTypeMap[type].timeSum += totalSetTime;

        const qAtts = s.attempted ? s.qs.filter(q => q.res === 'C' || q.res === 'W').length : 0;
        const qCors = s.attempted ? s.qs.filter(q => q.res === 'C').length : 0;
        setTypeMap[type].att += qAtts;
        setTypeMap[type].cor += qCors;

        setTimeData.push({
          name: `M${mi + 1}S${si + 1}`,
          label: `${m.name} – ${type} (${s.kind})`,
          time: Math.round(totalSetTime / 60 * 10) / 10,
          acc: qAtts > 0 ? Math.round(qCors / qAtts * 100) : 0,
          attempted: s.attempted,
        });

        if (si === 0 && qAtts === 0 && s.t > 120) abandonedSets++;
      });
    });

    const setTypeData = Object.entries(setTypeMap)
      .filter(([, v]) => v.sets > 0)
      .map(([name, v]) => ({
        name,
        kind: v.kind,
        acc: v.att > 0 ? Math.round((v.cor / v.att) * 100) : 0,
        avgT: v.sets > 0 ? Math.round(v.timeSum / v.sets / 60 * 10) / 10 : 0,
        sets: v.sets,
      }))
      .sort((a, b) => a.acc - b.acc);

    // Efficiency: acc vs time — which set types give best ROI
    const effData = setTypeData.filter(x => x.avgT > 0);

    return { setTypeData, setTimeData, effData, abandonedSets };
  }, [sorted]);

  // ── 10. Missed Opportunities (Easy questions) ─────────────────────────────────
  const missedStats = useMemo(() => {
    const perMock = sorted.map((m, i) => {
      const getMissed = (qs: Q[]) => qs.filter(q => (q.res === 'W' || q.res === 'S' || !q.res) && q.lvl === 'E').length;

      const v = getMissed([
        ...(m.varc?.rc ?? []).flatMap(p => p.attempted ? p.qs : []),
        ...(m.varc?.va ?? []).flatMap(v => v.qs),
      ]);
      const d = getMissed((m.dilr?.sets ?? []).flatMap(s => s.attempted ? s.qs : []));
      const q = getMissed(m.qa?.qs ?? []);

      return { name: m.name.length > 12 ? m.name.slice(0, 12) : m.name, v, d, q, total: v + d + q };
    });

    // Detailed list of all easy-missed/skipped questions in total
    const easyMissedList: { section: string; desc: string; res: string; reason?: string }[] = [];
    sorted.forEach(m => {
      // VARC RC
      (m.varc?.rc ?? []).forEach((p, pi) => {
        p.qs.forEach((q, qi) => {
          if (q.lvl === 'E' && (q.res === 'W' || q.res === 'S')) {
            easyMissedList.push({
              section: `VARC RC P${pi + 1}`,
              desc: `${m.name} – Q${qi + 1} (${p.type ?? 'RC'})`,
              res: q.res,
              reason: q.reason,
            });
          }
        });
      });
      // VARC VA
      (m.varc?.va ?? []).forEach(v => {
        v.qs.forEach((q, qi) => {
          if (q.lvl === 'E' && (q.res === 'W' || q.res === 'S')) {
            easyMissedList.push({
              section: `VARC ${VA_LABEL[v.type] ?? v.type}`,
              desc: `${m.name} – Q${qi + 1}`,
              res: q.res,
              reason: q.reason,
            });
          }
        });
      });
      // DILR
      (m.dilr?.sets ?? []).forEach((s, si) => {
        if (!s.attempted) return;
        s.qs.forEach((q, qi) => {
          if (q.lvl === 'E' && (q.res === 'W' || q.res === 'S')) {
            easyMissedList.push({
              section: `DILR ${s.kind}`,
              desc: `${m.name} – Set${si + 1} Q${qi + 1} (${s.type})`,
              res: q.res,
              reason: q.reason,
            });
          }
        });
      });
      // QA
      (m.qa?.qs ?? []).forEach((q, qi) => {
        if (q.lvl === 'E' && (q.res === 'W' || q.res === 'S')) {
          easyMissedList.push({
            section: `QA ${q.subj ?? ''}`,
            desc: `${m.name} – Q${qi + 1} (${q.topic ?? ''})`,
            res: q.res,
            reason: q.reason,
          });
        }
      });
    });

    return { perMock, easyMissedList };
  }, [sorted]);

  // ── 11. Compare Mocks ─────────────────────────────────────────────────────────
  const [comp1, setComp1] = useState<string>(sorted.length > 0 ? sorted[sorted.length - 1].id : '');
  const [comp2, setComp2] = useState<string>(sorted.length > 1 ? sorted[sorted.length - 2].id : '');

  const m1 = sorted.find(m => m.id === comp1);
  const m2 = sorted.find(m => m.id === comp2);

  function total(m: Mock) { return varcScore(m, mScheme) + dilrScore(m, mScheme) + qaScore(m, mScheme); }
  function eff(m: Mock) {
    const lim = settings.sectionMinutes;
    return {
      vt: fmtSecs(varcTime(m)), dt: fmtSecs(dilrTime(m)), qt: fmtSecs(qaTime(m)),
      vuUnused: fmtSecs(Math.max(0, lim.varc * 60 - varcTime(m))),
      duUnused: fmtSecs(Math.max(0, lim.dilr * 60 - dilrTime(m))),
      quUnused: fmtSecs(Math.max(0, lim.qa * 60 - qaTime(m))),
    };
  }

  const compareRows = (m1 && m2) ? (() => {
    const e1 = eff(m1); const e2 = eff(m2);
    const v1Qs = [...(m1.varc?.rc ?? []).flatMap(p => p.attempted ? p.qs : []), ...(m1.varc?.va ?? []).flatMap(v => v.qs)];
    const v2Qs = [...(m2.varc?.rc ?? []).flatMap(p => p.attempted ? p.qs : []), ...(m2.varc?.va ?? []).flatMap(v => v.qs)];
    const d1Qs = (m1.dilr?.sets ?? []).flatMap(s => s.attempted ? s.qs : []);
    const d2Qs = (m2.dilr?.sets ?? []).flatMap(s => s.attempted ? s.qs : []);
    return [
      { label: 'Overall Score', v1: total(m1), v2: total(m2), numeric: true },
      { label: 'Overall %ile', v1: m1.overall?.pct ?? 0, v2: m2.overall?.pct ?? 0, numeric: true },
      { label: 'VARC Score', v1: varcScore(m1, mScheme), v2: varcScore(m2, mScheme), numeric: true },
      { label: 'DILR Score', v1: dilrScore(m1, mScheme), v2: dilrScore(m2, mScheme), numeric: true },
      { label: 'QA Score', v1: qaScore(m1, mScheme), v2: qaScore(m2, mScheme), numeric: true },
      { label: 'VARC Attempts', v1: attempts(v1Qs), v2: attempts(v2Qs), numeric: true },
      { label: 'VARC Accuracy', v1: Math.round(accuracy(v1Qs) * 100), v2: Math.round(accuracy(v2Qs) * 100), unit: '%', numeric: true },
      { label: 'DILR Attempts', v1: attempts(d1Qs), v2: attempts(d2Qs), numeric: true },
      { label: 'DILR Accuracy', v1: Math.round(accuracy(d1Qs) * 100), v2: Math.round(accuracy(d2Qs) * 100), unit: '%', numeric: true },
      { label: 'QA Attempts', v1: attempts(m1.qa?.qs ?? []), v2: attempts(m2.qa?.qs ?? []), numeric: true },
      { label: 'QA Accuracy', v1: Math.round(accuracy(m1.qa?.qs ?? []) * 100), v2: Math.round(accuracy(m2.qa?.qs ?? []) * 100), unit: '%', numeric: true },
      { label: 'VARC Time Used', v1: e1.vt, v2: e2.vt, numeric: false },
      { label: 'DILR Time Used', v1: e1.dt, v2: e2.dt, numeric: false },
      { label: 'QA Time Used', v1: e1.qt, v2: e2.qt, numeric: false },
      { label: 'VARC Unused', v1: e1.vuUnused, v2: e2.vuUnused, numeric: false },
      { label: 'DILR Unused', v1: e1.duUnused, v2: e2.duUnused, numeric: false },
      { label: 'QA Unused', v1: e1.quUnused, v2: e2.quUnused, numeric: false },
    ];
  })() : [];

  if (mocks.length === 0) return null;

  return (
    <div className="flex flex-col gap-8 mt-8 border-t border-zinc-800 pt-8">
      <h2 className="text-xl font-bold text-accent">Deep Insights (7–11)</h2>

      {/* ── 7. QA Analysis ────────────────────────────────────────────────── */}
      <Card className="flex flex-col gap-6">
        <div>
          <h3 className="font-semibold text-lg">QA Analysis</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Subject accuracy, weakest topics, and time overspend</p>
        </div>

        {/* Subject-level accuracy bar */}
        <div>
          <h4 className="text-sm font-medium text-zinc-300 mb-3">Accuracy by Subject</h4>
          {qaStats.subjData.length > 0 ? (
            <div className="flex flex-col gap-2">
              {qaStats.subjData.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 w-28 truncate">{s.name}</span>
                  <AccBar value={s.acc} />
                  <span className="text-xs text-zinc-500 w-20 text-right">{s.att} att · {s.skip} skip</span>
                  <span className="text-xs text-zinc-600 w-16 text-right">~{Math.round(s.avgT)}s/q</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-zinc-500 text-sm">No QA data logged yet.</div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 border-t border-zinc-800 pt-4">
          {/* Weakest topics */}
          {qaStats.weakest.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                Weakest Topics (≥2 seen)
              </h4>
              <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                {qaStats.weakest.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 bg-zinc-800/60 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-500 truncate">{t.subj}</p>
                      <p className="text-sm font-medium text-zinc-200 truncate">{t.topic}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs text-zinc-500">
                      <span>{t.total} seen</span>
                      {t.avgT > 0 && <span>~{t.avgT}s</span>}
                      <span className={`text-sm font-bold tabular-nums ${t.acc < 40 ? 'text-rose-400' : t.acc < 60 ? 'text-amber-400' : 'text-emerald-400'}`}>{t.acc}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Slowest topics */}
          {qaStats.slowest.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" />
                Slowest Topics (avg time per Q)
              </h4>
              <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                {qaStats.slowest.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 bg-zinc-800/60 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-500 truncate">{t.subj}</p>
                      <p className="text-sm font-medium text-zinc-200 truncate">{t.topic}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                      <span className={`text-sm font-bold tabular-nums font-mono ${t.avgT > 180 ? 'text-rose-400' : t.avgT > 120 ? 'text-amber-400' : 'text-zinc-300'}`}>
                        {fmtSecs(t.avgT)}
                      </span>
                      <span className="text-zinc-500">{t.att} att</span>
                      <span className={`text-xs font-semibold ${t.acc < 50 ? 'text-rose-400' : 'text-emerald-400'}`}>{t.acc}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* QA topic accuracy bar chart for all topics */}
        {qaStats.topicList.length > 0 && (
          <div className="border-t border-zinc-800 pt-4">
            <h4 className="text-sm font-semibold text-zinc-300 mb-3">All Topics — Accuracy</h4>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...qaStats.topicList].filter(x => x.att > 0).sort((a, b) => a.acc - b.acc)}
                  layout="vertical"
                  margin={{ left: 10, right: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                  <XAxis type="number" stroke="#a1a1aa" fontSize={11} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <YAxis dataKey="topic" type="category" stroke="#a1a1aa" fontSize={10} width={130} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#27272a' }} />
                  <ReferenceLine x={70} stroke="#10b981" strokeDasharray="3 3" />
                  <Bar dataKey="acc" name="Accuracy (%)" radius={[0, 4, 4, 0]}>
                    {[...qaStats.topicList].filter(x => x.att > 0).sort((a, b) => a.acc - b.acc).map((entry, i) => (
                      <Cell key={i} fill={entry.acc >= 70 ? '#10b981' : entry.acc >= 50 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Card>

      {/* ── 8. VARC Deep Insights ─────────────────────────────────────────── */}
      <Card className="flex flex-col gap-6">
        <div>
          <h3 className="font-semibold text-lg">VARC Insights</h3>
          <p className="text-xs text-zinc-500 mt-0.5">RC genre accuracy, question-type breakdown, VA type performance, passage time</p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-zinc-800/60 rounded-lg p-3">
            <p className="text-xs text-zinc-500">Passages Attempted</p>
            <p className="text-xl font-bold">{varcStats.passAtt} <span className="text-sm font-normal text-zinc-500">/ {varcStats.passAtt + varcStats.passSkip}</span></p>
          </div>
          <div className="bg-zinc-800/60 rounded-lg p-3">
            <p className="text-xs text-zinc-500">Passages Skipped</p>
            <p className="text-xl font-bold text-amber-400">{varcStats.passSkip}</p>
          </div>
          <div className="bg-zinc-800/60 rounded-lg p-3">
            <p className="text-xs text-zinc-500">RC Accuracy (att)</p>
            <p className={`text-xl font-bold ${varcStats.passAttAcc >= 70 ? 'text-emerald-400' : varcStats.passAttAcc >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
              {varcStats.passAttAcc}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* RC Genre */}
          {varcStats.rcGenreData.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-zinc-300 mb-3">RC — Accuracy by Genre</h4>
              <div className="flex flex-col gap-1.5">
                {varcStats.rcGenreData.map((g, i) => (
                  <div key={i} className="flex items-center gap-2 bg-zinc-800/60 rounded-lg px-3 py-2">
                    <span className="text-sm text-zinc-200 flex-1 truncate">{g.name}</span>
                    <span className="text-xs text-zinc-500">{g.passages} pass · ~{g.avgT}m</span>
                    <AccBar value={g.acc} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VA Type */}
          {varcStats.vaData.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-zinc-300 mb-3">VA — Accuracy by Type</h4>
              <div className="flex flex-col gap-1.5">
                {varcStats.vaData.map((v, i) => (
                  <div key={i} className="flex items-center gap-2 bg-zinc-800/60 rounded-lg px-3 py-2">
                    <span className="text-sm text-zinc-200 flex-1 truncate">{v.name}</span>
                    <span className="text-xs text-zinc-500">{v.att} att · ~{v.avgT}s/q</span>
                    <AccBar value={v.acc} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RC Q-type */}
        {varcStats.rcQtypeData.length > 0 && (
          <div className="border-t border-zinc-800 pt-4">
            <h4 className="text-sm font-semibold text-zinc-300 mb-3">RC — Accuracy by Question Type (≥2 attempts)</h4>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={varcStats.rcQtypeData} layout="vertical" margin={{ left: 10, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                  <XAxis type="number" stroke="#a1a1aa" fontSize={11} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <YAxis dataKey="name" type="category" stroke="#a1a1aa" fontSize={10} width={120} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#27272a' }} />
                  <ReferenceLine x={70} stroke="#10b981" strokeDasharray="3 3" />
                  <Bar dataKey="acc" name="Accuracy (%)" radius={[0, 4, 4, 0]}>
                    {varcStats.rcQtypeData.map((entry, i) => (
                      <Cell key={i} fill={entry.acc >= 70 ? '#10b981' : entry.acc >= 50 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Passage time scatter (shown as list) */}
        {varcStats.passageTimeData.length > 0 && (
          <div className="border-t border-zinc-800 pt-4">
            <h4 className="text-sm font-semibold text-zinc-300 mb-3">RC — Time vs Accuracy per Passage</h4>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={varcStats.passageTimeData} margin={{ bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" stroke="#a1a1aa" fontSize={9} angle={-30} textAnchor="end" />
                  <YAxis yAxisId="time" stroke="#06b6d4" fontSize={11} unit="m" />
                  <YAxis yAxisId="acc" orientation="right" stroke="#f59e0b" fontSize={11} domain={[0, 100]} unit="%" />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#27272a' }} />
                  <Legend />
                  <Bar yAxisId="time" dataKey="time" name="Time (mins)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="acc" dataKey="acc" name="Accuracy (%)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Card>

      {/* ── 9. DILR Deep Insights ─────────────────────────────────────────── */}
      <Card className="flex flex-col gap-6">
        <div>
          <h3 className="font-semibold text-lg">DILR Insights</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Set-type accuracy, avg time per set, efficiency (acc vs time)</p>
        </div>

        {dilrStats.abandonedSets > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-amber-400">
            ⚠ {dilrStats.abandonedSets} set(s) were spent time on then not attempted — potential selection mistakes.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Set type accuracy */}
          {dilrStats.setTypeData.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-zinc-300 mb-3">Accuracy by Set Type</h4>
              <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
                {dilrStats.setTypeData.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 bg-zinc-800/60 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-500">{s.kind}</p>
                      <p className="text-sm font-medium text-zinc-200 truncate">{s.name}</p>
                    </div>
                    <span className="text-xs text-zinc-500">{s.sets} sets · ~{s.avgT}m</span>
                    <AccBar value={s.acc} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-set time vs accuracy */}
          {dilrStats.setTimeData.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-zinc-300 mb-3">Time vs Accuracy per Set</h4>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dilrStats.setTimeData} margin={{ bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" stroke="#a1a1aa" fontSize={9} angle={-30} textAnchor="end" />
                    <YAxis yAxisId="time" stroke="#06b6d4" fontSize={11} unit="m" />
                    <YAxis yAxisId="acc" orientation="right" stroke="#8b5cf6" fontSize={11} domain={[0, 100]} unit="%" />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#27272a' }} />
                    <Legend />
                    <Bar yAxisId="time" dataKey="time" name="Time (mins)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="acc" dataKey="acc" name="Accuracy (%)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Efficiency chart: set types by time — which give most bang for buck */}
        {dilrStats.effData.length > 0 && (
          <div className="border-t border-zinc-800 pt-4">
            <h4 className="text-sm font-semibold text-zinc-300 mb-3">Set Type: Avg Time (mins) vs Accuracy</h4>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dilrStats.effData} layout="vertical" margin={{ left: 10, right: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                  <XAxis type="number" stroke="#a1a1aa" fontSize={11} />
                  <YAxis dataKey="name" type="category" stroke="#a1a1aa" fontSize={10} width={130} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#27272a' }} />
                  <Legend />
                  <Bar dataKey="avgT" name="Avg Time (mins)" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="acc" name="Accuracy (%)" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-zinc-600 mt-2">Ideal: low avg time + high accuracy. Avoid high-time + low-accuracy set types.</p>
          </div>
        )}
      </Card>

      {/* ── 10. Missed Opportunities ─────────────────────────────────────── */}
      <Card className="flex flex-col gap-6">
        <div>
          <h3 className="font-semibold text-lg">Missed Opportunities</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Easy questions (Lvl E) that were wrong or skipped</p>
        </div>

        {missedStats.perMock.every(m => m.total === 0) ? (
          <div className="text-zinc-500 text-sm">
            No easy questions missed — either none are tagged 'Easy' or you got them all right. 🎉
          </div>
        ) : (
          <>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={missedStats.perMock}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" stroke="#a1a1aa" fontSize={11} />
                  <YAxis stroke="#a1a1aa" fontSize={12} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#27272a' }} />
                  <Legend />
                  <Bar dataKey="v" name="VARC Easy Missed" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="d" name="DILR Easy Missed" stackId="a" fill="#8b5cf6" />
                  <Bar dataKey="q" name="QA Easy Missed" stackId="a" fill="#ec4899" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {missedStats.easyMissedList.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-zinc-300 mb-2">Full List of Easy Questions Missed</h4>
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
                  {missedStats.easyMissedList.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 bg-zinc-800/40 rounded-lg px-3 py-1.5 text-xs">
                      <span className={`px-1.5 py-0.5 rounded font-medium ${item.res === 'W' ? 'bg-rose-500/20 text-rose-400' : 'bg-zinc-600 text-zinc-300'}`}>
                        {item.res === 'W' ? 'Wrong' : 'Skip'}
                      </span>
                      <span className="text-zinc-400 w-24 flex-shrink-0">{item.section}</span>
                      <span className="text-zinc-200 flex-1 truncate">{item.desc}</span>
                      {item.reason && <span className="text-zinc-500 italic truncate max-w-[100px]">{item.reason}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ── 11. Compare Two Mocks ─────────────────────────────────────────── */}
      <Card className="flex flex-col gap-4 overflow-x-auto">
        <div className="flex items-center justify-between mb-2 min-w-[600px]">
          <div>
            <h3 className="font-semibold text-lg">Compare Mocks</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Side-by-side: scores, accuracy, attempts, time</p>
          </div>
          <div className="flex gap-3 items-center">
            <select className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white focus:outline-none" value={comp1} onChange={e => setComp1(e.target.value)}>
              {sorted.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <span className="text-zinc-500 font-bold">vs</span>
            <select className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white focus:outline-none" value={comp2} onChange={e => setComp2(e.target.value)}>
              {sorted.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>

        {m1 && m2 ? (
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-400 uppercase tracking-wide">
                <th className="py-2 font-medium pr-4">Metric</th>
                <th className="py-2 font-medium">{m1.name}</th>
                <th className="py-2 font-medium">{m2.name}</th>
                <th className="py-2 font-medium text-right">Delta</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-zinc-800/50">
              {compareRows.map(row => {
                const delta = row.numeric ? (row.v2 as number) - (row.v1 as number) : null;
                const isImproved = delta !== null && delta > 0;
                const isWorse = delta !== null && delta < 0;
                return (
                  <tr key={row.label} className="hover:bg-zinc-900/30 transition-colors">
                    <td className="py-2 text-zinc-400 pr-4">{row.label}</td>
                    <td className="py-2 font-mono text-zinc-200">{row.v1}{(row as any).unit ?? ''}</td>
                    <td className="py-2 font-mono text-zinc-200">{row.v2}{(row as any).unit ?? ''}</td>
                    <td className={`py-2 text-right font-mono ${isImproved ? 'text-emerald-400' : isWorse ? 'text-rose-400' : 'text-zinc-500'}`}>
                      {delta !== null ? `${delta > 0 ? '+' : ''}${delta}${(row as any).unit ?? ''}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="text-zinc-500 text-sm">Select two different mocks to compare.</div>
        )}
      </Card>
    </div>
  );
}
