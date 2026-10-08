'use strict';
/* ==========================================================================
   TAMMISAARI MOTOCROSS – 2D-sivunäkymä, Canvas
   Osat: 1) asetukset  2) tila  3) logiikka  4) grafiikka  5) HUD  6) käyttöliittymä
   ========================================================================== */
(() => {
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const $ = s => document.querySelector(s);
const nowS = () => performance.now() / 1000;
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
const hash = (i, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };

/* ---------- 1) ASETUKSET ------------------------------------------------- */
const DEFAULTS = {
  // ajat
  startHold: 1.2, windWait: 15, accelTime: 6, readyDelay: 1.4, ringTime: 1.1, ringGap: .3, runUp: 1.5, takeoffWindow: .35,
  // nopeus
  maxSpeed: 100, maxTaps: 100, tapRateForMax: 10, speedUp: 3.2, speedDown: 1.3,
  // matkan painot (suhteellisia) + vaikeuskäyrä
  wSpeed: .30, wTaps: .12, wRings: .22, wTakeoff: .20, wWind: .06, wBalance: .15, maxDistance: 100, curve: 1.6,
  // lento
  drift: .55, steerPower: 2.6, damping: .8, gust: .35, windTorque: .05, balTol: .9, landTol: .55, flipLimit: 1.7,
  // kamera
  viewWidth: 18, visualSpeed: 1.25,
};
const SETTINGS = [
  ['Ajat', [
    ['startHold', 'START pohjassa (s)', .2, 5, .1], ['windWait', 'Tuulen odotusaika (s)', 3, 60, 1],
    ['accelTime', 'Vauhdinotto (s)', 3, 30, 1], ['readyDelay', 'Viive ennen ympyröitä (s)', .3, 4, .1],
    ['ringTime', 'Ympyrän kutistumisaika (s)', .5, 3, .05], ['ringGap', 'Tauko ympyröiden välillä (s)', 0, 2, .05],
    ['runUp', 'Aika viimeisestä ympyrästä keulalle (s)', .6, 4, .1], ['takeoffWindow', 'Ponnistuksen ikkuna (s)', .1, .8, .01]]],
  ['Nopeus ja klikkaus', [
    ['maxSpeed', 'Maksiminopeus (km/h)', 20, 200, 1], ['maxTaps', 'Klikkauksia täyteen pisteeseen', 10, 300, 1],
    ['tapRateForMax', 'Klikkausta/s maksimivauhtiin', 2, 20, .5], ['speedUp', 'Kiihtyvyys', .5, 8, .1], ['speedDown', 'Hidastuvuus', .2, 8, .1]]],
  ['Matkan painot (suhteellisia)', [
    ['wSpeed', 'Nopeus', 0, 1, .01], ['wTaps', 'Klikkausmäärä', 0, 1, .01], ['wRings', 'Asentoympyrät', 0, 1, .01],
    ['wTakeoff', 'Ponnistus keulalla', 0, 1, .01], ['wWind', 'Tuuli', 0, 1, .01], ['wBalance', 'Lennon tasapaino (0–0.5)', 0, .5, .01],
    ['maxDistance', 'Maksimimatka (m)', 20, 300, 1], ['curve', 'Vaikeuskäyrä (isompi = vaikeampi)', .8, 3, .05]]],
  ['Lento', [
    ['drift', 'Taakse kallistuminen', 0, 2, .05], ['steerPower', 'Nuolten voima', .5, 8, .1], ['damping', 'Vaimennus', 0, 4, .05],
    ['gust', 'Puuskat', 0, 2, .05], ['windTorque', 'Tuulen työntö', 0, .3, .01], ['balTol', 'Tasapainon toleranssi (rad)', .3, 2, .05],
    ['landTol', 'Laskeutumisen toleranssi (rad)', .2, 1.2, .05], ['flipLimit', 'Ympäri menon raja (rad)', 1, 3, .05]]],
  ['Kamera', [['viewWidth', 'Näkyvä leveys (m) – pienempi = lähempää', 5, 25, .5], ['visualSpeed', 'Ruudun vauhti-kerroin', .5, 3, .05]]],
];
const VEH_KEY = 'tammisaariVehicle_v4', CFG_KEY = 'tammisaariCfg_v4', REC_KEY = 'tammisaariRecords_v3', RIDER_KEY = 'tammisaariRider_v3';
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
};
const cfg = Object.assign({}, DEFAULTS, store.get(CFG_KEY, {}));

const TRACKS = { tammisaari: { id: 'tammisaari', name: 'Tammisaari', rampLen: 7.5, rampH: 1.7, seed: 7 } };
const RIDERS = [
  { name: 'Leevi', acc: 'Leevin', par: 'Leeviä', g: 'm', suit: '#1f6fe0', pants: '#12306b', hair: '#6b4a2b' },
  { name: 'Matias', acc: 'Matiaksen', par: 'Matiasta', g: 'm', suit: '#2fa84f', pants: '#14411f', hair: '#3a2a1a' },
  { name: 'Neea', acc: 'Neean', par: 'Neeaa', g: 'f', suit: '#8a45d6', pants: '#3a1d63', hair: '#e0b050' },
  { name: 'Venla', acc: 'Venlan', par: 'Venlaa', g: 'f', suit: '#ee5fa0', pants: '#6b1f45', hair: '#6e3b1d' },
  { name: 'Viljo', acc: 'Viljon', par: 'Viljoa', g: 'm', suit: '#f08a1c', pants: '#5e3208', hair: '#c88f4a' },
];

const VEHICLES = [
  { id: 'bike', name: 'Prätkä' }, { id: 'mower', name: 'Ruohonleikkuri' },
  { id: 'atv', name: 'Mönkijä' }, { id: 'scooter', name: 'Sähköpotkulauta' },
];
/* Lausahdukset. {n} = nimi, {par} = partitiivi (Leeviä), {acc} = akkusatiivi (Leevin) */
const pick = a => a[Math.floor(Math.random() * a.length)];
const fmt = s => s.replace('{n}', S.rider.name).replace('{par}', S.rider.par).replace('{acc}', S.rider.acc);
const WIND_START = ['Katso tuulta, {n}!', 'Tuuli tarkkailuun...', 'Odotellaan oikeaa hetkeä', 'Tuulta pitää osata lukea!'];
const WIND_GOOD = ['Nyt tuulee hyvin! Lähde!', 'Myötätuulta, nyt!', 'Vihreää! Nyt tai ei koskaan!', 'Täydellinen hetki!'];
const WIND_BAD = ['Tuuli on vastaan...', 'Ei vielä, tuuli on huono', 'Odota vielä hetki', 'Puuskainen! Odota parempaa'];
const WIND_HURRY = ['Äiti kutsuu jo!', 'Ruoka jäähtyy, {n}!', 'Nyt pitää lähteä, {n}!', 'Aika loppuu!'];
const ACCEL_START = ['KLIKKAA NOPEASTI!', 'Kaasua, {n}!', 'Hakkaa ruutua!', 'Täysillä!'];
const ACCEL_SLOW = ['Nopeammin, {n}!', 'Vauhtia lisää!', 'Ei tämä vielä kulje!', 'Klikkaa, klikkaa!'];
const ACCEL_FAST = ['Nyt kulkee!', 'Huimaa vauhtia!', 'Ei hidastella!', 'Tämä on jo lentovauhtia!'];
const LOCK_HI = ['Huikea vauhti!', 'Hurja alku!', 'Tuolla vauhdilla pääsee kauas!'];
const LOCK_MID = ['Hyvä vauhti', 'Kelpo vauhti', 'Ihan menevä!'];
const LOCK_LOW = ['Vähän hidas lähtö', 'Vauhti jäi vaisuksi', 'Hitusen lisää olisi mahtunut'];
const RING_PERFECT = ['TÄYDELLINEN!', 'Napakymppi!', 'Täsmälleen!', 'Timantti!'];
const RING_GOOD = ['HYVÄ!', 'Näin sitä ajetaan!', 'Kiva!', 'Hyvin ajoitettu!'];
const RING_OK = ['OK', 'Menettelee', 'Kohtalainen'];
const RING_BAD = ['VÄHÄN OHI', 'Melkein...', 'Ei ihan', 'Hieman vinossa'];
const RING_MISS = ['OHI!', 'Unohtuiko klikata?', 'Ups!', 'Ai että!'];
const TAKEOFF_GREAT = ['TÄYDELLINEN PONNISTUS!', 'Keulalta suoraan taivaalle!', 'Täsmäponnistus!'];
const TAKEOFF_GOOD = ['HYVÄ PONNISTUS', 'Kelpo ponnistus', 'Sopiva loikka'];
const TAKEOFF_EARLY = ['PONNISTUS OLI AIKAINEN', 'Liian aikaisin!', 'Ponnistus meni vähän vikaan'];
const FLIGHT_START = ['Ilmassa!', 'Nyt lennetään!', 'Hui!', 'Ylös ja eteenpäin!'];
const TILT_UP = ['Nokka nousee! Paina ▶', 'Taakse menee! Paina ▶', 'Keula alas! ▶'];
const TILT_DOWN = ['Nokka painuu! Paina ◀', 'Liikaa eteen! ◀', 'Nosta keulaa! ◀'];
const FLIGHT_GOOD = ['Hienosti balanssissa!', 'Tasapaino kohdallaan!', 'Kuin ammattilainen!'];
const LAND_GOOD = ['Pehmeä lasku!', 'Mahtava lasku!', 'Kuin kissa!', 'Siististi alas!'];
const PHRASE = [
  [95, ['Ultraprätkämestari!', 'Ultraprätkämestari!', 'Legenda! Tammisaari kumartaa!', 'Mitä ihmettä?! Uskomaton!']],
  [85, ['Huigeeta menoa, tästä TikTok-video!', 'Huigeeta menoa, tästä TikTok-video!', 'Tämä menee heti kavereille!', 'Isi kehuu tätä vielä viikon!']],
  [70, ['Nyt on jo yritystä!', 'Nyt on jo yritystä!', 'Naapurit tulivat katsomaan!', 'Tammisaaren kylä seuraa!']],
  [50, ['Tästä se lähtee', 'Tästä se lähtee', 'Alkaa jo näyttää hyvältä!', 'Kohta mennään kovempaa!']],
  [0, ['Ihan ok.', 'Ihan ok.', 'Lämmittelyhyppy!', 'Hyvä alku, kyllä tästä!']],
];
const FAIL_WIND = ['Hyppy epäonnistui, äiti käski {par} syömään!', 'Hyppy epäonnistui, äiti käski {par} syömään!', 'Hyppy jäi hyppäämättä, makaronilaatikko jäähtyy, {n}!', 'Tuuli ei kääntynyt ja äiti huusi {par} sisälle!'];
const FAIL_MISS = ['O-ou, hyppyri meni ohi ja iskä huusi {acc} nukkumaan!', 'O-ou, hyppyri meni ohi ja iskä huusi {acc} nukkumaan!', 'Hyppyri jäi väliin! {n} ehti vain vilkuttaa naapurille.', 'Ponnistus unohtui, {n}! Iskä lähetti nukkumaan.'];
const FAIL_LAND = ['O-ou, nyt sattui {par} leukaan', 'O-ou, nyt sattui {par} leukaan', 'Auts! Huono lasku, {n}!', 'Lasku meni pusikkoon, {n} kaatui!'];
const FAIL_FLIP = ['O-ou, nyt sattui {par} leukaan', 'Ympäri meni! {n} teki ylimääräisen kuperkeikan.', 'Kuperkeikka! Kypärä pelasti {acc}.', 'Lento päättyi nurin, {n}!'];
const RED = '#d8232a', WHT = '#f5f5f5', BLK = '#141414';
const BIKE_R = .42; // pyörän säde (m)

/* ---------- 2) TILA ------------------------------------------------------ */
const POSES = { // kuskin lonkka (h) ja hartia (s) prätkän koordinaatistossa, metriä
  sit:   { hx: -.30, hy: .96, sx: .06, sy: 1.45 },
  stand: { hx: -.10, hy: 1.06, sx: .10, sy: 1.56 },
  back:  { hx: -.44, hy: 1.00, sx: -.08, sy: 1.46 },
  crouch:{ hx: -.22, hy: .92, sx: .20, sy: 1.30 },
  pop:   { hx: .00, hy: 1.14, sx: .22, sy: 1.64 },
  air:   { hx: -.16, hy: 1.04, sx: .06, sy: 1.54 },
};
const S = {
  phase: 'menu', t0: 0, time: 0,
  rider: RIDERS[0], vehicle: VEHICLES[0], track: TRACKS.tammisaari,
  callout: null, callCd: 0, sayAt: 0, windMood: '', hurry: false, slowSaid: false, fastSaid: false,
  bike: { x: 0, y: BIKE_R, ang: 0, wheel: 0, v: 0 },
  cam: { x: 0, y: 0, ppm: 60, ax: .28, shake: 0 },
  speedKmh: 0, lockedSpeed: 0, taps: 0, tapTimes: [], rate: 0, kick: 0,
  wind: { s: 3, phi: .5, g: 0 },
  ramp: null, ap: null, rings: [], ringFx: null, takeoff: null,
  pose: 'sit', rp: Object.assign({}, POSES.sit),
  F: null, crash: null, result: null, particles: [], partAcc: 0,
  held: { l: 0, r: 0 }, holdP: 0, engine: false,
};
let W = 0, H = 0, dpr = 1, ui = 1;
const cv = $('#c'); let g = cv.getContext('2d');
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  ui = clamp(Math.min(W / 640, H / 400), .72, 1.5);
}
window.addEventListener('resize', resize); resize();

