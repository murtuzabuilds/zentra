// Zentra's focus engine: plans, sessions, distractions, XP and streaks. Pure and testable.
export const PLANS = [
  { id: 'deep', name: 'Deep work', focus: 25, rest: 5, sessions: 3, color: '#CEA8FB' },
  { id: 'sprint', name: 'Quick sprint', focus: 15, rest: 3, sessions: 4, color: '#FFE3A1' },
  { id: 'study', name: 'Study block', focus: 50, rest: 10, sessions: 2, color: '#BFDDF8' },
];

export function newSession(plan, now = Date.now()) {
  return { plan: plan.id, lengthMs: plan.focus * 60000, startedAt: now, elapsedMs: 0, running: true, distractions: [], done: false };
}

export function tick(s, now) {
  if (!s.running || s.done) return s;
  const elapsed = s.elapsedMs + (now - s.startedAt);
  if (elapsed >= s.lengthMs) return { ...s, elapsedMs: s.lengthMs, running: false, done: true };
  return { ...s, elapsedMs: elapsed, startedAt: now };
}

export function distract(s, app, now) {
  const t = tick(s, now);
  return { ...t, running: false, distractions: [...t.distractions, { app, at: now }] };
}
export const resume = (s, now) => ({ ...s, running: true, startedAt: now });
export const remaining = s => Math.max(0, s.lengthMs - s.elapsedMs);

// XP: 1 per focused minute, +10 for a clean session, streak multiplier up to 1.5x
export function xpFor(s, streak = 0) {
  const minutes = Math.floor(s.elapsedMs / 60000);
  const clean = s.done && s.distractions.length === 0 ? 10 : 0;
  const mult = Math.min(1.5, 1 + streak * 0.05);
  return Math.round((minutes + clean) * mult);
}

export function level(xp) {
  let lvl = 1, need = 100, left = xp;
  while (left >= need) { left -= need; lvl++; need = Math.round(need * 1.25); }
  return { level: lvl, into: left, need };
}

export function streak(days, today) {
  const set = new Set(days); let n = 0;
  let d = new Date(today + 'T12:00:00Z');
  if (!set.has(today)) d = new Date(d.getTime() - 864e5);
  while (set.has(d.toISOString().slice(0, 10))) { n++; d = new Date(d.getTime() - 864e5); }
  return n;
}

export const BADGES = [
  { id: 'first', name: 'First focus', test: st => st.sessions >= 1 },
  { id: 'clean', name: 'Zero distractions', test: st => st.cleanSessions >= 1 },
  { id: 'streak3', name: '3-day streak', test: st => st.streak >= 3 },
  { id: 'streak7', name: '7-day streak', test: st => st.streak >= 7 },
  { id: 'hour', name: 'Hour of focus', test: st => st.minutes >= 60 },
  { id: 'level3', name: 'Level 3', test: st => level(st.xp).level >= 3 },
];

// Plan recommendation: a rule over the last five sessions, no model involved.
// recent = [{ distractions: number, done: boolean }], oldest first.
export function recommend(recent = []) {
  const last = recent.slice(-5), of = last.length;
  const drifted = last.filter(s => s.distractions > 0).length;
  const finished = last.filter(s => s.done).length;
  const base = { of, drifted, finished };
  if (of < 3) return { plan: 'deep', reason: 'new', ...base };
  if (drifted >= 3 || of - finished >= 3) return { plan: 'sprint', reason: 'drift', ...base };
  if (drifted === 0 && finished === of && of === 5) return { plan: 'study', reason: 'clean', ...base };
  return { plan: 'deep', reason: 'steady', ...base };
}

// Smart reminder: which nudge fits today's progress. Returns null once the goal is met.
export function nudge({ doneToday = 0, goal = 3, streak = 0, focus = 25 } = {}) {
  if (doneToday >= goal) return null;
  if (doneToday === 0 && streak > 0) return { kind: 'streak', streak, left: goal, focus };
  if (doneToday === 0) return { kind: 'start', streak: 0, left: goal, focus };
  return { kind: 'left', streak, left: goal - doneToday, focus };
}
