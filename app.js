/* ============================================================
   Girl Walk — Web2App Funnel
   Vanilla screen router + quiz state + results + paywall
   ============================================================ */
(function () {
  'use strict';

  const STORAGE_KEY = 'gw_funnel_v1';

  // ---- State (all quiz answers; persisted) ----
  const state = loadState();
  if (!state.unit) state.unit = 'metric';
  if (!state.plan) state.plan = 'annual';

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  // ---- Elements ----
  const screensEl   = document.getElementById('screens');
  const topbar      = document.getElementById('topbar');
  const backBtn     = document.getElementById('backBtn');
  const progressFil = document.getElementById('progressFill');
  const heroVideo   = document.getElementById('heroVideo');

  const screens = Array.from(screensEl.querySelectorAll('[data-screen]'));
  const order   = screens.map(s => s.dataset.screen);
  // Quiz question screens that advance the progress bar.
  const stepScreens = screens.filter(s => 'step' in s.dataset).map(s => s.dataset.screen);

  const history = [];
  let current = null;
  let lastPct = 0;

  // Per-screen "on show" hooks
  const onShow = {};

  function show(id, isBack) {
    const target = screens.find(s => s.dataset.screen === id);
    if (!target) return;

    screens.forEach(s => s.classList.toggle('is-active', s === target));

    if (!isBack && current && current !== id) history.push(current);
    current = id;

    // Top bar + progress
    const noTopbar = 'noTopbar' in target.dataset;
    topbar.hidden = noTopbar;
    backBtn.disabled = history.length === 0;

    const stepIdx = stepScreens.indexOf(id);
    if (stepIdx !== -1) {
      lastPct = Math.min(((stepIdx + 1) / stepScreens.length) * 100, 100);
    }
    if (!noTopbar) progressFil.style.width = lastPct + '%';

    // Reflect any saved selections on this screen
    restoreSelections(target);
    refreshButtons(target);

    // Hero video: play when shown, pause otherwise.
    // iOS needs muted+playsInline set as properties; autoplay can still be
    // blocked (e.g. Low Power Mode) — the poster shows meanwhile, and a
    // one-time tap resumes playback.
    if (heroVideo) {
      if (id === 'intro') {
        heroVideo.muted = true;
        heroVideo.playsInline = true;
        heroVideo.play().catch(() => {});
      } else {
        heroVideo.pause();
      }
    }

    if (onShow[id]) onShow[id](target);

    if (window.GW) GW.track('ScreenView', { screen: id, step: stepIdx >= 0 ? stepIdx + 1 : null });

    target.scrollTop = 0;
    const body = target.querySelector('.screen__body');
    if (body) body.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function next() {
    const i = order.indexOf(current);
    if (i > -1 && i < order.length - 1) show(order[i + 1]);
  }
  function back() {
    if (history.length === 0) return;
    show(history.pop(), true);
  }

  // ---- Selection persistence ----
  function restoreSelections(screenEl) {
    screenEl.querySelectorAll('[data-question]').forEach(el => {
      const q = el.dataset.question, v = el.dataset.value;
      if (!q || v == null) return;
      const saved = state[q];
      const on = Array.isArray(saved) ? saved.includes(v) : saved === v;
      el.classList.toggle('is-selected', !!on);
    });
  }

  // ---- Continue-button validation ----
  function isValid(req) {
    if (req === 'stats') return !!(state.heightCm && state.weightKg && state.goalKg);
    const v = state[req];
    return Array.isArray(v) ? v.length > 0 : (v != null && v !== '');
  }
  function refreshButtons(screenEl) {
    screenEl.querySelectorAll('[data-requires]').forEach(b => {
      b.disabled = !isValid(b.dataset.requires);
    });
  }

  // ---- Wiring: navigation + choices ----
  backBtn.addEventListener('click', back);

  screensEl.addEventListener('click', (e) => {
    // Advance
    if (e.target.closest('[data-next]')) { next(); return; }
    // Checkout (paywall)
    if (e.target.closest('[data-action="checkout"]')) { startCheckout(); return; }

    // Plan selection (paywall)
    const planEl = e.target.closest('[data-plan]');
    if (planEl) {
      state.plan = planEl.dataset.plan; saveState();
      planEl.closest('.plans').querySelectorAll('[data-plan]')
        .forEach(p => p.classList.toggle('is-selected', p === planEl));
      return;
    }

    // Quiz choices
    const opt = e.target.closest('[data-question]');
    if (!opt) return;
    const q = opt.dataset.question, v = opt.dataset.value;
    if (!q) return;

    const screenEl = opt.closest('.screen');
    if (window.GW) GW.track('Answer', { question: q, value: v });
    if (opt.closest('[data-multi]')) {
      const set = new Set(state[q] || []);
      set.has(v) ? set.delete(v) : set.add(v);
      state[q] = Array.from(set);
      opt.classList.toggle('is-selected', set.has(v));
      saveState();
      refreshButtons(screenEl);
    } else {
      state[q] = v;
      saveState();
      screenEl.querySelectorAll('[data-question="' + q + '"]')
        .forEach(o => o.classList.toggle('is-selected', o === opt));
      refreshButtons(screenEl);
      setTimeout(next, 260); // auto-advance single-select
    }
  });

  // ============================================================
  //  STATS screen — units, conversion, BMI
  // ============================================================
  (function stats() {
    const seg   = document.getElementById('unitSeg');
    const hCm   = document.getElementById('hCm');
    const hFt   = document.getElementById('hFt');
    const hIn   = document.getElementById('hIn');
    const wCur  = document.getElementById('wCur');
    const wGoal = document.getElementById('wGoal');
    const bmiBox = document.getElementById('bmiBox');
    const bmiVal = document.getElementById('bmiVal');
    const bmiTag = document.getElementById('bmiTag');
    const statsScreen = screens.find(s => s.dataset.screen === 'stats');
    if (!seg || !statsScreen) return;

    const LB_TO_KG = 0.45359237;

    function setUnit(unit) {
      state.unit = unit; saveState();
      seg.querySelectorAll('[data-unit]').forEach(b =>
        b.classList.toggle('is-active', b.dataset.unit === unit));
      statsScreen.querySelectorAll('[data-group]').forEach(g =>
        g.hidden = g.dataset.group !== unit);
      statsScreen.querySelectorAll('[data-wunit]').forEach(u =>
        u.textContent = unit === 'metric' ? 'kg' : 'lb');
      recompute();
    }

    function recompute() {
      // Height → cm
      let cm = 0;
      if (state.unit === 'metric') {
        cm = parseFloat(hCm.value) || 0;
      } else {
        const ft = parseFloat(hFt.value) || 0;
        const inch = parseFloat(hIn.value) || 0;
        cm = (ft * 12 + inch) * 2.54;
      }
      // Weights → kg
      const toKg = (val) => state.unit === 'metric' ? val : val * LB_TO_KG;
      const cur  = parseFloat(wCur.value)  || 0;
      const goal = parseFloat(wGoal.value) || 0;

      state.heightCm = cm > 0 ? Math.round(cm) : 0;
      state.weightKg = cur > 0 ? +(toKg(cur)).toFixed(1) : 0;
      state.goalKg   = goal > 0 ? +(toKg(goal)).toFixed(1) : 0;
      saveState();

      // BMI
      if (state.heightCm && state.weightKg) {
        const m = state.heightCm / 100;
        const bmi = state.weightKg / (m * m);
        bmiVal.textContent = bmi.toFixed(1);
        let tag = 'Healthy', color = 'var(--mint)';
        if (bmi < 18.5) { tag = 'Underweight'; color = '#FFA63E'; }
        else if (bmi < 25) { tag = 'Healthy'; color = 'var(--mint)'; }
        else if (bmi < 30) { tag = 'Overweight'; color = '#FFA63E'; }
        else { tag = 'Above range'; color = 'var(--pink-dark)'; }
        bmiTag.textContent = tag;
        bmiTag.style.color = color;
        bmiBox.hidden = false;
      } else {
        bmiBox.hidden = true;
      }
      refreshButtons(statsScreen);
    }

    seg.addEventListener('click', (e) => {
      const b = e.target.closest('[data-unit]');
      if (b) setUnit(b.dataset.unit);
    });
    [hCm, hFt, hIn, wCur, wGoal].forEach(i => i && i.addEventListener('input', recompute));

    setUnit(state.unit || 'metric');
  })();

  // ============================================================
  //  "We know how" screen — tailor the lead line to the goal
  // ============================================================
  onShow.goalplan = function () {
    var lead = document.getElementById('gpLead');
    if (!lead) return;
    lead.innerHTML = state.goal === 'maintain'
      ? 'Walking is perfect for <b>staying fit, toned and energized</b> — gentle on your body and easy to stick with.'
      : 'Walking is one of the best ways to <b>burn fat and slim down</b> — gentle on your body and easy to stick with.';
  };

  // ============================================================
  //  LOADER screen — fill each category bar in sequence, then results
  // ============================================================
  onShow.loader = function () {
    const rows = Array.from(document.querySelectorAll('#calcList .calc-row'));
    if (!rows.length) return;

    // reset (in case the screen is revisited)
    rows.forEach(function (r) {
      r.querySelector('.calc-bar__fill').style.width = '0%';
      const p = r.querySelector('.calc-row__pct');
      p.textContent = '0%';
      p.classList.remove('is-done');
    });

    const ROW_MS = 850, TICK = 25;
    let i = 0;

    function runRow() {
      if (i >= rows.length) {
        setTimeout(function () { if (current === 'loader') show('results'); }, 450);
        return;
      }
      const fill = rows[i].querySelector('.calc-bar__fill');
      const pctEl = rows[i].querySelector('.calc-row__pct');
      let pct = 0;
      const inc = 100 / (ROW_MS / TICK);
      const timer = setInterval(function () {
        pct = Math.min(pct + inc, 100);
        fill.style.width = pct + '%';
        pctEl.textContent = Math.round(pct) + '%';
        if (pct >= 100) {
          clearInterval(timer);
          pctEl.textContent = '✓';
          pctEl.classList.add('is-done');
          i++;
          setTimeout(runRow, 220);
        }
      }, TICK);
    }
    runRow();
  };

  // ============================================================
  //  RESULTS screen — projected weight chart + plan
  // ============================================================
  function displayWeight(kg) {
    if (!kg) return { val: 0, unit: 'kg' };
    return state.unit === 'imperial'
      ? { val: Math.round(kg / 0.45359237), unit: 'lb' }
      : { val: Math.round(kg), unit: 'kg' };
  }
  function fmtDate(d) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  onShow.results = function () {
    const cur = state.weightKg || 70;
    const goal = state.goalKg || Math.max(cur - 6, cur * 0.9);
    const losing = goal < cur;
    const diff = Math.abs(cur - goal);

    // ~0.45 kg/week, clamped to a believable, motivating range
    let weeks = losing ? Math.round(diff / 0.45) : 8;
    weeks = Math.max(4, Math.min(weeks, 36));

    const target = new Date();
    target.setDate(target.getDate() + weeks * 7);

    const dCur = displayWeight(cur);
    const dGoal = displayWeight(goal);

    // Plan personalization
    const minByGoal = { lose_weight: 35, tone: 30, energy: 25, active: 30, heart: 30 };
    const planMin = minByGoal[state.goal] || 30;
    const planDays = parseInt(state.commitment, 10) || 5;

    document.getElementById('planMin').textContent = planMin;
    document.getElementById('planDays').textContent = planDays;
    document.getElementById('planWeeks').textContent = weeks;

    document.getElementById('goalBadge').textContent = 'Goal ' + dGoal.val + ' ' + dGoal.unit;
    document.getElementById('axisStart').textContent = 'Today · ' + dCur.val + dCur.unit;
    document.getElementById('axisEnd').textContent = fmtDate(target) + ' · ' + dGoal.val + dGoal.unit;
    document.getElementById('resultsLead').textContent =
      losing
        ? 'You could reach ' + dGoal.val + ' ' + dGoal.unit + ' by ' + fmtDate(target) + '.'
        : 'Your ' + weeks + '-week plan starts now.';

    renderChart(cur, goal);
  };

  function renderChart(cur, goal) {
    const W = 320, H = 150, padX = 14, padTop = 16, padBot = 22;
    const x0 = padX, x1 = W - padX;
    const hi = Math.max(cur, goal), lo = Math.min(cur, goal);
    const range = (hi - lo) || 1;
    const yFor = (w) => padTop + (1 - (w - lo) / range) * (H - padTop - padBot);

    const sx = x0, sy = yFor(cur);
    const ex = x1, ey = yFor(goal);
    const c1x = sx + (ex - sx) * 0.45, c1y = sy;
    const c2x = sx + (ex - sx) * 0.55, c2y = ey;

    const line = `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}`;
    const area = `${line} L ${ex} ${H - padBot} L ${sx} ${H - padBot} Z`;

    document.getElementById('chart').innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="cfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#FF4D8D" stop-opacity="0.28"/>
            <stop offset="1" stop-color="#FF4D8D" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${area}" fill="url(#cfill)"/>
        <path d="${line}" fill="none" stroke="#FF4D8D" stroke-width="3.5"
              stroke-linecap="round" vector-effect="non-scaling-stroke"/>
        <circle cx="${sx}" cy="${sy}" r="5" fill="#fff" stroke="#FF4D8D" stroke-width="3"/>
        <circle cx="${ex}" cy="${ey}" r="6" fill="#00C99A" stroke="#fff" stroke-width="3"/>
      </svg>`;
  }

  // ============================================================
  //  CHECKOUT — Superwall Web Checkout handoff (STUB)
  // ============================================================
  function startCheckout() {
    // Superwall Web Checkout: GW.checkout fires InitiateCheckout (Mixpanel + pixels),
    // then redirects to the configured placement URL with attribution + quiz data.
    if (window.GW && GW.checkout(state.plan, state)) return; // redirected
    // Not configured yet → stub so the flow is still testable.
    console.log('[GirlWalk] Superwall checkout (no URL set) — plan:', state.plan, 'state:', state);
    showToast('🔗 Superwall Web Checkout opens here\nPlan: ' + state.plan +
              '\n(set superwall.checkoutUrl in config.js)');
  }

  function showToast(msg) {
    let t = document.getElementById('gwToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'gwToast';
      t.className = 'toast';
      document.querySelector('.app').appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('is-on'), 3200);
  }

  // ---- Boot ----
  show('intro');
  if (window.GW) GW.track('FunnelStart', {});

  // iOS autoplay fallback: resume the hero video on the first user interaction
  // if the browser blocked autoplay (Low Power Mode, data saver, etc.).
  if (heroVideo) {
    var resumeHero = function () {
      if (current === 'intro' && heroVideo.paused) {
        heroVideo.muted = true;
        heroVideo.play().catch(function () {});
      }
    };
    ['touchstart', 'pointerdown', 'click'].forEach(function (ev) {
      document.addEventListener(ev, resumeHero, { once: true, passive: true });
    });
  }

  window.GWFunnel = { state, show, next, back, startCheckout };
})();