/* ---------- 3) LOGIIKKA ---------------------------------------------------- */
function setPhase(p) { S.phase = p; S.t0 = nowS(); }
const phaseT = () => nowS() - S.t0;
const say = (pool, ms = 1600) => banner(fmt(pick(pool)), '', ms);
const call = (text, col = '#fff', dur = 1.1) => { S.callout = { text, col, t: nowS(), dur }; };

let bTimer = 0;
function banner(t, cls = '', ms = 0) {
  const b = $('#banner'); b.textContent = t; b.className = t ? 'show ' + cls : '';
  clearTimeout(bTimer); if (ms && t) bTimer = setTimeout(() => banner(''), ms);
}

/* tuuli: hidas mean-reverting-satunnaiskävely. phi = suunta ruudulla (0 = ajosuunta eli myötätuuli) */
function initWind() { S.wind.s = 1.5 + Math.random() * 5.5; S.wind.phi = Math.random() * TAU; S.wind.g = 0; }
function stepWind(dt, k) {
  const w = S.wind, sq = Math.sqrt(dt);
  w.s += (4.2 - w.s) * .05 * dt + .5 * k * sq * gauss();
  w.g += -w.g * 1.2 * dt + .35 * k * sq * gauss();
  w.phi += .28 * k * sq * gauss();
  w.s = clamp(w.s, .2, 11);
}
function windInfo() {
  const w = clamp(S.wind.s + S.wind.g, .1, 12), c = Math.cos(S.wind.phi), sn = Math.sin(S.wind.phi);
  const tail = c * w, cross = Math.abs(sn) * w;
  const q = clamp(.72 + .06 * tail - .05 * cross, 0, 1);
  const col = q >= .66 ? '#3ddc66' : q >= .42 ? '#ffd23f' : '#ff4d4d';
  const label = w < .8 ? 'tyyni' : Math.abs(c) > .7 ? (c > 0 ? 'myötätuuli' : 'vastatuuli') : 'sivutuuli';
  return { w, tail, cross, q, col, label };
}

function resetRun(next) {
  Object.assign(S.bike, { x: 0, y: BIKE_R, ang: 0, wheel: 0, v: 0 });
  Object.assign(S, { speedKmh: 0, lockedSpeed: 0, taps: 0, rate: 0, kick: 0, ramp: null, ap: null, rings: [], ringFx: null, takeoff: null,
    F: null, crash: null, result: null, pose: 'sit', engine: false, holdP: 0,
    callout: null, callCd: 0, sayAt: 0, windMood: '', hurry: false, slowSaid: false, fastSaid: false });
  S.tapTimes.length = 0; S.particles.length = 0; S.cam.x = 0; S.cam.y = 0; S.cam.ax = .28; S.cam.ppm = targetPpm();
  Object.assign(S.rp, POSES.sit); initWind(); banner(''); showCard(null); $('#steer').classList.add('hidden');
  if (next === 'start') { setPhase('start'); $('#startTitle').textContent = S.rider.name + ' valmiina!'; $('#holdBar').style.width = '0'; showCard('startDock'); }
  else { setPhase('menu'); showCard('menu'); }
}

/* --- START: pidä pohjassa --- */
let holdRaf = 0, holdAt = 0;
function holdBegin(e) {
  if (S.phase !== 'start') return; e.preventDefault(); holdAt = nowS(); S.engine = true;
  const f = () => {
    S.holdP = clamp((nowS() - holdAt) / cfg.startHold, 0, 1); $('#holdBar').style.width = S.holdP * 100 + '%';
    if (S.holdP >= 1) { holdRaf = 0; beginWind(); } else holdRaf = requestAnimationFrame(f);
  };
  cancelAnimationFrame(holdRaf); f();
}
function holdEnd() { if (S.phase !== 'start' || !holdRaf) return; cancelAnimationFrame(holdRaf); holdRaf = 0; S.holdP = 0; S.engine = false; $('#holdBar').style.width = '0'; }
function beginWind() { showCard('windDock'); setPhase('wind'); S.engine = true; sfx.start(); say(WIND_START, 2200); S.sayAt = nowS() + 2.4; }

/* --- vauhdinotto --- */
function beginAccel() { showCard(null); setPhase('accel'); S.taps = 0; S.tapTimes.length = 0; S.speedKmh = 0; say(ACCEL_START, 1400); }
function registerTap() {
  const n = nowS(); S.taps++; S.tapTimes.push(n); S.kick = 1; sfx.tap(S.speedKmh / cfg.maxSpeed);
}
function endAccel() {
  S.lockedSpeed = S.speedKmh;
  const vApp = 8 + clamp(S.lockedSpeed / cfg.maxSpeed, 0, 1) * 12;
  const tLip = cfg.readyDelay + 3 * cfg.ringTime + 2 * cfg.ringGap + cfg.runUp;
  S.ap = { v: vApp, startX: S.bike.x, tLip };
  S.ramp = { lipX: S.bike.x + vApp * tLip, len: S.track.rampLen, h: S.track.rampH };
  S.rings = [0, 1, 2].map(k => { const t0 = cfg.readyDelay + k * (cfg.ringTime + cfg.ringGap); return { t0, t1: t0 + cfg.ringTime, done: false, score: 0 }; });
  S.takeoff = null; S.pose = 'sit'; S.ringFx = null;
  setPhase('approach'); { const sp = S.lockedSpeed / cfg.maxSpeed; banner(Math.round(S.lockedSpeed) + ' km/h – ' + fmt(pick(sp >= .85 ? LOCK_HI : sp >= .55 ? LOCK_MID : LOCK_LOW)), '', cfg.readyDelay * 1000 - 100); }
}

/* --- asennon otto: ympyrät --- */
const RING_ZONE = .40, RING_MIN = .12, RING_TOL = .33; // suhteessa ulkoympyrään
function ringRadius(r, pt) { return lerp(1, RING_MIN, clamp((pt - r.t0) / cfg.ringTime, 0, 1)); }
function resolveRing(i, score) {
  const r = S.rings[i]; r.done = true; r.score = score;
  S.pose = ['stand', 'back', 'crouch'][i];
  const [pool, c] = score >= .93 ? [RING_PERFECT, '#5cff7a'] : score >= .75 ? [RING_GOOD, '#b6ff5c'] : score >= .5 ? [RING_OK, '#ffd23f'] : score > 0 ? [RING_BAD, '#ffa24a'] : [RING_MISS, '#ff6b5b'];
  S.ringFx = { t: nowS(), text: fmt(pick(pool)), col: c, i }; sfx.ring(score);
}
function approachTap(pt) {
  const i = S.rings.findIndex(r => !r.done);
  if (i >= 0) {
    const r = S.rings[i]; if (pt < r.t0 - .05 || pt > r.t1) return; // viive: ei ympyrää vielä
    resolveRing(i, clamp(1 - Math.abs(ringRadius(r, pt) - RING_ZONE) / RING_TOL, 0, 1)); return;
  }
  if (S.takeoff) return;
  const dt = S.ap.tLip - pt; if (dt > .8 || dt < 0) return;
  const score = clamp(1 - Math.max(0, dt - .04) / cfg.takeoffWindow, 0, 1);
  S.takeoff = { score, dt, text: fmt(pick(score >= .9 ? TAKEOFF_GREAT : score >= .6 ? TAKEOFF_GOOD : TAKEOFF_EARLY)) }; S.pose = 'pop'; sfx.takeoffTap(score);
}
function tap() {
  if (S.phase === 'accel') registerTap();
  else if (S.phase === 'approach') approachTap(phaseT());
}

/* --- lento --- */
function rampH(x) { const R = S.ramp; if (!R) return 0; const s = (x - (R.lipX - R.len)) / R.len; return s <= 0 ? 0 : s >= 1 ? R.h : R.h * Math.pow(s, 1.5); }
function rampSlope(x) { const R = S.ramp; const s = (x - (R.lipX - R.len)) / R.len; return s <= 0 || s >= 1.0001 ? (s > 1 ? 0 : 0) : 1.5 * R.h * Math.pow(s, .5) / R.len; }
function startFlight() {
  const cfgW = cfg.wSpeed + cfg.wTaps + cfg.wRings + cfg.wTakeoff + cfg.wWind || 1;
  const sp = clamp(S.lockedSpeed / cfg.maxSpeed, 0, 1), tp = clamp(S.taps / cfg.maxTaps, 0, 1);
  const rg = S.rings.reduce((a, r) => a + r.score, 0) / 3, tk = S.takeoff.score, wi = windInfo();
  const pre = clamp((cfg.wSpeed * sp + cfg.wTaps * tp + cfg.wRings * rg + cfg.wTakeoff * tk + cfg.wWind * wi.q) / cfgW, 0, 1);
  const Dpot = cfg.maxDistance * Math.pow(pre, cfg.curve), frac = clamp(Dpot / cfg.maxDistance, 0, 1);
  const th0 = -Math.atan(rampSlope(S.ramp.lipX - .001));
  S.F = { t: 0, Tf: 1 + 2.4 * Math.pow(frac, .9), Hp: .6 + 6.2 * Math.pow(frac, 1.1), h0: S.ramp.h, Dpot, frac, pre, sp, tp, rg, tk, wq: wi.q,
    th0, th: th0, w: -(1 - rg) * 1.4 + (Math.random() - .5) * (1 - tk) * 2, d: 0, gust: 0, qInt: 0, vx: 0, vy: 0, q: 1 };
  S.bike.x = S.ramp.lipX; setPhase('flight'); S.pose = 'air'; S.cam.shake = .12;
  banner('', ''); $('#steer').classList.remove('hidden'); sfx.pop(); call(fmt(pick(FLIGHT_START)), '#fff', 1.0);
}
const idealAng = (F, u) => F.th0 + (.25 - F.th0) * u;
function updateFlight(dt) {
  const F = S.F; F.t += dt; const u = Math.min(1, F.t / F.Tf), wi = windInfo();
  F.gust += -F.gust * 1.5 * dt + cfg.gust * Math.sqrt(2 * 1.5 * dt) * gauss();
  const inp = S.held.r - S.held.l, dm = .75 + .5 * F.frac;
  const torque = -cfg.drift * dm + inp * cfg.steerPower + F.gust * (.6 + wi.w / 8) + wi.tail * cfg.windTorque - cfg.damping * F.w;
  F.w += torque * dt; F.th += F.w * dt;
  F.q = clamp(1 - Math.abs(F.th - idealAng(F, u)) / cfg.balTol, 0, 1); F.qInt += F.q * dt;
  const err = (F.th - idealAng(F, u)) / cfg.balTol, nn = nowS();
  if (nn > S.callCd) {
    if (err < -.65) { call(pick(TILT_UP), '#ffd23f', .9); S.callCd = nn + 1.4; }
    else if (err > .65) { call(pick(TILT_DOWN), '#ffd23f', .9); S.callCd = nn + 1.4; }
    else if (u > .5 && F.q > .9 && !F.goodSaid) { F.goodSaid = true; call(pick(FLIGHT_GOOD), '#5cff7a', 1.1); S.callCd = nn + 1.4; }
  }
  const bw = clamp(cfg.wBalance, 0, .5), f = (1 - bw) + bw * F.q;
  F.vx = F.Dpot / F.Tf * f; F.d += F.vx * dt;
  F.vy = (-F.h0 + F.Hp * 4 * (1 - 2 * u)) / F.Tf;
  S.bike.x = S.ramp.lipX + F.d; S.bike.y = BIKE_R + F.h0 * (1 - u) + F.Hp * 4 * u * (1 - u); S.bike.ang = F.th; S.bike.v = F.vx;
  if (Math.abs(F.th) > cfg.flipLimit) return crashNow('flip');
  if (u >= 1) {
    if (Math.abs(F.th - .25) > cfg.landTol) return crashNow('land');
    land();
  }
}
function land() {
  const F = S.F; setPhase('landed'); S.bike.y = BIKE_R; S.cam.shake = .35; S.result = { d: F.d, q: F.qInt / F.Tf, F };
  for (let i = 0; i < 26; i++) emit(S.bike.x - .6 + Math.random() * 1.4, .05, -F.vx * (.15 + Math.random() * .3), 1 + Math.random() * 3, 1.2);
  $('#steer').classList.add('hidden'); sfx.land(); call(fmt(pick(LAND_GOOD)), '#5cff7a', 1.4);
}
function crashNow(reason) {
  const b = S.bike, F = S.F, vx = F ? F.vx : b.v, vy = F ? F.vy : 0, w = F ? F.w : 0;
  S.crash = { t: 0, reason, bike: { x: b.x, y: b.y, vx: vx * .8, vy: vy * .5 + 1, ang: b.ang, w: w * .8 + 2 },
    rider: { x: b.x, y: b.y + .8, vx: vx * 1.05, vy: vy * .5 + 3, ang: b.ang, w: w + (Math.random() < .5 ? -4 : 4) } };
  setPhase('crash'); S.cam.shake = .5; sfx.crash(); S.callout = null; $('#steer').classList.add('hidden');
}
function stepBody(o, gy, dt) {
  o.vy -= 18 * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.ang += o.w * dt;
  if (o.y < gy) { o.y = gy; if (o.vy < -1) { o.vy *= -.3; o.vx *= .75; o.w *= .6; } else o.vy = 0; }
  if (o.y <= gy + .001) { o.vx *= Math.max(0, 1 - 2.4 * dt); o.w *= Math.max(0, 1 - 3 * dt); }
}

