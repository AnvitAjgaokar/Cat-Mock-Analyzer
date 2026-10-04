import React, { useEffect, useState } from 'react';
import { api } from '../api';
import type { AppSettings } from '../types';
import { Card } from '../ui/Card';
import { NumInput } from '../ui/NumInput';

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getSettings().then(data => setSettings(data as AppSettings));
  }, []);

  if (!settings) return <div className="p-8 text-zinc-400">Loading settings...</div>;

  async function save(newSettings: AppSettings) {
    setSettings(newSettings);
    setSaving(true);
    try {
      await api.updateSettings(newSettings);
    } catch (e) {
      console.error(e);
    }
    setTimeout(() => setSaving(false), 500);
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-3xl">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-zinc-400">Configure global mock parameters.</p>
        </div>
        {saving && <span className="text-sm text-zinc-400">Saving...</span>}
      </div>

      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold text-accent">Goals</h2>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Target Percentile</label>
          <NumInput
            value={settings.targetPercentile}
            onChange={(v) => save({ ...settings, targetPercentile: v })}
            min={0} max={100} step={0.01} decimals={2}
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold text-accent">Marking Scheme (CAT Default)</h2>
        <div className="flex gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Correct</label>
            <NumInput
              value={settings.marking.correct}
              onChange={(v) => save({ ...settings, marking: { ...settings.marking, correct: v } })}
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Wrong</label>
            <NumInput
              value={settings.marking.wrong}
              onChange={(v) => save({ ...settings, marking: { ...settings.marking, wrong: v } })}
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Skip (TITA / Unattempted)</label>
            <NumInput
              value={settings.marking.skip}
              onChange={(v) => save({ ...settings, marking: { ...settings.marking, skip: v } })}
            />
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold text-accent">Section Time Limits (minutes)</h2>
        <div className="flex gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">VARC</label>
            <NumInput
              value={settings.sectionMinutes.varc}
              onChange={(v) => save({ ...settings, sectionMinutes: { ...settings.sectionMinutes, varc: v } })}
              min={1}
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">DILR</label>
            <NumInput
              value={settings.sectionMinutes.dilr}
              onChange={(v) => save({ ...settings, sectionMinutes: { ...settings.sectionMinutes, dilr: v } })}
              min={1}
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">QA</label>
            <NumInput
              value={settings.sectionMinutes.qa}
              onChange={(v) => save({ ...settings, sectionMinutes: { ...settings.sectionMinutes, qa: v } })}
              min={1}
            />
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold text-accent">Score to Percentile Table</h2>
        <p className="text-xs text-zinc-400">Used to estimate percentiles when official percentiles are missing.</p>
        
        <div className="grid grid-cols-2 gap-4">
          {settings.scorePercentileTable.map((row, i) => (
            <div key={i} className="flex gap-2 items-center">
              <NumInput
                value={row.score}
                onChange={(v) => {
                  const newTable = [...settings.scorePercentileTable];
                  newTable[i] = { ...row, score: v };
                  save({ ...settings, scorePercentileTable: newTable });
                }}
              />
              <span className="text-zinc-500">→</span>
              <div className="flex items-center gap-1 bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded text-sm text-zinc-300">
                {row.percentile}%ile
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
