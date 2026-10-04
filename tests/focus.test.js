import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANS, newSession, tick, distract, resume, remaining, xpFor, level, streak, BADGES } from '../src/focus.js';

const deep = PLANS[0];
test('a session counts down and completes', () => {
  let s = newSession(deep, 0); s = tick(s, 10 * 60000);
  assert.equal(remaining(s), 15 * 60000); s = tick(s, 26 * 60000);
  assert.ok(s.done && !s.running);
});
test('leaving the app pauses the session and logs the distraction', () => {
  let s = distract(newSession(deep, 0), 'TikTok', 5 * 60000);
  assert.equal(s.running, false); assert.equal(s.distractions[0].app, 'TikTok');
  const paused = tick(s, 20 * 60000); assert.equal(paused.elapsedMs, 5 * 60000);
  s = tick(resume(s, 20 * 60000), 25 * 60000); assert.equal(s.elapsedMs, 10 * 60000);
});
test('clean sessions earn a bonus and streaks multiply XP', () => {
  const clean = tick(newSession(deep, 0), 30 * 60000);
  assert.equal(xpFor(clean, 0), 35); assert.equal(xpFor(clean, 10), 53);
});
test('levels need more XP each time', () => {
  assert.deepEqual(level(0), { level: 1, into: 0, need: 100 });
  assert.equal(level(100).level, 2); assert.equal(level(225).level, 3);
});
test('streak survives an unfinished today', () => {
  assert.equal(streak(['2026-09-25', '2026-09-26', '2026-09-27'], '2026-09-28'), 3);
  assert.equal(streak(['2026-09-25', '2026-09-27', '2026-09-28'], '2026-09-28'), 2);
});
test('badges unlock from stats', () => {
  const got = BADGES.filter(b => b.test({ sessions: 2, cleanSessions: 1, streak: 3, minutes: 50, xp: 120 })).map(b => b.id);
  assert.deepEqual(got, ['first', 'clean', 'streak3']);
});
import { recommend, nudge } from '../src/focus.js';
const S = (distractions, done = true) => ({ distractions, done });
test('the plan recommendation follows the last five sessions', () => {
  assert.equal(recommend([]).reason, 'new');
  assert.equal(recommend([S(0), S(1)]).plan, 'deep');
  assert.deepEqual(recommend([S(0), S(1), S(0), S(0), S(0)]), { plan: 'deep', reason: 'steady', of: 5, drifted: 1, finished: 5 });
  assert.equal(recommend([S(1), S(2), S(0), S(1), S(0)]).plan, 'sprint');
  assert.equal(recommend([S(0, false), S(0, false), S(0, false), S(0), S(0)]).plan, 'sprint');
  assert.equal(recommend([S(0), S(0), S(0), S(0), S(0)]).plan, 'study');
  assert.equal(recommend([S(3), S(3), S(3), S(0), S(0), S(0), S(0), S(0)]).plan, 'study', 'only the last five count');
  for (const r of [recommend([]), recommend([S(1), S(1), S(1)]), recommend([S(0), S(0), S(0), S(0), S(0)])]) assert.ok(PLANS.some(p => p.id === r.plan));
});
test('the smart reminder matches today\'s progress and stops at the goal', () => {
  assert.equal(nudge({ doneToday: 0, goal: 3, streak: 4 }).kind, 'streak');
  assert.equal(nudge({ doneToday: 0, goal: 3, streak: 0 }).kind, 'start');
  assert.deepEqual(nudge({ doneToday: 1, goal: 3, streak: 4, focus: 25 }), { kind: 'left', streak: 4, left: 2, focus: 25 });
  assert.equal(nudge({ doneToday: 3, goal: 3, streak: 4 }), null);
});