/* --- hiukkaset --- */
function emit(x, y, vx, vy, life) { if (S.particles.length < 160) S.particles.push({ x, y, vx, vy, t: 0, life, r: .08 + Math.random() * .12 }); }
function updateParticles(dt) {
  const p = S.particles;
  for (let i = p.length - 1; i >= 0; i--) { const o = p[i]; o.t += dt; o.x += o.vx * dt; o.y += o.vy * dt; o.vy -= 1.5 * dt; o.vx *= 1 - .8 * dt; o.r += dt * .12; if (o.t > o.life || o.y < 0) p.splice(i, 1); }
  const grounded = ['accel', 'approach', 'landed', 'missed'].includes(S.phase) && S.bike.y < BIKE_R + .15;
  if (grounded && S.bike.v > 2) { S.partAcc += dt * S.bike.v * 1.4; while (S.partAcc > 1) { S.partAcc--; emit(S.bike.x - .75, .06, -S.bike.v * (.2 + Math.random() * .25), .5 + Math.random() * 2, .7 + Math.random() * .5); } }
  if (S.engine && S.bike.v < 1 && S.phase !== 'menu' && S.vehicle.id !== 'scooter' && Math.random() < dt * 14) emit(S.bike.x - .95, .62, -.5 - Math.random() * .6, .3 + Math.random() * .5, .8);
}

/* --- pääpäivitys --- */
function update(dt) {
  S.time += dt; const n = nowS(), pt = n - S.t0, b = S.bike;
  const wk = { menu: .6, start: .6, wind: 1, accel: .5, approach: .5, flight: .35 }[S.phase] || 0; if (wk) stepWind(dt, wk);
  S.kick = Math.max(0, S.kick - dt * 5);
  let wheelV = b.v;

  if (S.phase === 'wind') {
    const rem = cfg.windWait - pt, wi = windInfo();
    if (n > S.sayAt) {
      if (rem < 5 && !S.hurry) { S.hurry = true; say(WIND_HURRY, 2200); S.sayAt = n + 2.5; }
      else if (wi.q >= .66 && S.windMood !== 'good') { S.windMood = 'good'; say(WIND_GOOD, 2200); sfx.good(); S.sayAt = n + 2.5; }
      else if (wi.q < .42 && S.windMood !== 'bad') { S.windMood = 'bad'; say(WIND_BAD, 2200); S.sayAt = n + 2.5; }
      else if (wi.q >= .42 && wi.q < .66) S.windMood = 'mid';
    }
    if (rem <= 5 && rem > 0 && Math.ceil(rem) !== AU.lastTick) { AU.lastTick = Math.ceil(rem); sfx.tick(); }
    if (pt >= cfg.windWait) fail(fmt(pick(FAIL_WIND)));
  }

  if (S.phase === 'accel') {
    while (S.tapTimes.length && n - S.tapTimes[0] > 3) S.tapTimes.shift();
    let r = 0; for (const t of S.tapTimes) r += Math.exp(-(n - t) / .8) / .8; S.rate = r;
    const target = cfg.maxSpeed * clamp(r / cfg.tapRateForMax, 0, 1);
    S.speedKmh += (target - S.speedKmh) * (1 - Math.exp(-(target > S.speedKmh ? cfg.speedUp : cfg.speedDown) * dt));
    b.v = S.speedKmh / 3.6 * cfg.visualSpeed; b.x += b.v * dt; wheelV = b.v;
    b.ang = -S.kick * .05 - clamp(S.speedKmh / cfg.maxSpeed, 0, 1) * .03;
    if (pt > 1.6 && S.rate < 3 && !S.slowSaid) { S.slowSaid = true; say(ACCEL_SLOW, 1300); }
    if (S.speedKmh > 85 && !S.fastSaid) { S.fastSaid = true; say(ACCEL_FAST, 1300); }
    if (pt >= cfg.accelTime) endAccel();
  } else if (S.phase === 'approach') {
    b.x = S.ap.startX + S.ap.v * pt; b.v = S.ap.v; wheelV = b.v;
    S.rings.forEach((r, i) => { if (!r.done && pt > r.t1) resolveRing(i, 0); });
    const y = rampH(b.x); b.y = BIKE_R + y; b.ang = y > 0 ? -Math.atan(rampSlope(b.x)) : -.02;
    if (pt >= S.ap.tLip) { if (S.takeoff) startFlight(); else { setPhase('missed'); S.pose = 'stand'; S.missV = b.v; S.missY = rampH(S.ramp.lipX); } }
  } else if (S.phase === 'missed') {
    b.x += S.missV * dt; S.missV *= 1 - .9 * dt; b.v = S.missV; wheelV = b.v;
    const fallT = pt, drop = S.missY - 4.9 * fallT * fallT; b.y = BIKE_R + Math.max(0, drop); b.ang = lerp(b.ang, drop > 0 ? .12 : 0, dt * 5);
    if (pt > 1.5) fail(fmt(pick(FAIL_MISS)));
  } else if (S.phase === 'flight') { updateFlight(dt); wheelV = b.v * .7;
  } else if (S.phase === 'landed') {
    b.v *= Math.exp(-2.2 * dt); b.x += b.v * dt; b.y = BIKE_R; b.ang = lerp(b.ang, 0, 1 - Math.exp(-dt * 10)); wheelV = b.v;
    if (pt > 1.7) showResult();
  } else if (S.phase === 'crash') {
    const c = S.crash; c.t += dt; stepBody(c.bike, .38, dt); stepBody(c.rider, .22, dt);
    if (c.t > 1.9) fail(fmt(pick(c.reason === 'flip' ? FAIL_FLIP : FAIL_LAND)));
  } else { // menu / start / wind: jouto
    b.ang = 0; b.y = BIKE_R;
  }
  b.wheel += wheelV / BIKE_R * dt;
  if (S.engine && ['start', 'wind'].includes(S.phase)) { b.wheel += .5 * dt; }

  // kuskin asento
  const pn = S.phase === 'flight' ? (S.held.r - S.held.l > 0 ? 'crouch' : S.held.r - S.held.l < 0 ? 'back' : 'air') : S.phase === 'landed' ? 'crouch' : S.phase === 'approach' ? S.pose : S.phase === 'missed' ? 'stand' : 'sit';
  const tp = POSES[pn], k = 1 - Math.exp(-dt * 15); for (const key in tp) S.rp[key] = lerp(S.rp[key], tp[key], k);

  updateParticles(dt); updateCamera(dt);
  S.cam.shake = Math.max(0, S.cam.shake - dt * 1.4);
  audioFrame(dt);
}
function targetPpm() { return Math.min(W / cfg.viewWidth, H * .24); }
function updateCamera(dt) {
  const c = S.cam, F = S.F; let ppmT = targetPpm(), axT = .28, camYT = 0, fx = S.bike.x, fy = S.bike.y, rate = 6;
  if (['flight', 'landed'].includes(S.phase) && F) {
    ppmT = Math.min(W / (cfg.viewWidth * 1.4 + F.Dpot * .13), H * .62 / (F.Hp + F.h0 + 3)); axT = .36; camYT = Math.max(0, fy - 3.2) * .6; rate = 1.8;
  } else if (S.phase === 'crash') { fx = S.crash.rider.x; fy = S.crash.rider.y; axT = .4; rate = 2; ppmT = Math.min(ppmT, H * .62 / 8, W / (cfg.viewWidth * 1.6)); camYT = Math.max(0, fy - 3.2) * .6; }
  else if (S.phase === 'missed') rate = 3;
  c.ppm += (ppmT - c.ppm) * (1 - Math.exp(-dt * rate)); c.ax += (axT - c.ax) * (1 - Math.exp(-dt * 2)); c.y += (camYT - c.y) * (1 - Math.exp(-dt * 3));
  c.x = fx;
}

/* --- ennätykset ja tulokset --- */
const loadRecs = () => store.get(REC_KEY + '_' + S.track.id, []);
function addRecord(d) {
  const a = loadRecs(); const e = { d, rider: S.rider.name, veh: S.vehicle.name, ts: Date.now() }; a.push(e); a.sort((x, y) => y.d - x.d);
  const top = a.slice(0, 10); store.set(REC_KEY + '_' + S.track.id, top); return top.indexOf(e);
}
const phrase = d => fmt(pick(PHRASE.find(([m]) => d >= m)[1]));
const tier = d => d >= 95 ? 'Infernaalisen haastava' : d >= 85 ? 'Todella vaikea' : d >= 70 ? 'Vaikea' : d >= 50 ? 'Keskivaikea' : 'Helppo';
function showResult() {
  const d = Math.round(S.result.d * 100) / 100, rank = addRecord(d), six = d >= 67 && d < 68, F = S.result.F;
  setPhase('done'); const champ = rank === 0; sfx.win(champ || d >= 85);
  $('#result').innerHTML = `${six ? '<span class="six">SIX-SEVEN!!!</span>' : ''}
    <div class="result-d">${d.toFixed(2)} m</div>
    <div class="result-t">${champ ? '👑 Uusi ennätys! Tammisaaren prätkämestari!' : phrase(d)}</div>
    ${champ ? `<div class="result-s">${phrase(d)}</div>` : ''}
    <div class="result-s">${S.rider.name} (${S.vehicle.name}) · ${Math.round(S.lockedSpeed)} km/h · ${S.taps} klikkausta · taso: ${tier(d)}${rank >= 0 && !champ ? ' · sija ' + (rank + 1) + '/10' : ''}</div>
    <div class="row"><button id="rAgain">Uusi hyppy</button><button id="rTop" class="dark">🏆 Top 10</button><button id="rMenu" class="dark">Valikko</button></div>`;
  showCard('result'); $('#rAgain').addEventListener('click', () => resetRun('start')); $('#rMenu').addEventListener('click', () => resetRun('menu'));
  $('#rTop').addEventListener('click', () => showRecords(rank, () => showCard('result')));
}
function fail(text) {
  sfx.sad(); setPhase('done'); banner(''); $('#steer').classList.add('hidden');
  $('#result').innerHTML = `<div class="fail-t">${text}</div><div class="row"><button id="rAgain">Yritä uudelleen</button><button id="rMenu" class="dark">Valikko</button></div>`;
  showCard('result'); $('#rAgain').addEventListener('click', () => resetRun('start')); $('#rMenu').addEventListener('click', () => resetRun('menu'));
}

