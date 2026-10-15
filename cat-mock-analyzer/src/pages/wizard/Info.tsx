import React, { useState } from 'react';
import type { Mock } from '../../types';
import { Select } from '../../ui/Select';
import { SOURCES } from '../../data/options';
import { Card } from '../../ui/Card';

interface InfoProps {
  mock: Mock;
  onChange: (mock: Mock) => void;
  showValidation?: boolean;
}

export function Info({ mock, onChange, showValidation = false }: InfoProps) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  function markTouched(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  const nameError = (showValidation || touched.name) && !mock.name;
  const dateError = (showValidation || touched.date) && !mock.date;

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-bold mb-4">1. Basic Info</h2>
      <Card className="flex flex-col gap-4">
        <div className="relative">
          <label className="block text-sm text-zinc-400 mb-1">Mock Name</label>
          <input
            type="text"
            value={mock.name}
            onChange={(e) => onChange({ ...mock, name: e.target.value })}
            onBlur={() => markTouched('name')}
            placeholder="e.g. SIMCAT 1"
            className={`w-full bg-zinc-800 border ${nameError ? 'border-rose-500' : 'border-zinc-700'} rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent`}
          />
          {nameError && <span className="absolute top-0 right-0 text-xs text-rose-500">Required</span>}
        </div>
        
        <div className="relative">
          <label className="block text-sm text-zinc-400 mb-1">Date Taken</label>
          <input
            type="date"
            value={mock.date}
            onChange={(e) => onChange({ ...mock, date: e.target.value })}
            onBlur={() => markTouched('date')}
            className={`w-full bg-zinc-800 border ${dateError ? 'border-rose-500' : 'border-zinc-700'} rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent`}
          />
          {dateError && <span className="absolute top-0 right-0 text-xs text-rose-500">Required</span>}
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Source</label>
          <Select
            value={mock.source ?? ''}
            onChange={(v) => onChange({ ...mock, source: v })}
            options={[
              { value: '', label: 'Select source…' },
              ...SOURCES.map((s) => ({ value: s, label: s }))
            ]}
            className="w-full py-2"
          />
        </div>
      </Card>
    </div>
  );
}

export default Info;
