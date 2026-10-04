import { PLANS, newSession, tick, distract, resume, remaining, xpFor, level, streak, BADGES, recommend, nudge } from './src/focus.js';

const $ = id => document.getElementById(id);
const KEY = 'zentra.v1', today = () => new Date().toISOString().slice(0, 10);
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
let S = load() || { plan: 'deep', xp: 0, days: [], log: {}, sessions: 0, clean: 0, minutes: 0 };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
let session = null, timer = null;
const plan = () => PLANS.find(p => p.id === S.plan);
const doneToday = () => S.log[today()] || 0;

function go(id) { for (const s of ['home', 'focus', 'rewards']) $(s).hidden = s !== id; render(); }
document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) go(g.dataset.go); });

function ringSet(el, frac, r) { const c = 2 * Math.PI * r; el.style.strokeDasharray = c; el.style.strokeDashoffset = c * (1 - frac); }
function render() {
  const p = plan(), n = Math.min(doneToday(), p.sessions), st = streak(S.days, today()), lv = level(S.xp);
  $('xpPill').textContent = `Lv ${lv.level} · ${S.xp} XP`;
  $('greet').textContent = n >= p.sessions ? 'Plan complete. Legend.' : n ? 'Keep the chain going.' : 'Ready to focus?';
  const dt = new Date();
  $('dateLine').textContent = dt.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) + ', ' + dt.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  $('week').innerHTML = [-1, 0, 1, 2, 3].map(o => { const d = new Date(Date.now() + o * 864e5); return `<span class="${o === 0 ? 'on' : ''}"><small>${d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</small><b>${d.getDate()}</b></span>`; }).join('');
  $('xpN').textContent = S.xp.toLocaleString('en-US');
  $('streakN').textContent = `${st} day${st === 1 ? '' : 's'}`;
  $('challN').textContent = `${Math.min(st, 7)}/7 days`;
  $('dayCount').textContent = `${n}/${p.sessions}`; $('wCount').textContent = `${n}/${p.sessions}`;
  $('wRemain').textContent = `Remain ${p.sessions - n}`;
  $('dayBar').style.width = `${100 * n / p.sessions}%`; ringSet($('wRing'), n / p.sessions, 40);
  $('planName').textContent = p.name; $('planMeta').textContent = `Complete ${p.sessions} sessions to stay on track · ${p.focus} min focus, ${p.rest} min rest`;
  /* plan suggestion: a rule over the last five sessions (src/focus.js), with its reason shown */
  const rec = recommend(S.recent || []), rp = PLANS.find(x => x.id === rec.plan);
  const WHY = { new: 'Start here while Zentra learns your rhythm.', drift: `You drifted or stopped early in ${Math.max(rec.drifted, rec.of - rec.finished)} of your last ${rec.of} sessions, so shorter blocks fit better.`, clean: `Your last ${rec.of} sessions were clean, so you can hold a longer block.`, steady: 'Your recent sessions are steady, so this length fits.' };
  $('planWhy').innerHTML = rec.plan === S.plan ? `<b>Suggested for you.</b> ${WHY[rec.reason]}` : `<b>Suggestion: ${rp.name}.</b> ${WHY[rec.reason]} <button type="button" data-plan="${rp.id}">Switch</button>`;
  if (!session) { const nd = nudge({ doneToday: n, goal: p.sessions, streak: st, focus: p.focus }); if (nd && !$('mascot').className.includes('party')) $('mascotSay').textContent = nd.kind === 'streak' ? `Your ${nd.streak}-day streak is waiting. One ${nd.focus} minute session keeps it alive.` : nd.kind === 'start' ? `One ${nd.focus} minute session today starts a streak.` : `${nd.left} to go today. The next ${nd.focus} minutes are the easy part.`; }
  $('plans').innerHTML = PLANS.map(x => `<button type="button" data-plan="${x.id}" class="${x.id === S.plan ? 'on' : ''}" style="--c:${x.color}"><b>${x.name}</b><small>${x.focus}/${x.rest} min × ${x.sessions}</small></button>`).join('');
  $('fPlan').textContent = p.name; $('fIdx').textContent = `${Math.min(n + 1, p.sessions)}/${p.sessions}`;
  $('lvl').textContent = lv.level; $('lvfill').style.width = `${100 * lv.into / lv.need}%`; $('lvtxt').textContent = `${lv.into} / ${lv.need} XP to level ${lv.level + 1}`;
  const stats = { sessions: S.sessions, cleanSessions: S.clean, streak: st, minutes: S.minutes, xp: S.xp };
  const ICON = { first: '★', clean: '◎', streak3: '▲', streak7: '◆', hour: '◷', level3: '✦' };
  $('badges').innerHTML = BADGES.map(b => `<div class="badge ${b.test(stats) ? 'got' : ''}"><span>${ICON[b.id]}</span>${b.name}</div>`).join('');
  const ch = [['3-day streak', st, 3], ['7-day streak', st, 7], ['Clean sessions', S.clean, 5], ['Focused minutes', S.minutes, 120]];
  $('chall').innerHTML = ch.map(([t, v, goal]) => `<li><b><span>${t}</span><span>${Math.min(v, goal)}/${goal}</span></b><div class="bar2"><i style="width:${100 * Math.min(1, v / goal)}%"></i></div></li>`).join('');
  if (!session) drawClock(p.focus * 60000, 0);
}
for (const id of ['plans', 'planWhy']) $(id).addEventListener('click', e => { const b = e.target.closest('[data-plan]'); if (!b || session) return; S.plan = b.dataset.plan; save(); render(); });