/* ---------- 4) GRAFIIKKA --------------------------------------------------- */
const ln = (x1, y1, x2, y2, w, c) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
const poly = (p, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]); g.closePath(); g.fill(); };
const circ = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
function txt(t, x, y, size, col = '#fff', align = 'center', stroke = 'rgba(0,0,0,.65)') {
  g.font = `800 ${size}px system-ui,"Segoe UI",Roboto,sans-serif`; g.textAlign = align; g.textBaseline = 'middle';
  if (stroke) { g.lineWidth = Math.max(2, size * .14); g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(t, x, y); }
  g.fillStyle = col; g.fillText(t, x, y);
}
function ik(ax, ay, bx, by, l1, l2, s) {
  const dx = bx - ax, dy = by - ay, d = Math.max(.001, Math.hypot(dx, dy)), dd = Math.min(d, l1 + l2 - .002);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a)), ux = dx / d, uy = dy / d;
  return [ax + ux * a - uy * h * s, ay + uy * a + ux * h * s];
}

/* ---- puut ---- */
function spruce(x, y, s, h, w, c1, c2) {
  g.fillStyle = '#3b2a1a'; g.fillRect(x - .12 * s, y - .9 * s, .24 * s, .9 * s);
  for (let k = 0; k < 4; k++) {
    const t = k / 4, by = y - (.6 + t * h * .6) * s, tw = w * (1 - t * .6) * .5 * s, th = h * .36 * s;
    poly([[x - tw, by], [x + tw, by], [x, by - th]], k % 2 ? c1 : c2);
  }
}
function oak(x, y, s, h, c1, c2, c3) {
  g.fillStyle = '#4e3520'; g.beginPath(); g.moveTo(x - .3 * s, y); g.lineTo(x - .2 * s, y - h * .45 * s); g.lineTo(x + .2 * s, y - h * .45 * s); g.lineTo(x + .32 * s, y); g.fill();
  ln(x, y - h * .38 * s, x - h * .2 * s, y - h * .56 * s, .16 * s, '#4e3520'); ln(x, y - h * .38 * s, x + h * .22 * s, y - h * .58 * s, .16 * s, '#4e3520');
  const blobs = [[0, .66, .27], [-.24, .54, .22], [.25, .55, .23], [-.13, .82, .22], [.15, .8, .22], [0, .5, .2]];
  for (const [dx, dy, r] of blobs) circ(x + dx * h * s, y - dy * h * s, r * h * s, c1);
  for (const [dx, dy, r] of blobs) circ(x + (dx - .03) * h * s, y - (dy + .035) * h * s, r * .82 * h * s, c2);
  for (const [dx, dy, r] of blobs.slice(0, 5)) circ(x + (dx - .07) * h * s, y - (dy + .08) * h * s, r * .42 * h * s, c3);
}
function pine(x, y, s, h, c1) {
  ln(x, y, x + .05 * s, y - h * .8 * s, .26 * s, '#6b4a30');
  circ(x, y - h * .86 * s, h * .13 * s, c1); circ(x - h * .12 * s, y - h * .76 * s, h * .1 * s, c1); circ(x + h * .12 * s, y - h * .8 * s, h * .1 * s, c1);
}
const LAYERS = [
  { p: .34, ls: .5, base: 3.4, sp: 2.4, kind: 'far' },
  { p: .55, ls: .75, base: 2.1, sp: 3.2, kind: 'mid' },
  { p: .82, ls: .9, base: .95, sp: 7.5, kind: 'oak' },
];
const CLOUDS = Array.from({ length: 7 }, (_, i) => ({ x: hash(i, 3) * 1400, y: .05 + hash(i, 4) * .22, s: .7 + hash(i, 5) * .9 }));

function drawScene(gsY, gl, ppm, camX, ax) {
  const axPx = ax * W, wi = windInfo();
  // taivas
  const sky = g.createLinearGradient(0, 0, 0, gl); sky.addColorStop(0, '#4aa8e8'); sky.addColorStop(.7, '#a9dcf7'); sky.addColorStop(1, '#e3f5ff');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  // aurinko
  const sx = W * .8, sy = H * .16, sr = 34 * ui, glow = g.createRadialGradient(sx, sy, 0, sx, sy, sr * 4);
  glow.addColorStop(0, 'rgba(255,244,190,.95)'); glow.addColorStop(.25, 'rgba(255,240,170,.45)'); glow.addColorStop(1, 'rgba(255,240,170,0)');
  g.fillStyle = glow; g.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8); circ(sx, sy, sr, '#fff6c8');
  // pilvet
  g.fillStyle = 'rgba(255,255,255,.92)';
  for (const c of CLOUDS) {
    const span = W + 500, x = ((c.x - S.time * (6 + wi.tail * 2.2) - camX * ppm * .03) % span + span) % span - 250, y = c.y * H, r = 22 * ui * c.s;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.arc(x + r * 1.1, y - r * .35, r * 1.2, 0, TAU); g.arc(x + r * 2.3, y, r, 0, TAU); g.arc(x + r * 1.2, y + r * .3, r * 1.1, 0, TAU); g.fill();
  }
  // kukkulat
  const hy = gsY + S.cam.y * ppm * .2 - 3.6 * ppm; g.fillStyle = '#7fae9a'; g.beginPath(); g.moveTo(0, gl);
  for (let x = 0; x <= W + 12; x += 12) { const wx = (x - axPx) / ppm + camX * .12; g.lineTo(x, hy - (Math.sin(wx * .09) * .9 + Math.sin(wx * .21 + 1) * .5 + 1.2) * ppm * .6); }
  g.lineTo(W, gl); g.fill();
  // metsäkerrokset
  LAYERS.forEach((L, li) => {
    const s = ppm * L.ls, baseY = gsY + S.cam.y * ppm * L.p - L.base * ppm, left = camX * L.p - (axPx + 120) / s, right = camX * L.p + (W - axPx + 120) / s;
    for (let i = Math.floor(left / L.sp) - 1; i <= Math.ceil(right / L.sp) + 1; i++) {
      const X = i * L.sp + (hash(i, li + 1) - .5) * L.sp * .7, x = axPx + (X - camX * L.p) * s, rr = hash(i, 9 + li), rr2 = hash(i, 19 + li);
      if (L.kind === 'far') spruce(x, baseY, s, 7 + rr * 5, 2.6 + rr2 * 1.2, '#2b5a4d', '#34665a');
      else if (L.kind === 'mid') { if (rr2 > .78) pine(x, baseY, s, 8 + rr * 3, '#2b6a35'); else spruce(x, baseY, s, 5.5 + rr * 3, 2.6 + rr2, '#245a2d', '#2d6a38'); }
      else { if (rr2 > .7) spruce(x, baseY, s, 5.5 + rr * 2.5, 2.6 + rr, '#1f5429', '#276332'); else oak(x, baseY, s, 4.6 + rr * 2, '#2e6f26', '#3f8a34', '#62a94a'); }
    }
    g.fillStyle = li === 0 ? 'rgba(200,232,248,.28)' : li === 1 ? 'rgba(200,232,248,.12)' : 'rgba(0,0,0,0)'; g.fillRect(0, baseY - 12 * ppm * L.ls, W, 12 * ppm * L.ls + 4);
  });
  // ruohokaista ja aita
  const gg = g.createLinearGradient(0, gl - .9 * ppm, 0, gl); gg.addColorStop(0, '#6aab43'); gg.addColorStop(1, '#4f8f35');
  g.fillStyle = gg; g.fillRect(0, gl - .9 * ppm, W, .9 * ppm + 1);
  const f0 = Math.floor((camX - axPx / ppm - 1) / 2.6), f1 = Math.ceil((camX + (W - axPx) / ppm + 1) / 2.6);
  ln(0, gl - .62 * ppm, W, gl - .62 * ppm, .07 * ppm, '#9a6b3d'); ln(0, gl - .34 * ppm, W, gl - .34 * ppm, .07 * ppm, '#9a6b3d');
  for (let i = f0; i <= f1; i++) { const x = axPx + (i * 2.6 - camX) * ppm; ln(x, gl - .78 * ppm, x, gl - .1 * ppm, .12 * ppm, '#7d522c'); }
  // hiekkatie
  const rg = g.createLinearGradient(0, gl, 0, H); rg.addColorStop(0, '#c4935a'); rg.addColorStop(.35, '#a77a47'); rg.addColorStop(1, '#7b5630');
  g.fillStyle = rg; g.fillRect(0, gl, W, H - gl + 2);
  g.fillStyle = 'rgba(70,45,20,.22)'; g.fillRect(0, gl + .4 * ppm, W, .16 * ppm); g.fillRect(0, gl + 1.1 * ppm, W, .2 * ppm);
  for (let row = 0; row < 3; row++) {
    const fac = 1 + row * .28, cell = .8 * (1 + row * .3), yy = gl + (.22 + row * .62) * ppm; if (yy > H) break;
    const a0 = Math.floor((camX * fac - (axPx + 40) / ppm) / cell), a1 = Math.ceil((camX * fac + (W - axPx + 40) / ppm) / cell);
    for (let i = a0; i <= a1; i++) {
      const r = hash(i, 40 + row); if (r < .45) continue; const x = axPx + (i * cell + r * cell - camX * fac) * ppm;
      g.fillStyle = r > .8 ? 'rgba(235,210,170,.55)' : 'rgba(60,38,18,.3)'; g.beginPath(); g.ellipse(x, yy + hash(i, 70 + row) * .2 * ppm, (.05 + r * .08) * ppm * fac, (.03 + r * .03) * ppm * fac, 0, 0, TAU); g.fill();
    }
  }
  ln(0, gl + .02 * ppm, W, gl + .02 * ppm, .07 * ppm, '#8a5f33');
  const t0 = Math.floor((camX - axPx / ppm) / .5) - 1, t1 = Math.ceil((camX + (W - axPx) / ppm) / .5) + 1;
  for (let i = t0; i <= t1; i++) { const r = hash(i, 55); if (r < .5) continue; const x = axPx + (i * .5 + r * .3 - camX) * ppm, h = (.1 + r * .16) * ppm; poly([[x - .05 * ppm, gl + 2], [x + .05 * ppm, gl + 2], [x + .01 * ppm, gl - h]], '#4f8f35'); }
}

