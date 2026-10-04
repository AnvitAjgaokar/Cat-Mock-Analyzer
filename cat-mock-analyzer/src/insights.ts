import type { Mock, AppSettings } from './types';
import { varcTime, dilrTime, qaTime, accuracy } from './calc';
import { WRONG_REASONS_COMMON, WRONG_REASONS_RC, WRONG_REASONS_VA, WRONG_REASONS_DILR } from './data/options';

export function generateInsights(mocks: Mock[], settings: AppSettings): string[] {
  if (mocks.length < 2) return ['Take a few more mocks to generate actionable insights.'];
  
  const insights: string[] = [];
  
  // Sort chronologically
  const sorted = [...mocks].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const last5 = sorted.slice(-5);
  const limits = settings.sectionMinutes;

  // 1. Unused Time (DILR leaving sets early)
  const avgDilrUnused = last5.reduce((sum, m) => Math.max(0, sum + (limits.dilr * 60 - dilrTime(m))), 0) / last5.length;
  if (avgDilrUnused > 360) { // > 6 minutes
    insights.push(`DILR unused time averages ${Math.round(avgDilrUnused/60)} mins over the last ${last5.length} mocks. You might be abandoning sets too early.`);
  }

  // 2. Silly/Calculation Errors Trend
  const rMap = Object.fromEntries([...WRONG_REASONS_COMMON, ...WRONG_REASONS_RC, ...WRONG_REASONS_VA, ...WRONG_REASONS_DILR].map(r => [r.value, r.cat]));
  
  let recentSilly = 0;
  let olderSilly = 0;
  
  if (last5.length >= 3) {
    const recent = last5.slice(-2);
    const older = last5.slice(-4, -2);
    
    const countSilly = (ms: Mock[]) => {
      let count = 0;
      ms.forEach(m => {
        const qs = [
          ...(m.varc?.rc ?? []).flatMap(p => p.attempted ? p.qs : []),
          ...(m.varc?.va ?? []).flatMap(v => v.qs),
          ...(m.dilr?.sets ?? []).flatMap(s => s.attempted ? s.qs : []),
          ...(m.qa?.qs ?? [])
        ];
        qs.forEach(q => {
          if (q.res === 'W' && q.reason) {
            const cat = rMap[q.reason];
            if (cat === 'Silly' || cat === 'Calculation') count++;
          }
        });
      });
      return count / ms.length;
    };
    
    recentSilly = countSilly(recent);
    olderSilly = countSilly(older);
    
    if (recentSilly > olderSilly && recentSilly > 3) {
      insights.push(`Silly and calculation errors are trending UP (averaging ${recentSilly.toFixed(1)} per mock recently). Review your scratchpad hygiene.`);
    }
  }

  // 3. QA Subject Accuracy
  const subjectStats: Record<string, { att: number; cor: number }> = {};
  last5.forEach(m => {
    (m.qa?.qs ?? []).forEach(q => {
      if (!q.subj) return;
      if (!subjectStats[q.subj]) subjectStats[q.subj] = { att: 0, cor: 0 };
      if (q.res === 'C' || q.res === 'W') subjectStats[q.subj].att++;
      if (q.res === 'C') subjectStats[q.subj].cor++;
    });
  });

  Object.entries(subjectStats).forEach(([subj, stats]) => {
    if (stats.att >= 10) {
      const acc = stats.cor / stats.att;
      if (acc < 0.5) {
        insights.push(`Your ${subj} accuracy is low (${Math.round(acc*100)}%) across the last few mocks. Consider revising fundamentals.`);
      }
      if (acc > 0.8) {
        insights.push(`Great job in ${subj}! Accuracy is stellar (${Math.round(acc*100)}%). Keep it up.`);
      }
    }
  });

  // 4. Time Management (Time per correct vs wrong)
  let cTimeSum = 0, cTimeCount = 0;
  let wTimeSum = 0, wTimeCount = 0;

  last5.forEach(m => {
    const qs = [
      ...(m.varc?.rc ?? []).flatMap(p => p.attempted ? p.qs : []),
      ...(m.varc?.va ?? []).flatMap(v => v.qs),
      ...(m.dilr?.sets ?? []).flatMap(s => s.attempted ? s.qs : []),
      ...(m.qa?.qs ?? [])
    ];
    
    qs.forEach(q => {
      if ((q.t ?? 0) > 0) {
        if (q.res === 'C') { cTimeSum += q.t!; cTimeCount++; }
        if (q.res === 'W') { wTimeSum += q.t!; wTimeCount++; }
      }
    });
  });

  if (cTimeCount > 0 && wTimeCount > 0) {
    const avgC = cTimeSum / cTimeCount;
    const avgW = wTimeSum / wTimeCount;
    if (avgW > avgC * 1.5 && avgW > 120) {
      insights.push(`You are spending significantly more time on questions you get wrong (${Math.round(avgW)}s) than those you get right (${Math.round(avgC)}s). Learn to let go faster.`);
    }
  }

  // 5. RC vs VA performance gap
  let rcC = 0, rcA = 0;
  let vaC = 0, vaA = 0;
  last5.forEach(m => {
    const rcQs = (m.varc?.rc ?? []).flatMap(p => p.attempted ? p.qs : []);
    const vaQs = (m.varc?.va ?? []).flatMap(v => v.qs);
    rcA += rcQs.filter(q => q.res === 'C' || q.res === 'W').length;
    rcC += rcQs.filter(q => q.res === 'C').length;
    vaA += vaQs.filter(q => q.res === 'C' || q.res === 'W').length;
    vaC += vaQs.filter(q => q.res === 'C').length;
  });

  if (rcA > 10 && vaA > 5) {
    const rcAcc = rcC / rcA;
    const vaAcc = vaC / vaA;
    if (rcAcc - vaAcc > 0.3) insights.push(`Strong RC performance but VA is lagging (${Math.round(vaAcc*100)}% accuracy). Focus on VA practice.`);
    if (vaAcc - rcAcc > 0.3) insights.push(`Strong VA performance but RC is lagging (${Math.round(rcAcc*100)}% accuracy). Focus on reading speed and comprehension.`);
  }

  // Fallback
  if (insights.length === 0) {
    insights.push("Consistency is key. Keep logging more mocks to unlock detailed insights.");
  }

  return insights.slice(0, 5); // Max 5
}
