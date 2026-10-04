import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Mock, AppSettings } from '../types';
import { createEmptyMock } from '../utils';
import { StickyBar } from '../components/StickyBar';

import { Info } from './wizard/Info';
import { Varc } from './wizard/Varc';
import { Dilr } from './wizard/Dilr';
import { Qa } from './wizard/Qa';
import { Review } from './wizard/Review';
import { varcScore, dilrScore, qaScore, varcTime, dilrTime, qaTime, accuracy, attempts, normaliseMock, getMissingFields } from '../calc';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const STEPS = [
  { id: 'info', label: '1 Info' },
  { id: 'varc', label: '2 VARC' },
  { id: 'dilr', label: '3 DILR' },
  { id: 'qa',   label: '4 QA' },
  { id: 'review', label: '5 Review' }
] as const;

type StepId = typeof STEPS[number]['id'];

export default function Wizard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [mock, setMock] = useState<Mock | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeStep, setActiveStep] = useState<StepId>('info');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [showValidation, setShowValidation] = useState(false);
  
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const [settingsData, mockData] = await Promise.all([
          api.getSettings(),
          api.getMock(id).catch(async (e) => {
            // If not found, create a new draft if the ID is new (e.g. "new")
            // Actually, we should handle the 'new' keyword properly.
            if (id === 'new') {
              const newId = crypto.randomUUID();
              const newMock = createEmptyMock(newId, '', new Date().toISOString().slice(0,10));
              await api.createMock({ id: newId, ...newMock, data: newMock });
              navigate(`/mock/${newId}`, { replace: true });
              return null; // will reload on navigate
            }
            throw e;
          })
        ]);
        if (mockData) {
          setMock(normaliseMock(mockData.data));
          setSettings(settingsData as AppSettings);
        }
      } catch (err) {
        console.error('Failed to load mock or settings', err);
      }
    }
    load();
  }, [id, navigate]);

  // Debounced auto-save
  const handleMockChange = useCallback((updatedMock: Mock) => {
    setMock(updatedMock);
    setSaveStatus('saving');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await api.updateMock(updatedMock.id, {
          name: updatedMock.name,
          date: updatedMock.date,
          status: updatedMock.status,
          data: updatedMock
        });
        setSaveStatus('saved');
        // Reset saved status back to idle after a few seconds
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) {
        console.error('Autosave failed', err);
        setSaveStatus('error');
      }
    }, 600);
  }, []);

  if (!mock || !settings) {
    return <div className="p-8 text-zinc-400">Loading...</div>;
  }

  // Calculate sections for StickyBar
  const m = settings.marking;
  const l = settings.sectionMinutes;

  const rcQs = mock.varc.rc.flatMap(p => p.attempted ? p.qs : p.qs.map(q => ({ ...q, res: 'S' as const })));
  const vaQs = mock.varc.va.flatMap(v => v.qs);
  const dilrQs = mock.dilr.sets.flatMap(s => s.attempted ? s.qs : s.qs.map(q => ({ ...q, res: 'S' as const })));
  const qaQs = mock.qa.qs;

  const varcAtt = attempts([...rcQs, ...vaQs]);
  const dilrAtt = attempts(dilrQs);
  const qaAtt = attempts(qaQs);

  const sections = [
    {
      label: 'VARC',
      usedSecs: varcTime(mock),
      limitSecs: l.varc * 60,
      attempts: varcAtt,
      accuracy: accuracy([...rcQs, ...vaQs]),
      marks: varcScore(mock, m)
    },
    {
      label: 'DILR',
      usedSecs: dilrTime(mock),
      limitSecs: l.dilr * 60,
      attempts: dilrAtt,
      accuracy: accuracy(dilrQs),
      marks: dilrScore(mock, m)
    },
    {
      label: 'QA',
      usedSecs: qaTime(mock),
      limitSecs: l.qa * 60,
      attempts: qaAtt,
      accuracy: accuracy(qaQs),
      marks: qaScore(mock, m)
    }
  ];

  const missingFields = getMissingFields(mock);

  // Step heuristics for completion
  const stepStatus = {
    info: !missingFields.some(m => m.section === 'info'),
    varc: !missingFields.some(m => m.section === 'varc'),
    dilr: !missingFields.some(m => m.section === 'dilr'),
    qa: !missingFields.some(m => m.section === 'qa'),
    review: mock.status === 'complete'
  };

  return (
    <div className="flex flex-col md:flex-row pb-24 h-full min-h-[calc(100vh-65px)]">
      {/* Sidebar Stepper */}
      <aside className="w-full md:w-48 flex-shrink-0 border-b md:border-b-0 md:border-r border-zinc-800 p-4 sticky top-0 bg-zinc-950 z-10 md:h-[calc(100vh-65px)]">
        <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible">
          {STEPS.map(step => {
            const active = activeStep === step.id;
            const complete = stepStatus[step.id as keyof typeof stepStatus];
            return (
              <button
                key={step.id}
                onClick={() => setActiveStep(step.id)}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg whitespace-nowrap transition-colors text-left ${
                  active ? 'bg-accent/20 text-accent font-medium' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <span>{step.label}</span>
                {complete && <span className="text-emerald-500 ml-auto text-xs">✓</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {activeStep === 'info' && <Info mock={mock} onChange={handleMockChange} showValidation={showValidation} />}
        {activeStep === 'varc' && <Varc mock={mock} onChange={handleMockChange} marking={settings.marking} showValidation={showValidation} />}
        {activeStep === 'dilr' && <Dilr mock={mock} onChange={handleMockChange} marking={settings.marking} showValidation={showValidation} />}
        {activeStep === 'qa'   && <Qa mock={mock} onChange={handleMockChange} marking={settings.marking} showValidation={showValidation} />}
        {activeStep === 'review' && (
          <Review
            mock={mock}
            onChange={handleMockChange}
            marking={settings.marking}
            limits={settings.sectionMinutes}
            pctTable={settings.scorePercentileTable}
            missingFields={missingFields}
            onSetValidation={() => setShowValidation(true)}
            onGoToStep={(step) => setActiveStep(step as StepId)}
          />
        )}
      </main>

      <StickyBar sections={sections} saveStatus={saveStatus} />
    </div>
  );
}