/* ---- hyppyri, merkit, liputtimet ---- */
function drawRamp(gl, ppm, camX, ax) {
  const R = S.ramp; if (!R) return; const axPx = ax * W, X = x => axPx + (x - camX) * ppm, Y = y => gl - y * ppm;
  const x0 = R.lipX - R.len; if (X(R.lipX) < -50 || X(x0) > W + 50) return;
  const grad = g.createLinearGradient(0, Y(R.h), 0, gl); grad.addColorStop(0, '#c99a62'); grad.addColorStop(1, '#8e6334');
  g.fillStyle = grad; g.beginPath(); g.moveTo(X(x0), gl);
  for (let i = 0; i <= 24; i++) { const x = x0 + R.len * i / 24; g.lineTo(X(x), Y(rampH(x))); }
  g.lineTo(X(R.lipX), gl + 2); g.closePath(); g.fill();
  g.strokeStyle = '#e2bb84'; g.lineWidth = .07 * ppm; g.beginPath();
  for (let i = 0; i <= 24; i++) { const x = x0 + R.len * i / 24; i ? g.lineTo(X(x), Y(rampH(x)) + 1) : g.moveTo(X(x), Y(rampH(x)) + 1); } g.stroke();
  g.strokeStyle = 'rgba(60,35,15,.35)'; g.lineWidth = .05 * ppm; for (const o of [.14, .3]) { g.beginPath(); for (let i = 0; i <= 24; i++) { const x = x0 + R.len * i / 24; const y = Y(rampH(x)) + o * ppm * .5 + 2; i ? g.lineTo(X(x), y) : g.moveTo(X(x), y); } g.stroke(); }
  ln(X(R.lipX), Y(R.h), X(R.lipX), Y(R.h + .06), .1 * ppm, '#fff');
  poly([[X(R.lipX) - .18 * ppm, gl - .8 * ppm], [X(R.lipX) + .18 * ppm, gl - .8 * ppm], [X(R.lipX) + .06 * ppm, gl - .02], [X(R.lipX) - .06 * ppm, gl - .02]], '#ff7a1a'); // pylväs lipun reunalla
  const lx = X(R.lipX) + .4 * ppm; ln(lx, gl - 1.9 * ppm, lx, gl, .05 * ppm, '#ddd'); poly([[lx, gl - 1.9 * ppm], [lx + .9 * ppm, gl - 1.65 * ppm], [lx, gl - 1.4 * ppm]], RED);
}
function drawMarkers(gl, ppm, camX, ax) {
  const R = S.ramp; if (!R) return; const axPx = ax * W;
  for (let m = 10; m <= 140; m += 10) {
    const x = axPx + (R.lipX + m - camX) * ppm; if (x < -60 || x > W + 60) continue;
    if (m > 0) { g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(x - .06 * ppm, gl + .06 * ppm, .12 * ppm, .9 * ppm); }
    const bw = 1.5 * ppm, bh = .7 * ppm, by = gl - 1.5 * ppm; ln(x, by + bh, x, gl - .1 * ppm, .07 * ppm, '#e8e8e8');
    g.fillStyle = '#fff'; g.beginPath(); g.roundRect ? g.roundRect(x - bw / 2, by, bw, bh, .1 * ppm) : g.rect(x - bw / 2, by, bw, bh); g.fill();
    g.strokeStyle = RED; g.lineWidth = Math.max(1, .05 * ppm); g.stroke(); txt(m + ' m', x, by + bh / 2 + 1, Math.max(10, .42 * ppm), '#222', 'center', null);
  }
  if (S.result && ['landed', 'done'].includes(S.phase)) {
    const x = axPx + (R.lipX + S.result.d - camX) * ppm; ln(x, gl, x, gl - 2.6 * ppm, .08 * ppm, '#fff');
    poly([[x, gl - 2.6 * ppm], [x + 2.8 * ppm, gl - 2.2 * ppm], [x, gl - 1.8 * ppm]], RED);
  }
}
function drawFlag(gl, ppm, camX, ax) {
  if (!['menu', 'start', 'wind'].includes(S.phase)) return; const wi = windInfo(), axPx = ax * W, px = axPx + (3.6 - camX) * ppm;
  ln(px, gl - .1 * ppm, px, gl - 3 * ppm, .07 * ppm, '#e8e8e8'); circ(px, gl - 3 * ppm, .07 * ppm, '#fff');
  const c = Math.cos(S.wind.phi), len = (.3 + Math.min(wi.w, 9) / 9 * 1.7) * (.25 + .75 * Math.abs(c)), dir = c >= 0 ? 1 : -1, n = 8;
  g.fillStyle = wi.col; g.beginPath(); g.moveTo(px, gl - 3 * ppm);
  for (let i = 0; i <= n; i++) { const t = i / n, wave = Math.sin(S.time * (5 + wi.w) - i * .9) * .07 * t * (.4 + wi.w / 6); g.lineTo(px + dir * t * len * ppm, gl - 3 * ppm + (t * .25 + wave) * ppm); }
  for (let i = n; i >= 0; i--) { const t = i / n, wave = Math.sin(S.time * (5 + wi.w) - i * .9) * .07 * t * (.4 + wi.w / 6); g.lineTo(px + dir * t * len * ppm, gl - 3 * ppm + (.5 - t * .12 + t * .25 + wave) * ppm); }
  g.closePath(); g.fill();
}

/* ---- prätkä ja kuski ---- */
function drawWheel(cx, cy, a, o = {}) {
  const st = o.style || 'moto', sc = o.sc || 1;
  g.save(); g.translate(cx, cy); g.scale(sc, sc); g.rotate(-a);
  if (st === 'mower') {
    g.strokeStyle = '#111'; g.lineWidth = .13; g.beginPath(); g.arc(0, 0, .355, 0, TAU); g.stroke();
    g.lineWidth = .05; g.setLineDash([.07, .05]); g.beginPath(); g.arc(0, 0, .42, 0, TAU); g.stroke(); g.setLineDash([]);
    circ(0, 0, .29, '#f5c400'); circ(0, 0, .09, '#555'); for (let i = 0; i < 5; i++) { const q = i * TAU / 5; ln(Math.cos(q) * .1, Math.sin(q) * .1, Math.cos(q) * .24, Math.sin(q) * .24, .03, '#b38f00'); }
  } else if (st === 'atv') {
    g.strokeStyle = '#111'; g.lineWidth = .22; g.beginPath(); g.arc(0, 0, .31, 0, TAU); g.stroke();
    g.lineWidth = .09; g.setLineDash([.09, .06]); g.beginPath(); g.arc(0, 0, .44, 0, TAU); g.stroke(); g.setLineDash([]);
    circ(0, 0, .2, '#555'); circ(0, 0, .12, '#2a2a2a'); for (let i = 0; i < 6; i++) { const q = i * TAU / 6; circ(Math.cos(q) * .16, Math.sin(q) * .16, .018, '#ddd'); }
  } else if (st === 'scooter') {
    g.strokeStyle = '#111'; g.lineWidth = .1; g.beginPath(); g.arc(0, 0, .3, 0, TAU); g.stroke();
    circ(0, 0, .26, '#e8eef2'); for (let i = 0; i < 5; i++) { const q = i * TAU / 5 + .3; circ(Math.cos(q) * .15, Math.sin(q) * .15, .05, '#8aa'); } circ(0, 0, .06, '#555');
  } else {
    g.strokeStyle = '#111'; g.lineWidth = .13; g.beginPath(); g.arc(0, 0, .355, 0, TAU); g.stroke();
    g.lineWidth = .07; g.setLineDash([.06, .055]); g.beginPath(); g.arc(0, 0, .42, 0, TAU); g.stroke(); g.setLineDash([]);
    g.strokeStyle = '#b9bec4'; g.lineWidth = .035; g.beginPath(); g.arc(0, 0, .26, 0, TAU); g.stroke();
    g.lineWidth = .012; for (let i = 0; i < 10; i++) { const q = i * TAU / 10; g.beginPath(); g.moveTo(Math.cos(q) * .05, Math.sin(q) * .05); g.lineTo(Math.cos(q) * .26, Math.sin(q) * .26); g.stroke(); }
    circ(0, 0, .06, '#ddd');
  }
  g.restore();
}
function drawMoto(wh) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  drawWheel(-.72, 0, wh);
  ln(-.12, .2, -.72, 0, .07, '#2a2a2a');
  ln(-.18, .40, -.80, .64, .12, '#aeb4ba'); ln(-.77, .625, -.86, .67, .13, '#333');
  g.strokeStyle = '#aeb4ba'; g.lineWidth = .06; g.beginPath(); g.moveTo(.30, .58); g.bezierCurveTo(.48, .45, .40, .2, .1, .2); g.bezierCurveTo(-.05, .2, -.1, .35, -.18, .40); g.stroke();
  poly([[-.30, .08], [.30, .08], [.34, .50], [-.20, .55]], '#1a1a1a');
  poly([[.0, .5], [.26, .52], [.32, .80], [.06, .80]], '#8d949b'); poly([[.04, .80], [.32, .80], [.30, .88], [.06, .88]], '#222');
  poly([[-.95, .88], [-.58, .86], [-.38, .74], [-.44, .64], [-.84, .72]], RED);
  poly([[-.72, .92], [-.04, .90], [.18, .82], [-.02, .74], [-.62, .78]], BLK);
  poly([[-.40, .76], [-.02, .76], [.12, .66], [-.18, .58], [-.42, .62]], WHT);
  poly([[.00, .80], [.32, .84], [.55, 1.02], [.62, .92], [.42, .66], [.04, .62]], RED);
  poly([[.10, .74], [.40, .78], [.50, .88], [.22, .82]], WHT);
  ln(.58, 1.03, .72, 0, .08, '#c9ced3'); ln(.67, .45, .72, 0, .065, '#222');
  drawWheel(.72, 0, wh);
  g.strokeStyle = RED; g.lineWidth = .07; g.beginPath(); g.arc(.72, 0, .5, .45, 1.7); g.stroke();
  poly([[.55, 1.1], [.82, 1.0], [.78, .86], [.58, .9]], WHT); ln(.6, 1.0, .8, .93, .04, RED);
  ln(.56, 1.03, .50, 1.12, .045, '#222'); circ(.50, 1.12, .05, '#111'); ln(0, .2, .1, .2, .05, '#222');
}
function drawMower(wh) {
  const GRN = '#2e8b3e', DK = '#1f6a2d';
  g.lineCap = 'round'; g.lineJoin = 'round';
  poly([[-.35, -.02], [.55, -.02], [.6, .2], [-.3, .22]], '#6e7479'); poly([[-.3, .2], [.58, .2], [.55, .28], [-.28, .28]], '#4b5156');
  poly([[-.95, .45], [-.7, .45], [-.68, .95], [-.98, .9]], '#3b3b3b'); poly([[-.98, .9], [-.68, .95], [-.7, 1.0], [-.96, .96]], GRN); // ruohonkeruupussi
  drawWheel(-.72, 0, wh, { style: 'mower' });
  poly([[-.7, .3], [.0, .3], [.1, .58], [-.55, .62]], GRN);
  poly([[.0, .3], [.95, .3], [.98, .55], [.75, .78], [.12, .8], [.0, .6]], GRN); poly([[.12, .8], [.75, .78], [.72, .85], [.14, .87]], DK);
  for (const y of [.38, .46, .54]) ln(.9, y, .9, y + .04, .03, '#144a20'); circ(.96, .62, .06, '#fff6c8');
  g.strokeStyle = GRN; g.lineWidth = .08; g.beginPath(); g.arc(-.72, 0, .52, .15, 2.9); g.stroke();
  poly([[-.58, .84], [-.04, .86], [-.02, .74], [-.58, .7]], BLK); poly([[-.62, .84], [-.5, .86], [-.5, 1.35], [-.62, 1.3]], BLK);
  ln(-.55, .62, -.8, .7, .1, '#555');
  ln(.38, .8, .5, 1.08, .05, '#333'); g.save(); g.translate(.5, 1.1); g.rotate(.5); g.scale(1, .35); g.strokeStyle = '#222'; g.lineWidth = .08; g.beginPath(); g.arc(0, 0, .2, 0, TAU); g.stroke(); g.restore();
  drawWheel(.72, -.16, wh * 1.6, { style: 'mower', sc: .62 });
  poly([[-.12, .16], [.38, .16], [.38, .22], [-.12, .22]], '#2a2f33');
}
function drawATV(wh) {
  const Y = '#f2c200';
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.save(); g.globalAlpha = .5; drawWheel(-.8, .05, wh, { style: 'atv', sc: .95 }); drawWheel(.8, .05, wh, { style: 'atv', sc: .95 }); g.restore();
  ln(-.2, .35, -.95, .58, .1, '#aeb4ba');
  poly([[-.45, .12], [.4, .12], [.45, .45], [-.4, .5]], '#222'); poly([[.0, .4], [.25, .42], [.3, .72], [.05, .72]], '#8d949b');
  ln(-1.0, .86, -.5, .86, .05, '#333'); ln(-.98, .86, -.98, .7, .04, '#333');
  poly([[-1.02, .78], [-.55, .8], [-.4, .62], [-.5, .5], [-.97, .55]], Y);
  poly([[-.62, .88], [.15, .92], [.2, .82], [.05, .77], [-.6, .75]], BLK);
  poly([[.05, .74], [.45, .8], [.7, .95], [.78, .8], [.55, .55], [.1, .5]], Y);
  drawWheel(-.72, 0, wh, { style: 'atv' });
  ln(.62, .98, .72, 0, .07, '#444');
  drawWheel(.72, 0, wh, { style: 'atv' });
  g.strokeStyle = Y; g.lineWidth = .07; g.beginPath(); g.arc(.72, 0, .55, .3, 1.9); g.stroke(); g.beginPath(); g.arc(-.72, 0, .55, 1.2, 2.9); g.stroke();
  poly([[.45, .55], [1.02, .58], [1.1, .42], [.92, .3], [.55, .32]], Y); circ(1.0, .52, .06, '#fff6c8'); ln(.7, .64, 1.05, .64, .04, '#333');
  ln(.58, 1.0, .5, 1.12, .05, '#222'); circ(.5, 1.12, .05, '#111');
  poly([[-.2, .12], [.5, .12], [.5, .18], [-.2, .18]], '#222');
}
function drawScooter(wh) {
  const T = '#16c0b0', WH = '#f2f6f8', o = { style: 'scooter', sc: .74 }, cy = -.11;
  g.lineCap = 'round'; g.lineJoin = 'round';
  drawWheel(-.72, cy, wh, o);
  g.strokeStyle = WH; g.lineWidth = .05; g.beginPath(); g.arc(-.72, cy, .36, .2, 2.9); g.stroke(); circ(-.98, .1, .04, '#ff3b3b');
  poly([[-.62, .06], [.58, .06], [.58, .15], [-.62, .15]], '#2a2f33'); poly([[-.2, -.04], [.5, -.04], [.5, .06], [-.2, .06]], T); ln(-.5, .15, .5, .15, .02, '#555');
  ln(.72, cy, .56, .75, .08, WH); ln(.56, .75, .5, 1.06, .06, '#c9ced3'); circ(.58, .55, .06, '#333'); poly([[.5, .9], [.62, .9], [.62, 1.0], [.5, 1.0]], T); circ(.68, .35, .045, '#ffe98a');
  drawWheel(.72, cy, wh, o);
  g.strokeStyle = WH; g.lineWidth = .05; g.beginPath(); g.arc(.72, cy, .36, .5, 1.9); g.stroke();
  ln(.5, 1.12, .4, 1.1, .03, '#222'); circ(.5, 1.12, .05, '#111');
}
function drawBikeBody(wh) { ({ bike: drawMoto, mower: drawMower, atv: drawATV, scooter: drawScooter })[S.vehicle.id](wh); }
function drawRider(p, free, t) {
  const r = S.rider, hip = [p.hx, p.hy], sh = [p.sx, p.sy];
  let hand = [.5, 1.1], foot = [.06, .2];
  if (free) { hand = [sh[0] + Math.cos(t * 7) * .55 + .1, sh[1] + Math.sin(t * 6) * .5 - .1]; foot = [hip[0] + Math.cos(t * 5 + 1) * .7, hip[1] - .35 + Math.sin(t * 6 + 2) * .45]; }
  const knee = ik(hip[0], hip[1], foot[0], foot[1], .45, .45, 1), elb = ik(sh[0], sh[1], hand[0], hand[1], .34, .34, -1);
  ln(hip[0], hip[1], knee[0], knee[1], .17, r.pants); ln(knee[0], knee[1], foot[0], foot[1], .14, r.pants);
  poly([[foot[0] - .08, foot[1] - .05], [foot[0] + .2, foot[1] - .05], [foot[0] + .2, foot[1] + .05], [foot[0] - .05, foot[1] + .2]], '#1b1b1b'); ln(foot[0] - .05, foot[1] + .12, foot[0] + .05, foot[1] + .14, .04, '#fff');
  ln(hip[0], hip[1], sh[0], sh[1], .27, r.suit); circ(hip[0], hip[1], .14, r.pants); ln(hip[0] + (sh[0] - hip[0]) * .5, hip[1] + (sh[1] - hip[1]) * .5, sh[0], sh[1], .06, '#fff');
  ln(sh[0], sh[1], elb[0], elb[1], .11, r.suit); ln(elb[0], elb[1], hand[0], hand[1], .095, r.suit); circ(hand[0], hand[1], .065, '#111');
  const dx = sh[0] - hip[0], dy = sh[1] - hip[1], dl = Math.hypot(dx, dy) || 1, hx = sh[0] + dx / dl * .24 + .03, hy = sh[1] + dy / dl * .24;
  if (r.g === 'f') { const sw = Math.sin(S.time * 9) * .04 * Math.min(1, S.bike.v / 10); g.strokeStyle = r.hair; g.lineWidth = .1; g.beginPath(); g.moveTo(hx - .14, hy + .06); g.quadraticCurveTo(hx - .35, hy + .04 + sw, hx - .5 - Math.min(.2, S.bike.v * .01), hy - .12 + sw * 2); g.stroke(); }
  circ(hx, hy, .17, r.suit); ln(hx - .12, hy + .1, hx + .1, hy + .13, .045, '#fff');
  poly([[hx + .04, hy + .1], [hx + .28, hy + .06], [hx + .2, hy + .15], [hx + .03, hy + .16]], r.suit);
  poly([[hx + .05, hy - .01], [hx + .19, hy + .02], [hx + .18, hy + .1], [hx + .05, hy + .09]], '#10151a'); poly([[hx + .08, hy + .02], [hx + .16, hy + .035], [hx + .155, hy + .08], [hx + .08, hy + .07]], '#8fd8ff');
  poly([[hx + .09, hy - .02], [hx + .2, hy - .06], [hx + .16, hy - .16], [hx + .02, hy - .12]], '#222');
}
function drawBike(b, gl, ppm, ax, camX, withRider) {
  const x = ax * W + (b.x - camX) * ppm, y = gl - b.y * ppm;
  let jx = 0, jy = 0; if (S.engine && b.v < 1) { const a = .004 + S.holdP * .012; jx = Math.sin(S.time * 70) * a; jy = Math.cos(S.time * 83) * a; }
  g.save(); g.translate(x + jx * ppm, y - jy * ppm); g.rotate(b.ang); g.scale(ppm, -ppm); drawBikeBody(b.wheel);
  if (withRider) drawRider(S.rp, false); g.restore();
}
function drawBodies(gl, ppm, ax, camX) {
  const c = S.crash;
  if (c) {
    const o = c.bike; g.save(); g.translate(ax * W + (o.x - camX) * ppm, gl - o.y * ppm); g.rotate(o.ang); g.scale(ppm, -ppm); drawBikeBody(S.bike.wheel); g.restore();
    const r = c.rider; g.save(); g.translate(ax * W + (r.x - camX) * ppm, gl - r.y * ppm); g.rotate(r.ang); g.scale(ppm, -ppm); g.translate(-.1, -1); drawRider(POSES.air, true, S.time); g.restore();
  } else drawBike(S.bike, gl, ppm, ax, camX, true);
}
function drawParticles(gl, ppm, ax, camX) {
  for (const o of S.particles) { const a = (1 - o.t / o.life) * .5, x = ax * W + (o.x - camX) * ppm, y = gl - o.y * ppm; g.fillStyle = `rgba(206,170,120,${a})`; g.beginPath(); g.arc(x, y, o.r * ppm, 0, TAU); g.fill(); }
}
function drawStreaks(gl, ppm) {
  const v = S.bike.v; if (!['accel', 'approach'].includes(S.phase) || v < 9) return; g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineCap = 'round';
  for (let k = 0; k < 9; k++) { const len = Math.min(260, v * 7) * (.5 + hash(k, 2)), x = (((hash(k, 1) * (W + 300)) - S.time * v * ppm * (.8 + hash(k, 3) * .6)) % (W + 300) + W + 300) % (W + 300) - 100, y = gl + (.15 + hash(k, 4) * 1.4) * ppm; if (y > H) continue; g.lineWidth = 1 + hash(k, 5) * 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke(); }
}