/* ---------- focus session ---------- */
const speed = () => ($('fast').checked ? 60 : 1);
let clockNow = Date.now(), virtual = 0;
const now = () => virtual;
function drawClock(ms, frac) {
  const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60;
  $('clock').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  ringSet($('ring'), frac, 104);
}
function loop() {
  const t = Date.now(); virtual += (t - clockNow) * speed(); clockNow = t;
  if (!session) return;
  session = tick(session, now());
  drawClock(remaining(session), session.elapsedMs / session.lengthMs);
  if (session.done) finish(true);
}
function start() {
  if (session && !session.running && !session.done) { session = resume(session, now()); $('fState').textContent = 'Focusing'; $('startBtn').textContent = 'Running'; return; }
  if (session) return;
  clockNow = Date.now(); session = newSession(plan(), now());
  $('fState').textContent = 'Focusing'; $('startBtn').textContent = 'Running';
  clearInterval(timer); timer = setInterval(loop, 200);
}
function finish(complete) {
  clearInterval(timer);
  const st = streak(S.days, today());
  const minutes = Math.floor(session.elapsedMs / 60000);
  if (complete) {
    S.log[today()] = doneToday() + 1; if (!S.days.includes(today())) S.days.push(today());
    S.sessions++; if (!session.distractions.length) S.clean++;
  }
  S.recent = [...(S.recent || []), { distractions: session.distractions.length, done: complete }].slice(-5);
  const xp = xpFor(session, st); S.xp += xp; S.minutes += minutes; save();
  $('fState').textContent = complete ? `Done! +${xp} XP` : `Logged ${minutes} min · +${xp} XP`;
  $('startBtn').textContent = 'Start';
  $('mascot').className = complete ? 'mascot party' : 'mascot';
  $('mascotSay').textContent = complete ? (session.distractions.length ? 'Session done. Next one, phone face down?' : 'Clean session! That is the dopamine we want.') : 'Logged. Short is fine, zero is what hurts.';
  session = null; render();
}
$('startBtn').addEventListener('click', start);
$('endBtn').addEventListener('click', () => { if (session) finish(false); });

/* ---------- distraction detection: real tab switches, or a simulated one ---------- */
function onDistract(app) {
  if (!session || !session.running) return;
  session = distract(session, app, now());
  $('mMsg').textContent = `You left Zentra and opened ${app}. Focus session is paused.`;
  $('modal').hidden = false; $('fState').textContent = 'Paused'; $('startBtn').textContent = 'Resume';
  $('mascot').className = 'mascot sad';
}
document.addEventListener('visibilitychange', () => { if (document.hidden) onDistract('another app'); });
$('simulate').addEventListener('click', () => { if (!session) start(); setTimeout(() => onDistract('TikTok'), 300); });
$('resumeBtn').addEventListener('click', () => { $('modal').hidden = true; clockNow = Date.now(); session = resume(session, now()); $('fState').textContent = 'Focusing'; $('startBtn').textContent = 'Running'; $('mascot').className = 'mascot'; });
$('logEnd').addEventListener('click', () => { $('modal').hidden = true; finish(false); });
$('reset').addEventListener('click', () => { S = { plan: 'deep', xp: 0, days: [], log: {}, sessions: 0, clean: 0, minutes: 0 }; save(); render(); });

/* first visit: seed a believable history so streaks and badges have something to show */
if (!load()) { const d = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10); S.days = [d(3), d(2), d(1)]; S.log = { [d(3)]: 3, [d(2)]: 2, [d(1)]: 3 }; S.sessions = 8; S.clean = 5; S.minutes = 200; S.xp = 186; S.recent = [{ distractions: 0, done: true }, { distractions: 1, done: true }, { distractions: 0, done: true }, { distractions: 0, done: true }]; save(); }
render();
