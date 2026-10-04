import React, { useState, useMemo } from 'react';
import type { Mock, AppSettings } from '../../types';
import { Card, Stat } from '../../ui/Card';
import { varcScore, dilrScore, qaScore, accuracy, attempts, varcTime, dilrTime, qaTime, fmtSecs } from '../../calc';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ReferenceLine, BarChart, Bar, PieChart, Pie, Cell 
} from 'recharts';
import { WRONG_REASONS_COMMON, WRONG_REASONS_RC, WRONG_REASONS_VA, WRONG_REASONS_DILR } from '../../data/options';

// ── Colors ──
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const CHART_STYLE = { backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' };

interface Props {
  mocks: Mock[];
  settings: AppSettings;
}

export function Dashboard1To6({ mocks, settings }: Props) {
  const mScheme = settings.marking;
  
  // Sort mocks chronologically for charts (oldest to newest)
  const sorted = [...mocks].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // 1. KPIs
  // For latest/best, we use the sorted array (last = latest)
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
    
    // Unused time
    const vU = Math.max(0, limits.varc * 60 - vt);
    const dU = Math.max(0, limits.dilr * 60 - dt);
    const qU = Math.max(0, limits.qa * 60 - qt);

    // Time per correct vs wrong
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
      cAvg, wAvg
    };
  });

  // 6. Error Analysis
  const [errSection, setErrSection] = useState<'ALL'|'VARC'|'DILR'|'QA'>('ALL');

  const errorStats = useMemo(() => {
    const allReasons = [...WRONG_REASONS_COMMON, ...WRONG_REASONS_RC, ...WRONG_REASONS_VA, ...WRONG_REASONS_DILR];
    const rMap = Object.fromEntries(allReasons.map(r => [r.value, r.cat]));

    const catCounts: Record<string, number> = {};
    const reasonCounts: Record<string, number> = {};
    const trendData: any[] = [];

    sorted.forEach((m, i) => {
      let qs: any[] = [];
      if (errSection === 'ALL' || errSection === 'VARC') {
        qs.push(...(m.varc?.rc ?? []).flatMap(p => p.attempted ? p.qs : []));
        qs.push(...(m.varc?.va ?? []).flatMap(v => v.qs));
      }
      if (errSection === 'ALL' || errSection === 'DILR') {
        qs.push(...(m.dilr?.sets ?? []).flatMap(s => s.attempted ? s.qs : []));
      }
      if (errSection === 'ALL' || errSection === 'QA') {
        qs.push(...(m.qa?.qs ?? []));
      }

      const wQs = qs.filter(q => q.res === 'W' && q.reason);
      
      let sillyCalc = 0;
      wQs.forEach(q => {
        const cat = rMap[q.reason as string] || 'Other';
        catCounts[cat] = (catCounts[cat] || 0) + 1;
        reasonCounts[q.reason as string] = (reasonCounts[q.reason as string] || 0) + 1;
        if (cat === 'Calculation' || cat === 'Silly') sillyCalc++;
      });

      trendData.push({ name: `M${i+1}`, sillyCalc });
    });

    const pieData = Object.entries(catCounts).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value);
    const barData = Object.entries(reasonCounts).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value).slice(0, 10);

    return { pieData, barData, trendData };
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
          <h3 className="font-semibold">Overall Score & Percentile</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoreData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} />
                <YAxis yAxisId="left" stroke="#10b981" fontSize={12} domain={[0, 'dataMax + 20']} />
                <YAxis yAxisId="right" orientation="right" stroke="#6366f1" fontSize={12} domain={[0, 100]} />
                <Tooltip contentStyle={CHART_STYLE} />
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
                <Tooltip contentStyle={CHART_STYLE} />
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
                <Tooltip contentStyle={CHART_STYLE} />
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
                <Tooltip contentStyle={CHART_STYLE} />
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
                <Tooltip contentStyle={CHART_STYLE} cursor={{ fill: '#27272a' }} />
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
                <Tooltip contentStyle={CHART_STYLE} />
                <Legend />
                <Line type="monotone" dataKey="cAvg" name="Correct Q Time" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="wAvg" name="Wrong Q Time" stroke="#ef4444" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* 6. Error Analysis */}
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Error Analysis</h3>
          <select 
            value={errSection} 
            onChange={e => setErrSection(e.target.value as any)}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white focus:outline-none"
          >
            <option value="ALL">All Sections</option>
            <option value="VARC">VARC</option>
            <option value="DILR">DILR</option>
            <option value="QA">QA</option>
          </select>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="h-64 flex flex-col items-center">
            <h4 className="text-sm text-zinc-400 text-center mb-2">Error Categories</h4>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={errorStats.pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {errorStats.pieData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={CHART_STYLE} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="h-64">
            <h4 className="text-sm text-zinc-400 text-center mb-2">Top Reasons</h4>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={errorStats.barData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis type="number" stroke="#a1a1aa" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="#a1a1aa" fontSize={10} width={80} />
                <Tooltip contentStyle={CHART_STYLE} cursor={{ fill: '#27272a' }} />
                <Bar dataKey="value" name="Count" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="h-64">
            <h4 className="text-sm text-zinc-400 text-center mb-2">Silly + Calculation Errors</h4>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={errorStats.trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} />
                <YAxis stroke="#a1a1aa" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={CHART_STYLE} cursor={{ fill: '#27272a' }} />
                <Bar dataKey="sillyCalc" name="Count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>
    </div>
  );
}