function draw() {
  g.setTransform(dpr, 0, 0, dpr, 0, 0); const c = S.cam, ppm = c.ppm, gsY = H * .74, gl = gsY + c.y * ppm;
  const sh = c.shake; g.save(); if (sh > 0) g.translate((Math.random() - .5) * sh * 14, (Math.random() - .5) * sh * 14);
  drawScene(gsY, gl, ppm, c.x, c.ax); drawFlag(gl, ppm, c.x, c.ax); drawMarkers(gl, ppm, c.x, c.ax); drawRamp(gl, ppm, c.x, c.ax);
  drawParticles(gl, ppm, c.ax, c.x); drawBodies(gl, ppm, c.ax, c.x); drawStreaks(gl, ppm); g.restore();
  if (S.phase !== 'menu') drawHUD(); else drawMenuTitleShade();
}
function drawMenuTitleShade() { g.fillStyle = 'rgba(8,16,28,.35)'; g.fillRect(0, 0, W, H); }

/* ---------- 5) HUD ---------------------------------------------------------- */
const PHASE_TITLE = { start: 'KÄYNNISTYS', wind: 'TUULEN SEURANTA', accel: 'VAUHDINOTTO', approach: 'ASENTO JA PONNISTUS', flight: 'LENTO', landed: 'MAAHAN!', missed: '', crash: '', done: '' };
function drawSpeedo(cx, cy, R, kmh, locked) {
  const A0 = Math.PI * .75, SW = Math.PI * 1.5, max = cfg.maxSpeed; g.save(); g.translate(cx, cy);
  circ(0, 0, R + 6 * ui, 'rgba(10,16,24,.88)'); g.strokeStyle = '#cfd6dc'; g.lineWidth = 3 * ui; g.beginPath(); g.arc(0, 0, R + 4 * ui, 0, TAU); g.stroke();
  const bands = [[0, .6, '#3ddc66'], [.6, .85, '#ffd23f'], [.85, 1, '#ff4d4d']]; g.lineWidth = R * .07; g.lineCap = 'butt';
  for (const [a, b, c] of bands) { g.strokeStyle = c; g.beginPath(); g.arc(0, 0, R * .88, A0 + SW * a, A0 + SW * b); g.stroke(); }
  for (let i = 0; i <= 10; i++) { const a = A0 + SW * i / 10, maj = i % 2 === 0, r1 = R * (maj ? .70 : .76), r2 = R * .82; ln(Math.cos(a) * r1, Math.sin(a) * r1, Math.cos(a) * r2, Math.sin(a) * r2, (maj ? 2.4 : 1.4) * ui, '#e8edf1');
    if (maj) txt(String(Math.round(max * i / 10)), Math.cos(a) * R * .56, Math.sin(a) * R * .56, R * .15, '#e8edf1', 'center', null); }
  const a = A0 + SW * clamp(kmh / max, 0, 1); g.lineCap = 'round'; ln(0, 0, Math.cos(a) * R * .78, Math.sin(a) * R * .78, 4 * ui, '#ff3b30'); circ(0, 0, R * .08, '#e8edf1');
  txt(String(Math.round(kmh)), 0, R * .42, R * .34, '#fff', 'center', null); txt('km/h', 0, R * .66, R * .14, '#9fb0bd', 'center', null);
  if (locked) txt('LUKITTU', 0, -R * .22, R * .15, '#ffd23f', 'center', null);
  g.restore();
}
function drawWindRose(cx, cy, R) {
  const wi = windInfo(); g.save(); g.translate(cx, cy);
  circ(0, 0, R + 5 * ui, 'rgba(10,16,24,.82)'); g.strokeStyle = wi.col; g.lineWidth = 7 * ui; g.beginPath(); g.arc(0, 0, R * .9, 0, TAU); g.stroke();
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8; ln(Math.cos(a) * R * .66, Math.sin(a) * R * .66, Math.cos(a) * R * .76, Math.sin(a) * R * .76, 1.5 * ui, 'rgba(255,255,255,.5)'); }
  poly([[R * .7, 0], [R * .56, -R * .08], [R * .56, R * .08]], 'rgba(255,255,255,.55)'); // ajosuunta oikealle
  const a = S.wind.phi, L = R * (.28 + .42 * clamp(wi.w / 10, 0, 1)), ca = Math.cos(a), sa = Math.sin(a);
  ln(-ca * L, -sa * L, ca * L, sa * L, 4.5 * ui, '#fff'); poly([[ca * (L + R * .2), sa * (L + R * .2)], [ca * L - sa * R * .13, sa * L + ca * R * .13], [ca * L + sa * R * .13, sa * L - ca * R * .13]], '#fff');
  g.restore();
  txt(wi.w.toFixed(1) + ' m/s', cx, cy + R + 18 * ui, 15 * ui, wi.col); txt(wi.label, cx, cy + R + 34 * ui, 12 * ui, '#e8edf1');
}
function drawRings(pt) {
  const cx = W * (W > H ? .6 : .55), cy = H * .37, R = 70 * ui;
  const i = S.rings.findIndex(r => !r.done), fx = S.ringFx;
  if (fx && nowS() - fx.t < .7) { const k = (nowS() - fx.t) / .7; g.globalAlpha = 1 - k * k; txt(fx.text, cx, cy - R - 24 * ui - k * 18 * ui, 26 * ui, fx.col); g.globalAlpha = 1; }
  // pisteet
  S.rings.forEach((r, k) => circ(cx + (k - 1) * 26 * ui, cy + R + 22 * ui, 8 * ui, !r.done ? 'rgba(255,255,255,.35)' : r.score >= .75 ? '#3ddc66' : r.score >= .5 ? '#ffd23f' : '#ff4d4d'));
  if (i < 0) return; const r = S.rings[i]; if (pt < r.t0 - .15) return; const fade = clamp((pt - (r.t0 - .15)) / .15, 0, 1); g.globalAlpha = fade;
  circ(cx, cy, R + 8 * ui, 'rgba(10,16,24,.45)');
  g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 4 * ui; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
  g.strokeStyle = '#3de86a'; g.lineWidth = 8 * ui; g.beginPath(); g.arc(cx, cy, R * RING_ZONE, 0, TAU); g.stroke(); g.strokeStyle = 'rgba(61,232,106,.25)'; g.lineWidth = 3 * ui; g.beginPath(); g.arc(cx, cy, R * (RING_ZONE + RING_TOL * .5), 0, TAU); g.stroke();
  const rr = ringRadius(r, pt) * R; g.strokeStyle = '#ffd23f'; g.lineWidth = 7 * ui; g.beginPath(); g.arc(cx, cy, Math.max(2, rr), 0, TAU); g.stroke();
  txt(String(i + 1), cx, cy + 2, 40 * ui, '#fff'); g.globalAlpha = 1;
  txt(['SEISOMAAN', 'TAAKSE', 'KYYKKYYN'][i], cx, cy - R - 20 * ui, 22 * ui, '#fff');
}
function drawTakeoffBar(pt) {
  const tl = S.ap.tLip, t = pt - (tl - .8); if (S.rings.some(r => !r.done) || t < -.3) return;
  const bw = Math.min(W * .6, 460), bx = (W - bw) / 2, by = H * .27, bh = 16 * ui, p = clamp((pt - (tl - .8)) / .8, 0, 1);
  g.fillStyle = 'rgba(10,16,24,.7)'; g.fillRect(bx - 3, by - 3, bw + 6, bh + 6); g.fillStyle = '#ffd23f'; g.fillRect(bx, by, bw * p, bh);
  g.fillStyle = 'rgba(61,232,106,.55)'; g.fillRect(bx + bw * (1 - .06 / .8 * 1.6), by, bw * (.06 / .8 * 1.6), bh);
  ln(bx + bw, by - 6, bx + bw, by + bh + 6, 4, '#fff');
  if (!S.takeoff) txt('PONNISTA KEULALLA!', W / 2, by - 24 * ui, 28 * ui * (1 + Math.sin(S.time * 18) * .04), '#fff');
  else txt(S.takeoff.text, W / 2, by - 24 * ui, 24 * ui, S.takeoff.score >= .6 ? '#5cff7a' : '#ffa24a');
}
function drawHUD() {
  const ph = S.phase, pt = phaseT(), hh = 44 * ui;
  g.fillStyle = 'rgba(10,16,24,.75)'; g.fillRect(0, 0, W, hh);
  txt(S.track.name.toUpperCase() + ' · ' + S.rider.name + ' · ' + S.vehicle.name, 14 * ui, hh / 2, 15 * ui, '#cfd6dc', 'left', null);
  txt(PHASE_TITLE[ph] || '', W / 2, hh / 2, 19 * ui, '#fff', 'center', null);
  let tm = ''; if (ph === 'wind') tm = Math.max(0, Math.ceil(cfg.windWait - pt)) + ' s'; if (ph === 'accel') tm = Math.max(0, cfg.accelTime - pt).toFixed(1) + ' s';
  if (tm) txt(tm, W - 14 * ui, hh / 2, 22 * ui, ph === 'wind' && cfg.windWait - pt < 5 ? '#ff6b5b' : '#ffd23f', 'right', null);
  if (ph === 'wind') { g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(0, hh, W, 5); g.fillStyle = cfg.windWait - pt < 5 ? '#ff4d4d' : '#ffd23f'; g.fillRect(0, hh, W * clamp(1 - pt / cfg.windWait, 0, 1), 5); }
  const windPhases = ['start', 'wind', 'accel', 'approach', 'flight'];
  if (windPhases.includes(ph)) drawWindRose(W - (58 + 6) * ui, hh + (52 + 8) * ui, 46 * ui);
  const sr = 66 * ui;
  if (ph === 'accel' || ph === 'approach') drawSpeedo(sr + 14 * ui, H - sr - 18 * ui - (ph === 'accel' ? 0 : 0), sr, ph === 'approach' ? S.lockedSpeed : S.speedKmh, ph === 'approach');
  if (ph === 'accel') {
    const bw = Math.min(W * .4, 360), bx = W / 2 - bw / 2 + (W > 700 ? 0 : sr * .6), by = H - 44 * ui, p = clamp(S.taps / cfg.maxTaps, 0, 1);
    g.fillStyle = 'rgba(10,16,24,.75)'; g.fillRect(bx - 4, by - 4, bw + 8, 20 * ui + 8); g.fillStyle = '#3de86a'; g.fillRect(bx, by, bw * p, 20 * ui);
    txt(`klikkaukset ${S.taps} / ${cfg.maxTaps}   ·   ${S.rate.toFixed(1)} /s`, bx + bw / 2, by - 16 * ui, 15 * ui, '#fff');
    if (S.taps < 3) txt('KLIKKAA!', W * .56, H * .4, 54 * ui * (1 + Math.sin(S.time * 14) * .06), '#fff');
  }
  if (ph === 'approach') { drawRings(pt); drawTakeoffBar(pt); }
  if (ph === 'flight' && S.F) {
    const F = S.F, u = Math.min(1, F.t / F.Tf);
    txt(F.d.toFixed(1) + ' m', W / 2, hh + 38 * ui, 44 * ui, '#fff'); txt('lukittu ' + Math.round(S.lockedSpeed) + ' km/h', W / 2, hh + 70 * ui, 14 * ui, '#cfd6dc', 'center', null);
    const bw = Math.min(W * .34, 300), bx = W / 2 - bw / 2, by = H - 62 * ui, bh = 18 * ui, e = clamp((F.th - idealAng(F, u)) / cfg.balTol, -1.2, 1.2);
    g.fillStyle = 'rgba(10,16,24,.78)'; g.fillRect(bx - 4, by - 4, bw + 8, bh + 8); g.fillStyle = 'rgba(255,60,60,.5)'; g.fillRect(bx, by, bw, bh);
    g.fillStyle = 'rgba(255,210,60,.7)'; g.fillRect(bx + bw * .25, by, bw * .5, bh); g.fillStyle = 'rgba(61,232,106,.85)'; g.fillRect(bx + bw * .4, by, bw * .2, bh);
    g.fillStyle = '#fff'; g.fillRect(bx + bw * (.5 + e * .5) - 4, by - 8, 8, bh + 16);
    txt('nokka ylhäällä', bx, by - 14 * ui, 12 * ui, '#fff', 'left'); txt('nokka alhaalla', bx + bw, by - 14 * ui, 12 * ui, '#fff', 'right');
    const co = S.callout, age = co ? nowS() - co.t : 99;
    if (co && age < co.dur) { g.globalAlpha = clamp((co.dur - age) / .3, 0, 1); txt(co.text, W / 2, H * .3 + 34 * ui, 28 * ui, co.col); g.globalAlpha = 1; }
    else if (u < .4) txt('PIDÄ BALANSSI! ◀ ▶', W / 2, H * .3 + 34 * ui, 26 * ui, '#fff');
  }
  if ((ph === 'landed' || ph === 'done') && S.result) txt(S.result.d.toFixed(2) + ' m', W / 2, H * .24, 62 * ui, '#fff');
  if (ph === 'landed' && S.callout && nowS() - S.callout.t < S.callout.dur) txt(S.callout.text, W / 2, H * .42, 30 * ui, S.callout.col);
}


