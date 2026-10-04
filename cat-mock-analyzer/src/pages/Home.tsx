import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Mock, AppSettings } from '../types';
import { Card, Stat, Chip } from '../ui/Card';
import { varcScore, dilrScore, qaScore, accuracy, varcTime, dilrTime, qaTime, fmtSecs } from '../calc';

export default function Home() {
  const navigate = useNavigate();
  const [mocks, setMocks] = useState<Mock[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    async function load() {
      const [mData, sData] = await Promise.all([
        api.getMocks(),
        api.getSettings()
      ]);
      // Sort newest first
      const sorted = mData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setMocks(sorted);
      setSettings(sData as AppSettings);
    }
    load();
  }, []);

  if (!settings) return <div className="p-8 text-zinc-400">Loading...</div>;

  const drafts = mocks.filter(m => m.status === 'draft');
  const latestDraft = drafts[0]; // since sorted by date
  
  const completes = mocks.filter(m => m.status === 'complete');
  const latestComplete = completes[0];

  const m = settings.marking;

  // KPIs
  const avgScore = completes.length > 0
    ? Math.round(completes.reduce((sum, mock) => sum + (mock.overall?.score ?? (varcScore(mock, m) + dilrScore(mock, m) + qaScore(mock, m))), 0) / completes.length)
    : 0;

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-zinc-400">Track and analyze your CAT mocks to crush the 99th percentile.</p>
        </div>
        <button
          onClick={() => navigate('/mock/new')}
          className="bg-accent hover:bg-accent-600 text-white px-6 py-3 rounded-xl font-medium transition-colors shadow-lg shadow-accent/20"
        >
          + New Mock
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-zinc-900/50">
          <Stat label="Total Mocks Taken" value={completes.length.toString()} />
        </Card>
        <Card className="bg-zinc-900/50">
          <Stat label="Average Score" value={avgScore.toString()} />
        </Card>
        <Card className="bg-zinc-900/50">
          <Stat label="Target Percentile" value={settings.targetPercentile.toString()} />
        </Card>
      </div>

      {latestDraft && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-zinc-300">Resume Draft</h2>
          <Card 
            className="cursor-pointer hover:border-accent/50 transition-colors bg-amber-500/5 border-amber-500/20"
            onClick={() => navigate(`/mock/${latestDraft.id}`)}
          >
            <div className="flex justify-between items-center">
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-lg text-amber-500">{latestDraft.name || 'Unnamed Draft'}</span>
                <span className="text-sm text-zinc-400">{new Date(latestDraft.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
              <div className="flex items-center gap-4">
                <Chip label="Draft" variant="warning" />
                <span className="text-zinc-500">→</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {latestComplete && (() => {
        const tScore = latestComplete.overall?.score ?? (varcScore(latestComplete, m) + dilrScore(latestComplete, m) + qaScore(latestComplete, m));
        return (
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-zinc-300">Latest Performance</h2>
            <Card className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex flex-col gap-1 md:w-1/3">
                <span className="font-semibold text-lg">{latestComplete.name}</span>
                <span className="text-sm text-zinc-400">{new Date(latestComplete.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                <div className="mt-2">
                  <button 
                    onClick={() => navigate(`/mock/${latestComplete.id}`)}
                    className="text-sm text-accent hover:text-accent-400"
                  >
                    View Analysis →
                  </button>
                </div>
              </div>
              
              <div className="flex gap-8 items-center md:w-2/3 justify-around md:justify-end border-t md:border-t-0 md:border-l border-zinc-800 pt-4 md:pt-0 md:pl-8 w-full">
                <div className="flex flex-col gap-1 items-center">
                  <span className="text-xs text-zinc-500 uppercase tracking-wide">Score</span>
                  <span className="text-3xl font-bold text-emerald-400 tabular-nums">{tScore}</span>
                </div>
                <div className="flex flex-col gap-1 items-center">
                  <span className="text-xs text-zinc-500 uppercase tracking-wide">%ile</span>
                  <span className="text-3xl font-bold tabular-nums">{latestComplete.overall?.pct ?? '-'}</span>
                </div>
              </div>
            </Card>
          </div>
        );
      })()}

      {!latestComplete && !latestDraft && (
        <div className="mt-8 text-center p-12 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
          <p className="text-3xl mb-4">🚀</p>
          <h2 className="text-xl font-bold text-white mb-2">No mocks logged yet</h2>
          <p className="text-zinc-400 mb-6">Start tracking your CAT preparation by adding your first mock test.</p>
          <button
            onClick={() => navigate('/mock/new')}
            className="bg-zinc-100 hover:bg-white text-zinc-900 px-6 py-2.5 rounded font-medium transition-colors"
          >
            Log First Mock
          </button>
        </div>
      )}
    </div>
  );
}
