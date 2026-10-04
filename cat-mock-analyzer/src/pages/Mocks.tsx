import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Mock, AppSettings } from '../types';
import { Card, Chip } from '../ui/Card';
import { 
  varcScore, dilrScore, qaScore, accuracy, attempts, 
  varcTime, dilrTime, qaTime, fmtSecs 
} from '../calc';

export default function Mocks() {
  const navigate = useNavigate();
  const [mocks, setMocks] = useState<Mock[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'date' | 'score' | 'pct'>('date');
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    async function load() {
      const [mData, sData] = await Promise.all([
        api.getMocks(),
        api.getSettings()
      ]);
      setMocks(mData);
      setSettings(sData as AppSettings);
    }
    load();
  }, []);

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    await api.deleteMock(id);
    setMocks(mocks.filter(m => m.id !== id));
  }

  async function handleDuplicate(mock: Mock) {
    const newId = crypto.randomUUID();
    const newMock: Mock = {
      ...mock,
      id: newId,
      name: `${mock.name} (Copy)`,
      status: 'draft',
      date: new Date().toISOString().slice(0, 10),
    };
    await api.createMock({ id: newId, ...newMock, data: newMock });
    navigate(`/mock/${newId}`);
  }

  const filteredAndSorted = useMemo(() => {
    if (!settings) return [];
    
    // Filter
    let res = mocks.filter(m => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        m.name.toLowerCase().includes(s) || 
        (m.source && m.source.toLowerCase().includes(s)) ||
        m.date.includes(s)
      );
    });

    // Sort
    const mScheme = settings.marking;
    res.sort((a, b) => {
      let valA: number, valB: number;
      if (sortField === 'date') {
        valA = new Date(a.date).getTime();
        valB = new Date(b.date).getTime();
      } else if (sortField === 'score') {
        valA = a.overall?.score ?? (varcScore(a, mScheme) + dilrScore(a, mScheme) + qaScore(a, mScheme));
        valB = b.overall?.score ?? (varcScore(b, mScheme) + dilrScore(b, mScheme) + qaScore(b, mScheme));
      } else {
        valA = a.overall?.pct ?? 0;
        valB = b.overall?.pct ?? 0;
      }
      return sortDesc ? valB - valA : valA - valB;
    });

    return res;
  }, [mocks, search, sortField, sortDesc, settings]);

  if (!settings) return <div className="p-8 text-zinc-400">Loading mocks...</div>;

  const mScheme = settings.marking;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mocks</h1>
          <p className="text-sm text-zinc-400">{mocks.length} total mock{mocks.length !== 1 ? 's' : ''} logged.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search mocks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent w-48 md:w-64"
          />
          <button
            onClick={() => navigate('/mock/new')}
            className="bg-accent hover:bg-accent-600 text-white px-4 py-1.5 rounded font-medium text-sm transition-colors"
          >
            + New
          </button>
        </div>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50 text-xs text-zinc-400 uppercase tracking-wide">
              <th className="p-3 font-medium cursor-pointer hover:text-white transition-colors" onClick={() => { setSortField('date'); setSortDesc(!sortDesc); }}>
                Date/Name {sortField === 'date' && (sortDesc ? '↓' : '↑')}
              </th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium text-right cursor-pointer hover:text-white transition-colors" onClick={() => { setSortField('score'); setSortDesc(!sortDesc); }}>
                Score {sortField === 'score' && (sortDesc ? '↓' : '↑')}
              </th>
              <th className="p-3 font-medium text-right cursor-pointer hover:text-white transition-colors" onClick={() => { setSortField('pct'); setSortDesc(!sortDesc); }}>
                %ile {sortField === 'pct' && (sortDesc ? '↓' : '↑')}
              </th>
              <th className="p-3 font-medium text-right">Acc</th>
              <th className="p-3 font-medium text-right">Time</th>
              <th className="p-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-zinc-800/50">
            {filteredAndSorted.map(m => {
              // Calc aggregate stats
              const tScore = m.overall?.score ?? (varcScore(m, mScheme) + dilrScore(m, mScheme) + qaScore(m, mScheme));
              
              const rcQs = (m.varc?.rc ?? []).flatMap(p => p.attempted ? p.qs : p.qs.map(q => ({ ...q, res: 'S' as const })));
              const vaQs = (m.varc?.va ?? []).flatMap(v => v.qs);
              const dilrQs = (m.dilr?.sets ?? []).flatMap(s => s.attempted ? s.qs : s.qs.map(q => ({ ...q, res: 'S' as const })));
              const qaQs = m.qa?.qs ?? [];
              const allQs = [...rcQs, ...vaQs, ...dilrQs, ...qaQs];
              
              const totalAcc = accuracy(allQs);
              const tTime = varcTime(m) + dilrTime(m) + qaTime(m);

              return (
                <tr key={m.id} className="hover:bg-zinc-900/30 transition-colors group">
                  <td className="p-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-zinc-200">{m.name || 'Unnamed'}</span>
                      <span className="text-xs text-zinc-500">{new Date(m.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} {m.source ? `• ${m.source}` : ''}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    {m.status === 'complete' 
                      ? <Chip size="xs" label="Done" variant="success" /> 
                      : <Chip size="xs" label="Draft" variant="warning" />}
                  </td>
                  <td className="p-3 text-right font-bold tabular-nums text-emerald-400">{tScore}</td>
                  <td className="p-3 text-right tabular-nums text-zinc-300">{m.overall?.pct ?? '-'}</td>
                  <td className="p-3 text-right tabular-nums text-zinc-400">{Math.round(totalAcc * 100)}%</td>
                  <td className="p-3 text-right font-mono text-zinc-500">{fmtSecs(tTime)}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => navigate(`/mock/${m.id}`)}
                        className="text-accent hover:text-accent-400 font-medium px-2 py-1 rounded hover:bg-accent/10 transition-colors"
                      >
                        Open
                      </button>
                      <button 
                        onClick={() => handleDuplicate(m)}
                        className="text-zinc-400 hover:text-white px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
                        title="Duplicate as template"
                      >
                        Copy
                      </button>
                      <button 
                        onClick={() => handleDelete(m.id, m.name)}
                        className="text-rose-400 hover:text-rose-300 px-2 py-1 rounded hover:bg-rose-400/10 transition-colors"
                      >
                        Del
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredAndSorted.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-zinc-500">
                  {search ? 'No mocks match your search.' : 'No mocks found. Add your first mock!'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