/* ---------- ÄÄNET (WebAudio-syntetisaattori, ei äänitiedostoja) --------------- */
const AU = { ctx: null, master: null, noise: null, eng: null, wind: null, vid: '', revBoost: 0, lastTick: -1, muted: store.get('tammisaariMute', false) };
const VSND = {
  bike:    { w1: 'sawtooth', w2: 'square',   r2: 2.01, idle: 36,  top: 170, lfo: [10, 46], lp: [500, 2600], gain: .12 },
  mower:   { w1: 'square',   w2: 'sawtooth', r2: 1.5,  idle: 24,  top: 80,  lfo: [7, 24],  lp: [380, 1200], gain: .13 },
  atv:     { w1: 'sawtooth', w2: 'triangle', r2: .5,   idle: 28,  top: 110, lfo: [8, 30],  lp: [450, 1700], gain: .13 },
  scooter: { w1: 'sine',     w2: 'triangle', r2: 2,    idle: 140, top: 820, lfo: [.2, .2], lp: [2500, 4200], gain: .05 },
};
function audioInit() {
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  try {
    const c = new AC(); AU.master = c.createGain(); AU.master.gain.value = AU.muted ? 0 : .6; AU.master.connect(c.destination);
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; AU.noise = nb;
    const ns = c.createBufferSource(); ns.buffer = nb; ns.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = .7; bp.frequency.value = 500;
    const wg = c.createGain(); wg.gain.value = 0; ns.connect(bp); bp.connect(wg); wg.connect(AU.master); ns.start(); AU.wind = { bp, g: wg };
    const o1 = c.createOscillator(), o2 = c.createOscillator(), lp = c.createBiquadFilter(), eg = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    lp.type = 'lowpass'; lp.Q.value = 2; eg.gain.value = 0; lg.gain.value = 0; lfo.connect(lg); lg.connect(eg.gain);
    o1.connect(lp); o2.connect(lp); lp.connect(eg); eg.connect(AU.master); o1.start(); o2.start(); lfo.start();
    AU.eng = { o1, o2, lp, eg, lfo, lg }; AU.ctx = c;
  } catch (e) { AU.ctx = null; }
}
function audioFrame() {
  const c = AU.ctx; if (!c || !AU.eng) return;
  const t = c.currentTime, V = VSND[S.vehicle.id], ph = S.phase, wi = windInfo(), E = AU.eng, dt = .016;
  if (AU.vid !== S.vehicle.id) { AU.vid = S.vehicle.id; E.o1.type = V.w1; E.o2.type = V.w2; }
  AU.revBoost = Math.max(0, AU.revBoost - dt * 1.1);
  const spd = clamp(S.speedKmh / cfg.maxSpeed, 0, 1), lock = clamp(S.lockedSpeed / cfg.maxSpeed, 0, 1), held = S.held.l + S.held.r;
  let rev = 0, gain = 0, depth = .6, lfoRate = null, air = 0;
  if (ph === 'start' && S.holdP > 0) { rev = .06 + S.holdP * .1 + Math.sin(S.time * 40) * .03; gain = .6; depth = .9; lfoRate = 15; }
  else if (ph === 'wind') { rev = .1 + AU.revBoost * .8; gain = .55; }
  else if (ph === 'accel') { rev = .15 + spd * .85; gain = .85; air = spd; }
  else if (ph === 'approach') { rev = .15 + lock * .7; gain = .8; air = lock; }
  else if (ph === 'flight') { rev = .85 + Math.sin(S.time * 25) * .05 + held * .1; gain = .7; air = .85; }
  else if (ph === 'landed') { rev = .25; gain = .5; air = .3; }
  else if (ph === 'missed') { rev = .3; gain = .5; air = .3; }
  const f = V.idle + (V.top - V.idle) * clamp(rev, 0, 1), vol = gain * V.gain;
  E.o1.frequency.setTargetAtTime(f, t, .05); E.o2.frequency.setTargetAtTime(f * V.r2, t, .05);
  E.lp.frequency.setTargetAtTime(lerp(V.lp[0], V.lp[1], clamp(rev, 0, 1)), t, .08);
  E.eg.gain.setTargetAtTime(vol, t, .06); E.lfo.frequency.setTargetAtTime(lfoRate || lerp(V.lfo[0], V.lfo[1], clamp(rev, 0, 1)), t, .1);
  E.lg.gain.setTargetAtTime(S.vehicle.id === 'scooter' ? 0 : vol * depth, t, .1);
  const quiet = ph === 'done' || ph === 'crash' ? .3 : 1, wg = ((ph === 'menu' ? .01 : .012) + wi.w / 12 * .05 + air * .11) * quiet;
  AU.wind.g.gain.setTargetAtTime(wg, t, .1); AU.wind.bp.frequency.setTargetAtTime(260 + wi.w * 35 + air * 1100 + S.wind.g * 60, t, .1);
}
function tone(f0, f1, dur, type = 'sine', vol = .15, delay = 0) {
  const c = AU.ctx; if (!c || AU.muted) return; const t = c.currentTime + delay, o = c.createOscillator(), a = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  a.gain.setValueAtTime(.0001, t); a.gain.exponentialRampToValueAtTime(vol, t + Math.min(.02, dur / 3)); a.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(a); a.connect(AU.master); o.start(t); o.stop(t + dur + .05);
}
function noiseBurst(dur, vol, f0, f1, type = 'lowpass', delay = 0) {
  const c = AU.ctx; if (!c || AU.muted) return; const t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), a = c.createGain();
  s.buffer = AU.noise; f.type = type; f.Q.value = .8; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  a.gain.setValueAtTime(vol, t); a.gain.exponentialRampToValueAtTime(.0001, t + dur); s.connect(f); f.connect(a); a.connect(AU.master); s.start(t, Math.random()); s.stop(t + dur + .05);
}
const sfx = {
  tap(sp) { tone(480 + sp * 400, 420 + sp * 400, .04, 'square', .035); },
  ring(s) { if (s >= .93) { tone(784, 784, .12, 'sine', .2); tone(1175, 1175, .22, 'sine', .18, .07); } else if (s >= .5) tone(587, 587, .14, 'triangle', .2); else tone(160, 100, .25, 'sawtooth', .12); },
  takeoffTap(s) { tone(s >= .6 ? 880 : 300, s >= .6 ? 1100 : 200, .1, 'triangle', .15); },
  pop() { noiseBurst(.45, .25, 300, 2400, 'bandpass'); tone(160, 520, .3, 'triangle', .12); },
  land() { tone(130, 40, .4, 'sine', .45); noiseBurst(.3, .3, 1400, 200); },
  crash() { noiseBurst(.8, .5, 3500, 200); tone(110, 35, .6, 'sawtooth', .25); tone(420, 160, .18, 'square', .1, .12); tone(300, 120, .2, 'square', .08, .3); },
  sad() { [[392, 370], [370, 349], [349, 330], [330, 180]].forEach(([a, b], i) => tone(a, b, i === 3 ? .7 : .28, 'sawtooth', .14, i * .3)); },
  win(big) { (big ? [523, 659, 784, 1047, 1319] : [523, 659, 784]).forEach((f, i) => tone(f, f, .22, 'triangle', .2, i * .11)); if (big) tone(1047, 1047, .6, 'sine', .18, .6); },
  start() { AU.revBoost = 1; tone(220, 330, .1, 'square', .1); },
  tick() { tone(1000, 900, .05, 'square', .07); },
  good() { tone(660, 990, .25, 'sine', .15); },
  ui() { tone(620, 520, .05, 'triangle', .08); },
};
function setMuted(m) {
  AU.muted = m; store.set('tammisaariMute', m); $('#btnMute').textContent = m ? '🔇' : '🔊';
  if (AU.master) AU.master.gain.setTargetAtTime(m ? 0 : .6, AU.ctx.currentTime, .05);
}

