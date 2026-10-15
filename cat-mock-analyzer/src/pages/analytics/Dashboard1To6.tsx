import React, { useState, useMemo } from 'react';
import type { Mock, AppSettings } from '../../types';
import { Card } from '../../ui/Card';
import { varcScore, dilrScore, qaScore, accuracy, attempts, varcTime, dilrTime, qaTime, fmtSecs } from '../../calc';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ReferenceLine, BarChart, Bar, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { WRONG_REASONS_COMMON, WRONG_REASONS_RC, WRONG_REASONS_VA, WRONG_REASONS_DILR, SKIP_REASONS_Q } from '../../data/options';

// ── Colors ──
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];
const CAT_COLORS: Record<string, string> = {
  Concept: '#6366f1',
  Calculation: '#ef4444',
  Comprehension: '#f59e0b',
  Time: '#06b6d4',
  Strategy: '#8b5cf6',
};
const CHART_STYLE = { backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' };

// Build a complete reason→{label,cat} map across all reason lists
const ALL_REASONS = [
  ...WRONG_REASONS_COMMON,
  ...WRONG_REASONS_RC,
  ...WRONG_REASONS_VA,
  ...WRONG_REASONS_DILR,
  ...SKIP_REASONS_Q,
];
const REASON_MAP = new Map(ALL_REASONS.map(r => [r.value, r]));

interface Props {
  mocks: Mock[];
  settings: AppSettings;
}

// ── Custom tooltip ──
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={CHART_STYLE} className="px-3 py-2 text-xs">
      <p className="text-zinc-300 font-semibold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <span className="font-mono">{typeof p.value === 'number' ? (Number.isInteger(p.value) ? p.value : p.value.toFixed(1)) : p.value}</span></p>
      ))}
    </div>
  );
}

