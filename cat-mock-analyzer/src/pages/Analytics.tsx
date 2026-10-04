import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import type { Mock, AppSettings } from '../types';
import { Dashboard1To6 } from './analytics/Dashboard1To6';
import { Dashboard7To11 } from './analytics/Dashboard7To11';
import { generateInsights } from '../insights';

type RangeFilter = '5' | '10' | 'ALL' | 'CUSTOM';

export default function Analytics() {
  const [allMocks, setAllMocks] = useState<Mock[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Global Filters
  const [range, setRange] = useState<RangeFilter>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sourceFilter, setSourceFilter] = useState('ALL');

  useEffect(() => {
    async function load() {
      const [mData, sData] = await Promise.all([
        api.getMocks(),
        api.getSettings()
      ]);
      // Only include completed mocks for analytics
      const completes = mData.filter(m => m.status === 'complete');
      // Sort oldest to newest globally
      completes.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setAllMocks(completes);
      setSettings(sData as AppSettings);
    }
    load();
  }, []);

  const sources = useMemo(() => {
    const s = new Set(allMocks.map(m => m.source).filter(Boolean));
    return Array.from(s) as string[];
  }, [allMocks]);

  const filteredMocks = useMemo(() => {
    let res = [...allMocks];

    // Source filter
    if (sourceFilter !== 'ALL') {
      res = res.filter(m => m.source === sourceFilter);
    }

    // Range / Date filter
    if (range === '5') {
      res = res.slice(-5);
    } else if (range === '10') {
      res = res.slice(-10);
    } else if (range === 'CUSTOM') {
      if (dateFrom) res = res.filter(m => m.date >= dateFrom);
      if (dateTo) res = res.filter(m => m.date <= dateTo);
    }

    return res;
  }, [allMocks, range, dateFrom, dateTo, sourceFilter]);

  if (!settings) return <div className="p-8 text-zinc-400">Loading analytics...</div>;

  const insights = generateInsights(filteredMocks, settings);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-zinc-800 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics Engine</h1>
          <p className="text-sm text-zinc-400">Insights across {filteredMocks.length} completed mock(s).</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-zinc-900/50 p-2 rounded-lg border border-zinc-800/50">
          <select 
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none"
            value={range}
            onChange={(e) => setRange(e.target.value as RangeFilter)}
          >
            <option value="ALL">All Time</option>
            <option value="5">Last 5 Mocks</option>
            <option value="10">Last 10 Mocks</option>
            <option value="CUSTOM">Custom Date</option>
          </select>

          {range === 'CUSTOM' && (
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm focus:outline-none" 
              />
              <span className="text-zinc-500">to</span>
              <input 
                type="date" 
                value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm focus:outline-none" 
              />
            </div>
          )}

          <select
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none max-w-[150px]"
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
          >
            <option value="ALL">All Sources</option>
            {sources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {insights.length > 0 && (
        <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 flex flex-col gap-2">
          <h2 className="text-accent font-semibold flex items-center gap-2">
            <span className="text-xl">💡</span> AI Insights
          </h2>
          <ul className="list-disc list-inside text-sm text-zinc-300 space-y-1">
            {insights.map((insight, idx) => (
              <li key={idx}>{insight}</li>
            ))}
          </ul>
        </div>
      )}

      <Dashboard1To6 mocks={filteredMocks} settings={settings} />
      
      <Dashboard7To11 mocks={filteredMocks} settings={settings} />
    </div>
  );
}