/* ---------- 6) KÄYTTÖLIITTYMÄ JA SYÖTTEET ---------------------------------- */
const CARDS = ['menu', 'startDock', 'windDock', 'result', 'modal'];
function showCard(id) { CARDS.forEach(c => $('#' + c).classList.toggle('hidden', c !== id)); }

function avatarSVG(r) {
  const skin = '#f2c9a0', f = r.g === 'f';
  return `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="31" fill="#dfe8ee"/>
  <path d="M8 63 Q10 44 32 44 Q54 44 56 63Z" fill="${r.suit}"/><path d="M28 50 L36 50 L36 63 L28 63Z" fill="#fff" opacity=".85"/>
  <rect x="27" y="38" width="10" height="9" rx="3" fill="${skin}"/>
  ${f ? `<path d="M46 22 Q60 26 55 46 Q50 36 45 32Z" fill="${r.hair}"/><path d="M18 28 Q15 40 20 46 L24 32Z" fill="${r.hair}"/>` : ''}
  <circle cx="32" cy="29" r="13" fill="${skin}"/>
  <path d="M17.5 29 A14.5 14.5 0 0 1 46.5 29 L46.5 30 Q32 23 17.5 30Z" fill="${r.suit}"/>
  <path d="M19 25 Q32 17 45 25" stroke="#fff" stroke-width="2.4" fill="none"/>
  <circle cx="27" cy="32" r="1.9" fill="#222"/><circle cx="37" cy="32" r="1.9" fill="#222"/>
  <path d="M28 38 Q32 41 36 38" stroke="#a5503a" fill="none" stroke-width="1.7" stroke-linecap="round"/></svg>`;
}
function buildMenu() {
  const box = $('#riders'); box.innerHTML = '';
  RIDERS.forEach(r => {
    const b = document.createElement('button'); b.className = 'rider' + (r === S.rider ? ' on' : ''); b.innerHTML = avatarSVG(r) + r.name;
    b.addEventListener('click', () => { S.rider = r; store.set(RIDER_KEY, r.name); box.querySelectorAll('.rider').forEach(x => x.classList.remove('on')); b.classList.add('on'); $('#btnContinue').textContent = 'Jatka: ' + r.name; });
    box.appendChild(b);
  });
  $('#btnContinue').textContent = 'Jatka: ' + S.rider.name;
  const vb = $('#vehicles'); vb.innerHTML = '';
  VEHICLES.forEach(v => {
    const b = document.createElement('button'); b.className = 'veh' + (v === S.vehicle ? ' on' : ''); b.appendChild(vehicleThumb(v)); b.appendChild(document.createTextNode(v.name));
    b.addEventListener('click', () => { S.vehicle = v; store.set(VEH_KEY, v.id); vb.querySelectorAll('.veh').forEach(x => x.classList.remove('on')); b.classList.add('on'); });
    vb.appendChild(b);
  });
}
function vehicleThumb(v) {
  const c = document.createElement('canvas'); c.width = 144; c.height = 84; c.style.width = '72px'; c.style.height = '42px';
  const saved = g, saveV = S.vehicle; g = c.getContext('2d'); S.vehicle = v;
  try { g.translate(72, 62); g.scale(36, -36); drawBikeBody(0); } finally { g = saved; S.vehicle = saveV; }
  return c;
}
function showRecords(hi, back) {
  const a = loadRecs();
  let h = `<h2>🏆 Top 10 · ${S.track.name}</h2><ol class="top">`;
  for (let i = 0; i < 10; i++) {
    const r = a[i];
    h += `<li class="${i === 0 ? 'champ' : ''} ${hi === i ? 'me' : ''}"><span class="rk">${i + 1}.</span><span class="nm">${r ? r.rider + (r.veh ? ' · ' + r.veh : '') : '—'}${i === 0 ? '<small>Tammisaaren prätkämestari</small>' : ''}</span><span class="ds">${r ? r.d.toFixed(2) + ' m' : ''}</span></li>`;
  }
  h += `</ol><div class="row"><button id="mBack">Takaisin</button><button id="mClear" class="dark">Nollaa lista</button></div>`;
  $('#modal').innerHTML = h; showCard('modal');
  $('#mBack').addEventListener('click', () => back ? back() : showCard('menu'));
  $('#mClear').addEventListener('click', () => { if (confirm('Nollataanko Top 10?')) { store.set(REC_KEY + '_' + S.track.id, []); showRecords(-1, back); } });
}
function showSettings() {
  let h = '<div class="set"><h2>⚙ Asetukset</h2>';
  for (const [title, items] of SETTINGS) {
    h += `<h3>${title}</h3>`;
    for (const [k, label, min, max, step] of items) h += `<label>${label}<input type="number" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${cfg[k]}" inputmode="decimal"></label>`;
  }
  h += '<div class="btns row"><button id="sSave">Tallenna</button><button id="sDef" class="dark">Oletukset</button><button id="sBack" class="dark">Takaisin</button></div></div>';
  $('#modal').innerHTML = h; showCard('modal');
  $('#sSave').addEventListener('click', () => {
    document.querySelectorAll('[data-k]').forEach(i => { const v = parseFloat(String(i.value).replace(',', '.')); if (Number.isFinite(v)) cfg[i.dataset.k] = clamp(v, +i.min, +i.max); });
    store.set(CFG_KEY, cfg); S.cam.ppm = targetPpm(); showCard('menu');
  });
  $('#sDef').addEventListener('click', () => { Object.assign(cfg, DEFAULTS); store.set(CFG_KEY, cfg); showSettings(); });
  $('#sBack').addEventListener('click', () => showCard('menu'));
}

/* syötteet */
const inUI = e => e.target && e.target.closest && e.target.closest('button,.card,.dock,input,label');
window.addEventListener('pointerdown', audioInit, true); window.addEventListener('keydown', audioInit, true);
window.addEventListener('click', e => { if (e.target && e.target.closest && e.target.closest('button')) sfx.ui(); }, true);
$('#btnMute').addEventListener('click', () => { audioInit(); setMuted(!AU.muted); });
document.addEventListener('visibilitychange', () => { if (AU.ctx) document.hidden ? AU.ctx.suspend() : AU.ctx.resume(); });
window.addEventListener('pointerdown', e => { if (inUI(e)) return; tap(); });
window.addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'Enter') { if (['accel', 'approach'].includes(S.phase)) { e.preventDefault(); tap(); } }
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') S.held.l = 1; if (e.code === 'ArrowRight' || e.code === 'KeyD') S.held.r = 1;
});
window.addEventListener('keyup', e => { if (e.code === 'ArrowLeft' || e.code === 'KeyA') S.held.l = 0; if (e.code === 'ArrowRight' || e.code === 'KeyD') S.held.r = 0; });
window.addEventListener('blur', () => { S.held.l = S.held.r = 0; });
function bindHold(sel, key) {
  const el = $(sel);
  el.addEventListener('pointerdown', e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (x) { } S.held[key] = 1; });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => el.addEventListener(t, () => { S.held[key] = 0; }));
}
bindHold('#btnL', 'l'); bindHold('#btnR', 'r');
$('#btnStart').addEventListener('pointerdown', holdBegin);
window.addEventListener('pointerup', holdEnd); window.addEventListener('pointercancel', holdEnd);
$('#btnGo').addEventListener('click', beginAccel);
$('#btnContinue').addEventListener('click', () => resetRun('start'));
$('#btnRecords').addEventListener('click', () => showRecords(-1, null));
$('#btnSettings').addEventListener('click', showSettings);
document.addEventListener('contextmenu', e => e.preventDefault());

/* pääsilmukka */
let prev = nowS();
function loop() {
  const n = nowS(), dt = Math.min(.05, Math.max(0, n - prev)); prev = n;
  try { update(dt); draw(); } catch (err) { console.error(err); }
  requestAnimationFrame(loop);
}
const savedRider = store.get(RIDER_KEY, null); S.rider = RIDERS.find(r => r.name === savedRider) || RIDERS[0]; S.vehicle = VEHICLES.find(v => v.id === store.get(VEH_KEY, '')) || VEHICLES[0]; $('#btnMute').textContent = AU.muted ? '🔇' : '🔊';
buildMenu(); initWind(); S.cam.ppm = targetPpm(); resetRun('menu'); requestAnimationFrame(loop);
window.__mx = { S, cfg, tap, resetRun }; // apuväline kehitykseen/testaukseen
})();