export function Dashboard1To6({ mocks, settings }: Props) {
  const mScheme = settings.marking;
  
  // Sort mocks chronologically for charts (oldest to newest)
  const sorted = [...mocks].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // 1. KPIs
  const latest = sorted[sorted.length - 1];
  const tScores = sorted.map(m => m.overall?.score ?? (varcScore(m, mScheme) + dilrScore(m, mScheme) + qaScore(m, mScheme)));
  
  const bestScore = tScores.length > 0 ? Math.max(...tScores) : 0;
  
  const last5 = tScores.slice(-5);
  const avgLast5 = last5.length > 0 ? last5.reduce((a,b)=>a+b, 0) / last5.length : 0;

  const last3 = tScores.slice(-3);
  const prev3 = tScores.slice(-6, -3);
  const avgLast3 = last3.length > 0 ? last3.reduce((a,b)=>a+b, 0) / last3.length : 0;
  const avgPrev3 = prev3.length > 0 ? prev3.reduce((a,b)=>a+b, 0) / prev3.length : 0;
  const delta3 = avgLast3 - avgPrev3;

  // 2 & 3. Chart data: Scores over time
  const scoreData = sorted.map((m, i) => {
    const v = varcScore(m, mScheme);
    const d = dilrScore(m, mScheme);
    const q = qaScore(m, mScheme);
    return {
      name: `M${i+1}`,
      date: m.date,
      total: m.overall?.score ?? (v + d + q),
      pct: m.overall?.pct ?? 0,
      varc: v,
      dilr: d,
      qa: q
    };
  });

  // 4. Attempts vs Accuracy
  const attAccData = sorted.map((m, i) => {
    const rcQs = (m.varc?.rc ?? []).flatMap(p => p.attempted ? p.qs : p.qs.map(q => ({ ...q, res: 'S' as const })));
    const vaQs = (m.varc?.va ?? []).flatMap(v => v.qs);
    const dilrQs = (m.dilr?.sets ?? []).flatMap(s => s.attempted ? s.qs : s.qs.map(q => ({ ...q, res: 'S' as const })));
    const qaQs = m.qa?.qs ?? [];

    return {
      name: `M${i+1}`,
      vAtt: attempts([...rcQs, ...vaQs]), vAcc: accuracy([...rcQs, ...vaQs]) * 100,
      dAtt: attempts(dilrQs), dAcc: accuracy(dilrQs) * 100,
      qAtt: attempts(qaQs), qAcc: accuracy(qaQs) * 100,
    };
  });

  // 5. Time
  const limits = settings.sectionMinutes;
  const timeData = sorted.map((m, i) => {
    const vt = varcTime(m);
    const dt = dilrTime(m);
    const qt = qaTime(m);
    
    const vU = Math.max(0, limits.varc * 60 - vt);
    const dU = Math.max(0, limits.dilr * 60 - dt);
    const qU = Math.max(0, limits.qa * 60 - qt);

    const rcQs = (m.varc?.rc ?? []).flatMap(p => p.attempted ? p.qs : []);
    const vaQs = (m.varc?.va ?? []).flatMap(v => v.qs);
    const dilrQs = (m.dilr?.sets ?? []).flatMap(s => s.attempted ? s.qs : []);
    const allQs = [...rcQs, ...vaQs, ...dilrQs, ...(m.qa?.qs ?? [])];

    const cQs = allQs.filter(q => q.res === 'C' && (q.t ?? 0) > 0);
    const wQs = allQs.filter(q => q.res === 'W' && (q.t ?? 0) > 0);

    const cAvg = cQs.length ? cQs.reduce((s,q)=>s+(q.t??0),0)/cQs.length : 0;
    const wAvg = wQs.length ? wQs.reduce((s,q)=>s+(q.t??0),0)/wQs.length : 0;

    return {
      name: `M${i+1}`,
      vTime: Math.round(vt / 60), dTime: Math.round(dt / 60), qTime: Math.round(qt / 60),
      vU: Math.round(vU/60), dU: Math.round(dU/60), qU: Math.round(qU/60),
      cAvg: Math.round(cAvg), wAvg: Math.round(wAvg)
    };
  });

  // ── 6. Mistake Analysis (NEW: multi-section, subject/topic breakdown) ──
  const [errSection, setErrSection] = useState<'ALL'|'VARC'|'DILR'|'QA'>('ALL');

  const mistakeStats = useMemo(() => {
    // Aggregate all wrong/skipped questions by section
    const catCounts: Record<string, number> = {};
    const reasonCounts: Record<string, { count: number; label: string; cat: string }> = {};
    const trendData: any[] = [];

    // QA subject/topic breakdown
    const qaSubjMistakes: Record<string, { wrong: number; skip: number; total: number }> = {};
    const qaTopicMistakes: Record<string, { subj: string; wrong: number; skip: number; total: number }> = {};

    // VARC breakdown
    const rcGenreMistakes: Record<string, { wrong: number; skip: number; total: number }> = {};
    const vaTypeMistakes: Record<string, { wrong: number; skip: number; total: number }> = {};

    // DILR set type breakdown
    const dilrTypeMistakes: Record<string, { wrong: number; skip: number; total: number }> = {};

    sorted.forEach((m, i) => {
      let wrongQs: any[] = [];

      if (errSection === 'ALL' || errSection === 'VARC') {
        // RC questions
        (m.varc?.rc ?? []).forEach(p => {
          p.qs.forEach(q => {
            const genre = p.type || 'Unknown';
            if (!rcGenreMistakes[genre]) rcGenreMistakes[genre] = { wrong: 0, skip: 0, total: 0 };
            rcGenreMistakes[genre].total++;
            if (q.res === 'W') { rcGenreMistakes[genre].wrong++; wrongQs.push(q); }
            if (q.res === 'S') { rcGenreMistakes[genre].skip++; wrongQs.push(q); }
          });
        });
        // VA questions
        (m.varc?.va ?? []).forEach(v => {
          v.qs.forEach(q => {
            const type = v.type || 'Unknown';
            if (!vaTypeMistakes[type]) vaTypeMistakes[type] = { wrong: 0, skip: 0, total: 0 };
            vaTypeMistakes[type].total++;
            if (q.res === 'W') { vaTypeMistakes[type].wrong++; wrongQs.push(q); }
            if (q.res === 'S') vaTypeMistakes[type].skip++;
          });
        });
      }

      if (errSection === 'ALL' || errSection === 'DILR') {
        (m.dilr?.sets ?? []).forEach(s => {
          if (!s.attempted) return;
          const type = s.type || 'Unknown';
          if (!dilrTypeMistakes[type]) dilrTypeMistakes[type] = { wrong: 0, skip: 0, total: 0 };
          s.qs.forEach(q => {
            dilrTypeMistakes[type].total++;
            if (q.res === 'W') { dilrTypeMistakes[type].wrong++; wrongQs.push(q); }
            if (q.res === 'S') dilrTypeMistakes[type].skip++;
          });
        });
      }

      if (errSection === 'ALL' || errSection === 'QA') {
        (m.qa?.qs ?? []).forEach(q => {
          const subj = q.subj || 'Unknown';
          const topic = q.topic || 'Unknown';
          const key = `${subj}::${topic}`;

          if (!qaSubjMistakes[subj]) qaSubjMistakes[subj] = { wrong: 0, skip: 0, total: 0 };
          qaSubjMistakes[subj].total++;
          if (q.res === 'W') { qaSubjMistakes[subj].wrong++; wrongQs.push(q); }
          if (q.res === 'S') qaSubjMistakes[subj].skip++;

          if (!qaTopicMistakes[key]) qaTopicMistakes[key] = { subj, wrong: 0, skip: 0, total: 0 };
          qaTopicMistakes[key].total++;
          if (q.res === 'W') qaTopicMistakes[key].wrong++;
          if (q.res === 'S') qaTopicMistakes[key].skip++;
        });
      }

      // Reason categorisation
      let sillyCalc = 0;
      wrongQs.filter(q => q.reason).forEach(q => {
        const info = REASON_MAP.get(q.reason as string);
        const cat = info?.cat ?? 'Other';
        const label = info?.label ?? q.reason;
        catCounts[cat] = (catCounts[cat] || 0) + 1;
        if (!reasonCounts[q.reason as string]) {
          reasonCounts[q.reason as string] = { count: 0, label, cat };
        }
        reasonCounts[q.reason as string].count++;
        if (cat === 'Calculation') sillyCalc++;
      });

      trendData.push({ name: `M${i+1}`, sillyCalc });
    });

    const catPieData = Object.entries(catCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value);

    const topReasons = Object.entries(reasonCounts)
      .map(([, v]) => v)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // QA subject data sorted by mistake rate
    const qaSubjData = Object.entries(qaSubjMistakes)
      .filter(([, v]) => v.total > 0)
      .map(([subj, v]) => ({
        name: subj,
        mistakes: v.wrong + v.skip,
        errorRate: Math.round(((v.wrong + v.skip) / v.total) * 100),
        wrong: v.wrong,
        skip: v.skip,
        total: v.total,
      }))
      .sort((a, b) => b.errorRate - a.errorRate);

    // Top worst QA topics
    const qaTopicData = Object.entries(qaTopicMistakes)
      .filter(([, v]) => v.total >= 2)
      .map(([key, v]) => ({
        name: v.subj + ' › ' + key.split('::')[1],
        topic: key.split('::')[1],
        subj: v.subj,
        mistakes: v.wrong + v.skip,
        errorRate: Math.round(((v.wrong + v.skip) / v.total) * 100),
        total: v.total,
      }))
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 8);

    // VARC breakdown
    const rcGenreData = Object.entries(rcGenreMistakes)
      .filter(([, v]) => v.total > 0)
      .map(([name, v]) => ({
        name,
        errorRate: Math.round(((v.wrong) / v.total) * 100),
        wrong: v.wrong,
        total: v.total,
      }))
      .sort((a, b) => b.errorRate - a.errorRate);

    const vaTypeData = Object.entries(vaTypeMistakes)
      .filter(([, v]) => v.total > 0)
      .map(([name, v]) => ({
        name,
        errorRate: Math.round(((v.wrong + v.skip) / v.total) * 100),
        mistakes: v.wrong + v.skip,
        total: v.total,
      }))
      .sort((a, b) => b.errorRate - a.errorRate);

    // DILR breakdown
    const dilrTypeData = Object.entries(dilrTypeMistakes)
      .filter(([, v]) => v.total > 0)
      .map(([name, v]) => ({
        name,
        errorRate: Math.round(((v.wrong + v.skip) / v.total) * 100),
        mistakes: v.wrong + v.skip,
        total: v.total,
      }))
      .sort((a, b) => b.errorRate - a.errorRate);

    // Radar data for overall error profile (normalized 0–100)
    const totalMistakes = Object.values(catCounts).reduce((a, b) => a + b, 0);
    const radarData = ['Concept', 'Calculation', 'Comprehension', 'Time', 'Strategy'].map(cat => ({
      cat,
      value: totalMistakes > 0 ? Math.round(((catCounts[cat] ?? 0) / totalMistakes) * 100) : 0,
    }));

    return {
      catPieData, topReasons, trendData,
      qaSubjData, qaTopicData,
      rcGenreData, vaTypeData, dilrTypeData,
      radarData,
    };
  }, [sorted, errSection]);

  if (mocks.length === 0) {
    return <div className="text-zinc-500 py-12 text-center">No mocks available for analytics. Take some mocks first!</div>;
  }

  return (
    <div className="flex flex-col gap-8">
      {/* 1. KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="flex flex-col gap-1 p-4 bg-zinc-900/50">
          <span className="text-xs text-zinc-500 uppercase">Mocks Taken</span>
          <span className="text-2xl font-bold">{mocks.length}</span>
        </Card>
        <Card className="flex flex-col gap-1 p-4 bg-zinc-900/50">
          <span className="text-xs text-zinc-500 uppercase">Latest Score / %ile</span>
          <span className="text-2xl font-bold text-emerald-400">
            {latest ? (latest.overall?.score ?? (varcScore(latest, mScheme) + dilrScore(latest, mScheme) + qaScore(latest, mScheme))) : 0} 
            <span className="text-sm text-zinc-400 font-normal ml-2">{latest?.overall?.pct ?? '-'}%ile</span>
          </span>
        </Card>
        <Card className="flex flex-col gap-1 p-4 bg-zinc-900/50">
          <span className="text-xs text-zinc-500 uppercase">Best Score</span>
          <span className="text-2xl font-bold text-accent">{bestScore}</span>
        </Card>
        <Card className="flex flex-col gap-1 p-4 bg-zinc-900/50">
          <span className="text-xs text-zinc-500 uppercase">Avg Last 5</span>
          <span className="text-2xl font-bold">{Math.round(avgLast5)}</span>
        </Card>
        <Card className="flex flex-col gap-1 p-4 bg-zinc-900/50">
          <span className="text-xs text-zinc-500 uppercase">Delta (Last 3 vs Prev 3)</span>
          <span className={`text-2xl font-bold ${delta3 > 0 ? 'text-emerald-400' : delta3 < 0 ? 'text-rose-400' : 'text-zinc-400'}`}>
            {delta3 > 0 ? '▲ +' : delta3 < 0 ? '▼ ' : ''}{Math.round(delta3)}
          </span>
        </Card>
      </div>

      {/* 2 & 3. Scores Over Time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="flex flex-col gap-4">
          <h3 className="font-semibold">Overall Score &amp; Percentile</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoreData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} />
                <YAxis yAxisId="left" stroke="#10b981" fontSize={12} domain={[0, 'dataMax + 20']} />
                <YAxis yAxisId="right" orientation="right" stroke="#6366f1" fontSize={12} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <ReferenceLine y={settings.targetPercentile} yAxisId="right" stroke="#6366f1" strokeDasharray="3 3" label={{ position: 'top', value: 'Target %ile', fill: '#6366f1', fontSize: 10 }} />
                <Line yAxisId="left" type="monotone" dataKey="total" name="Score" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line yAxisId="right" type="monotone" dataKey="pct" name="Percentile" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <h3 className="font-semibold">Section Scores</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoreData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} />
                <YAxis stroke="#a1a1aa" fontSize={12} domain={[0, 'dataMax + 10']} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="varc" name="VARC" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="dilr" name="DILR" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="qa" name="QA" stroke="#ec4899" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* 4. Attempts vs Accuracy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="flex flex-col gap-4">
          <h3 className="font-semibold">Attempts per Section</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attAccData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} />
                <YAxis stroke="#a1a1aa" fontSize={12} domain={[0, 24]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="vAtt" name="VARC Att" stroke="#f59e0b" strokeWidth={2} />
                <Line type="monotone" dataKey="dAtt" name="DILR Att" stroke="#8b5cf6" strokeWidth={2} />
                <Line type="monotone" dataKey="qAtt" name="QA Att" stroke="#ec4899" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="flex flex-col gap-4">
          <h3 className="font-semibold">Accuracy per Section (%)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attAccData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} />
                <YAxis stroke="#a1a1aa" fontSize={12} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="vAcc" name="VARC Acc" stroke="#f59e0b" strokeWidth={2} />
                <Line type="monotone" dataKey="dAcc" name="DILR Acc" stroke="#8b5cf6" strokeWidth={2} />
                <Line type="monotone" dataKey="qAcc" name="QA Acc" stroke="#ec4899" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* 5. Time Analysis */}
      <Card className="flex flex-col gap-4">
        <h3 className="font-semibold">Time Analysis</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="h-56">
            <h4 className="text-sm text-zinc-400 text-center mb-2">Unused Time (mins)</h4>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} />
                <YAxis stroke="#a1a1aa" fontSize={12} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#27272a' }} />
                <Legend />
                <Bar dataKey="vU" stackId="a" name="VARC" fill="#f59e0b" />
                <Bar dataKey="dU" stackId="a" name="DILR" fill="#8b5cf6" />
                <Bar dataKey="qU" stackId="a" name="QA" fill="#ec4899" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="h-56 lg:col-span-2">
            <h4 className="text-sm text-zinc-400 text-center mb-2">Avg Time per Correct vs Wrong Answer (seconds)</h4>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} />
                <YAxis stroke="#a1a1aa" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="cAvg" name="Correct Q Time" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="wAvg" name="Wrong Q Time" stroke="#ef4444" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* 6. MISTAKE ANALYSIS — comprehensive section */}
      <Card className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-semibold text-lg">Mistake Analysis</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Where are you losing marks — by section, type, subject &amp; topic</p>
          </div>
          <div className="flex bg-zinc-800 rounded-lg p-1">
            {(['ALL', 'VARC', 'DILR', 'QA'] as const).map(sec => (
              <button
                key={sec}
                onClick={() => setErrSection(sec)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  errSection === sec ? 'bg-zinc-600 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {sec}
              </button>
            ))}
          </div>
        </div>

        {/* Row 1: Error profile radar + category pie + top reasons bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Radar: error profile */}
          <div className="flex flex-col items-center">
            <h4 className="text-sm font-medium text-zinc-300 mb-2">Error Profile</h4>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={mistakeStats.radarData}>
                  <PolarGrid stroke="#27272a" />
                  <PolarAngleAxis dataKey="cat" tick={{ fontSize: 11, fill: '#a1a1aa' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Error %" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                  <Tooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie: error categories */}
          <div className="flex flex-col items-center">
            <h4 className="text-sm font-medium text-zinc-300 mb-2">By Category</h4>
            <div className="h-52 w-full">
              {mistakeStats.catPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mistakeStats.catPieData}
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {mistakeStats.catPieData.map((entry, i) => (
                        <Cell key={i} fill={CAT_COLORS[entry.name] ?? COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-600 text-sm">No data</div>
              )}
            </div>
          </div>

          {/* Top reason badges */}
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-medium text-zinc-300 mb-1">Top Mistake Reasons</h4>
            {mistakeStats.topReasons.length > 0 ? mistakeStats.topReasons.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1 bg-zinc-800 rounded-md px-2 py-1.5 flex items-center gap-2 text-xs">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: CAT_COLORS[r.cat] ?? '#6366f1' }}
                  />
                  <span className="text-zinc-300 flex-1 truncate">{r.label}</span>
                  <span className="font-mono font-semibold text-white ml-auto">{r.count}×</span>
                </div>
              </div>
            )) : (
              <div className="text-zinc-600 text-sm mt-2">No mistakes logged yet.</div>
            )}
          </div>
        </div>

        {/* Row 2: Section-specific breakdowns */}
        <div className="border-t border-zinc-800 pt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* QA Subject Error Rate */}
          {(errSection === 'ALL' || errSection === 'QA') && mistakeStats.qaSubjData.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-pink-500 inline-block" />
                QA — Error Rate by Subject
              </h4>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mistakeStats.qaSubjData} layout="vertical" margin={{ left: 8, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                    <XAxis type="number" stroke="#a1a1aa" fontSize={11} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                    <YAxis dataKey="name" type="category" stroke="#a1a1aa" fontSize={11} width={90} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#27272a' }} />
                    <Bar dataKey="errorRate" name="Error Rate (%)" fill="#ec4899" radius={[0, 4, 4, 0]}>
                      {mistakeStats.qaSubjData.map((_, i) => (
                        <Cell key={i} fill={['#ec4899', '#8b5cf6', '#6366f1', '#f59e0b', '#06b6d4'][i % 5]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* QA Topic deep dive */}
          {(errSection === 'ALL' || errSection === 'QA') && mistakeStats.qaTopicData.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-pink-500 inline-block" />
                QA — Weakest Topics (≥2 attempts)
              </h4>
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                {mistakeStats.qaTopicData.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 bg-zinc-800/60 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-400 truncate">{t.subj}</p>
                      <p className="text-sm font-medium text-zinc-200 truncate">{t.topic}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-zinc-500">{t.total} att</span>
                      <span className={`text-sm font-bold tabular-nums ${t.errorRate >= 60 ? 'text-rose-400' : t.errorRate >= 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {t.errorRate}% err
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VARC RC Genre */}
          {(errSection === 'ALL' || errSection === 'VARC') && mistakeStats.rcGenreData.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                VARC RC — Wrong Rate by Genre
              </h4>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mistakeStats.rcGenreData} layout="vertical" margin={{ left: 8, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                    <XAxis type="number" stroke="#a1a1aa" fontSize={11} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                    <YAxis dataKey="name" type="category" stroke="#a1a1aa" fontSize={10} width={110} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#27272a' }} />
                    <Bar dataKey="errorRate" name="Error Rate (%)" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* VARC VA type */}
          {(errSection === 'ALL' || errSection === 'VARC') && mistakeStats.vaTypeData.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                VARC VA — Error Rate by Type
              </h4>
              <div className="flex flex-col gap-1.5">
                {mistakeStats.vaTypeData.map((t, i) => (
                  <div key={i} className="flex items-center gap-3 bg-zinc-800/60 rounded-lg px-3 py-2">
                    <span className="text-sm font-medium text-zinc-200 flex-1">{t.name}</span>
                    <span className="text-xs text-zinc-500">{t.total} att</span>
                    <div className="w-24 bg-zinc-700 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${Math.min(t.errorRate, 100)}%`,
                          backgroundColor: t.errorRate >= 60 ? '#ef4444' : t.errorRate >= 40 ? '#f59e0b' : '#10b981'
                        }}
                      />
                    </div>
                    <span className={`text-sm font-bold w-12 text-right tabular-nums ${t.errorRate >= 60 ? 'text-rose-400' : t.errorRate >= 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {t.errorRate}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DILR set type */}
          {(errSection === 'ALL' || errSection === 'DILR') && mistakeStats.dilrTypeData.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
                DILR — Error Rate by Set Type
              </h4>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mistakeStats.dilrTypeData} layout="vertical" margin={{ left: 8, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                    <XAxis type="number" stroke="#a1a1aa" fontSize={11} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                    <YAxis dataKey="name" type="category" stroke="#a1a1aa" fontSize={10} width={130} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#27272a' }} />
                    <Bar dataKey="errorRate" name="Error Rate (%)" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Calculation errors trend */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              Calculation &amp; Silly Errors Trend
            </h4>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mistakeStats.trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} />
                  <YAxis stroke="#a1a1aa" fontSize={12} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#27272a' }} />
                  <Bar dataKey="sillyCalc" name="Calc Errors" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
