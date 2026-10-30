/* Loop do jogo: toque + swipe no ritmo */
window.Game = (function () {
  const ROWS = [
    { bottom: 8, lefts: [11, 37, 63], row: 0 },  // base
    { bottom: 32.5, lefts: [24, 50], row: 1 },   // meio
    { bottom: 57, lefts: [37], row: 2 }          // topo
  ];

  const DIFF = {
    ensaio: { cue: 1900, penalty: 700, gap: 300, swipeBonus: 60 },
    bloco: { cue: 1350, penalty: 900, gap: 230, swipeBonus: 50 },
    apoteose: { cue: 1000, penalty: 1100, gap: 190, swipeBonus: 40 }
  };

  const TIPS = {
    ensaio: 'Sem pressa: toque no copo aceso e arraste para colher.',
    bloco: 'Toque no copo aceso antes do anel fechar. Errou? Perdeu tempo.',
    apoteose: 'No ritmo do samba! Combo alto vale mais pontos.'
  };

  let els = null;
  let state = null;
  let tokenCounter = 0;
  let onFinish = null;
  let onQuit = null;

  function cache() {
    els = {
      screen: document.getElementById('screen-game'),
      stage: document.getElementById('stage'),
      cups: document.getElementById('cups'),
      ring: document.getElementById('cue-ring'),
      floaters: document.getElementById('floaters'),
      swipeLayer: document.getElementById('swipe-layer'),
      count: document.getElementById('count'),
      pauseOverlay: document.getElementById('pause-overlay'),
      time: document.getElementById('hud-time'),
      score: document.getElementById('hud-score'),
      combo: document.getElementById('hud-combo'),
      fill: document.getElementById('timing-fill'),
      tip: document.getElementById('game-tip')
    };
  }

  function resetState(difficulty) {
    state = {
      difficulty: DIFF[difficulty] ? difficulty : 'bloco',
      diff: DIFF[difficulty] || DIFF.bloco,
      running: false,
      paused: false,
      phase: 'idle',
      token: ++tokenCounter,
      cups: [],
      rows: [],
      rowIndex: -1,
      queue: [],
      active: null,
      cueStart: 0,
      cueDur: 0,
      startTime: 0,
      pauseAt: 0,
      penaltyMs: 0,
      transitionAt: 0,
      nextAction: null,
      score: 0,
      combo: 0,
      maxCombo: 0,
      correct: 0,
      totalCues: 0,
      raf: 0,
      countTimeout: 0,
      lastPenalty: 0,
      pointer: null,
      finished: false
    };
  }

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function fmtTime(ms) {
    return (Math.max(0, ms) / 1000).toFixed(1).replace('.', ',') + 's';
  }

  function haptic(pattern) {
    if (typeof window.haptic === 'function') window.haptic(pattern);
  }

  function updateHud() {
    if (!els || !state) return;
    els.score.textContent = state.score.toLocaleString('pt-BR');
    els.combo.textContent = 'x' + state.combo;
    els.combo.style.color = state.combo >= 3 ? 'var(--gold)' : '';
  }

  function showRing(cup) {
    const stageRect = els.stage.getBoundingClientRect();
    const rect = cup.el.getBoundingClientRect();
    const size = rect.width * 1.55;
    els.ring.hidden = false;
    els.ring.style.width = size + 'px';
    els.ring.style.height = size + 'px';
    els.ring.style.left = (rect.left - stageRect.left + rect.width / 2) + 'px';
    els.ring.style.top = (rect.top - stageRect.top + rect.height / 2) + 'px';
    els.ring.style.setProperty('--cue', state.cueDur + 'ms');
    els.ring.style.animation = 'none';
    void els.ring.offsetWidth;
    els.ring.style.animation = '';
    els.ring.style.animationPlayState = 'running';
  }

  function hideRing() {
    els.ring.hidden = true;
    els.ring.style.animation = 'none';
  }

  function hideSwipe() {
    els.swipeLayer.hidden = true;
  }

  function showPause(show) {
    els.pauseOverlay.hidden = !show;
  }

  function floaterAt(x, y, text, bad) {
    const span = document.createElement('span');
    span.className = 'floater' + (bad ? ' is-bad' : '');
    span.textContent = text;
    span.style.left = x + 'px';
    span.style.top = y + 'px';
    els.floaters.appendChild(span);
    setTimeout(() => span.remove(), 900);
  }

  function floaterOn(cup, text, bad) {
    const stageRect = els.stage.getBoundingClientRect();
    const rect = cup.el.getBoundingClientRect();
    floaterAt(
      rect.left - stageRect.left + rect.width / 2,
      rect.top - stageRect.top,
      text,
      bad
    );
  }

  function floaterCenter(text, bad) {
    const rect = els.stage.getBoundingClientRect();
    floaterAt(rect.width / 2, rect.height * 0.55, text, bad);
  }

  function renderCups() {
    els.cups.innerHTML = '';
    state.cups = [];
    let id = 0;

    ROWS.forEach((row, rIdx) => {
      row.lefts.forEach((left) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'cup';
        el.dataset.id = String(id);
        el.style.left = left + '%';
        el.style.bottom = row.bottom + '%';
        el.style.zIndex = String(10 - rIdx);
        el.style.animationDelay = (0.04 * id) + 's';
        el.setAttribute('aria-label', 'Copo ' + (id + 1));

        const cup = { id, el, row: row.row, cleared: false };
        state.cups.push(cup);

        el.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          tapCup(cup);
        });

        el.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            tapCup(cup);
          }
        });

        el.addEventListener('animationend', (event) => {
          if (event.animationName === 'cupIn') el.style.animationDelay = '';
        });

        els.cups.appendChild(el);
        id++;
      });
    });
  }

  function startNextRow() {
    state.rowIndex++;
    if (state.rowIndex >= state.rows.length) {
      finish();
      return;
    }
    state.queue = state.rows[state.rowIndex].slice();
    nextCue();
  }

  function nextCue() {
    if (!state.running) return;
    const cup = state.queue.shift();
    if (!cup) {
      startSwipe();
      return;
    }
    state.active = cup;
    state.phase = 'cue';
    state.cueStart = performance.now();
    state.cueDur = state.diff.cue;
    state.totalCues++;
    cup.el.classList.add('is-active');
    showRing(cup);
    Sound.beat(false);
    els.tip.textContent = 'Toque no copo aceso antes do anel fechar.';
  }

  function tapCup(cup) {
    if (!state || !state.running || state.paused) return;
    if (state.phase === 'swipe') return;
    if (state.phase !== 'cue') return;

    if (state.active !== cup) {
      wrongTap(cup);
      return;
    }

    if (performance.now() <= state.cueStart + state.cueDur + 60) {
      collect(cup, true);
    } else {
      missActive();
    }
  }

  function collect(cup, hit) {
    if (!state.running || cup.cleared) return;
    if (state.active) state.active.el.classList.remove('is-active');
    state.active = null;
    hideRing();
    cup.cleared = true;

    const now = performance.now();

    if (hit) {
      state.correct++;
      state.combo++;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      const points = 100 + Math.min(state.combo, 10) * 20;
      state.score += points;
      floaterOn(cup, '+' + points, false);
      cup.el.classList.add('is-collected');
      Sound.success(state.combo);
      haptic(10);
    } else {
      state.combo = 0;
      state.penaltyMs += state.diff.penalty;
      floaterOn(cup, '+' + (state.diff.penalty / 1000).toFixed(1).replace('.', ',') + 's', true);
      cup.el.classList.add('is-missed');
      Sound.error();
      haptic([20, 40, 20]);
    }

    updateHud();

    const hadMore = state.queue.length > 0;
    state.phase = 'transition';
    state.transitionAt = now + (hadMore ? state.diff.gap : 180);
    state.nextAction = hadMore ? 'cue' : 'swipe';

    setTimeout(() => cup.el.classList.add('is-gone'), 460);
  }

  function missActive() {
    if (!state.active) return;
    collect(state.active, false);
  }

  function wrongTap(cup) {
    const now = performance.now();
    if (now - state.lastPenalty < 420) return;
    state.lastPenalty = now;
    state.penaltyMs += 500;
    state.combo = 0;
    state.score = Math.max(0, state.score - 20);
    floaterOn(cup || state.active, '+0,5s', true);
    els.stage.classList.remove('is-shaking');
    void els.stage.offsetWidth;
    els.stage.classList.add('is-shaking');
    Sound.error();
    haptic(35);
    updateHud();
  }

  function startSwipe() {
    state.phase = 'swipe';
    state.active = null;
    hideRing();
    els.swipeLayer.hidden = false;
    els.tip.textContent = 'Agora arraste para baixo para colher a pilha!';
    Sound.hint();
  }

  function nudgeSwipe() {
    els.swipeLayer.classList.remove('is-nudge');
    void els.swipeLayer.offsetWidth;
    els.swipeLayer.classList.add('is-nudge');
    Sound.error();
    haptic(25);
  }

  function doSwipe() {
    if (state.phase !== 'swipe') return;
    hideSwipe();
    els.swipeLayer.classList.remove('is-nudge');
    const bonus = state.diff.swipeBonus;
    state.score += bonus;
    floaterCenter('+' + bonus + ' colheita!', false);
    Sound.swipe();
    haptic(15);
    updateHud();
    state.phase = 'transition';
    state.transitionAt = performance.now() + 220;
    state.nextAction = 'row';
  }

  function onPointerDown(event) {
    if (!state || !state.running || state.paused) return;
    if (state.phase !== 'swipe') return;
    if (state.pointer) return;
    state.pointer = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }

  function onPointerUp(event) {
    if (!state || !state.pointer) return;
    if (event.pointerId !== undefined && state.pointer.id !== event.pointerId) return;
    const start = state.pointer;
    state.pointer = null;
    if (!state.running || state.paused || state.phase !== 'swipe') return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const isDown = Math.abs(dy) > 46 && dy > 0 && Math.abs(dy) >= Math.abs(dx) * 0.75;

    if (isDown) {
      doSwipe();
    } else if (Math.abs(dx) > 28 || Math.abs(dy) > 28) {
      nudgeSwipe();
    }
  }

  function onPointerCancel() {
    if (state) state.pointer = null;
  }

  function loop(now) {
    if (!state || !state.running || state.paused) return;

    const elapsed = Math.max(0, now - state.startTime + state.penaltyMs);
    els.time.textContent = fmtTime(elapsed);

    if (state.phase === 'cue') {
      const remaining = state.cueStart + state.cueDur - now;
      const progress = Math.max(0, Math.min(1, remaining / state.cueDur));
      els.fill.style.transform = 'scaleX(' + progress + ')';
      if (remaining <= 0) missActive();
    } else {
      els.fill.style.transform = 'scaleX(0)';
    }

    if (state.phase === 'transition' && state.transitionAt && now >= state.transitionAt) {
      const action = state.nextAction;
      state.transitionAt = 0;
      state.nextAction = null;
      if (action === 'cue') nextCue();
      else if (action === 'swipe') startSwipe();
      else if (action === 'row') startNextRow();
      else if (action === 'finish') finish();
    }

    state.raf = requestAnimationFrame(loop);
  }

  async function countdown(token) {
    return new Promise((resolve) => {
      const sequence = ['3', '2', '1', 'VAI!'];
      let index = 0;
      els.count.hidden = false;

      const step = () => {
        if (!state || token !== state.token) {
          els.count.hidden = true;
          resolve(false);
          return;
        }
        if (index >= sequence.length) {
          els.count.hidden = true;
          resolve(true);
          return;
        }
        els.count.textContent = sequence[index];
        els.count.classList.remove('pop');
        void els.count.offsetWidth;
        els.count.classList.add('pop');
        Sound.count(index === sequence.length - 1);
        index++;
        state.countTimeout = setTimeout(step, index === sequence.length ? 460 : 640);
      };

      step();
    });
  }

  async function start(options) {
    if (!els) init();
    const opts = options || {};
    stop();
    onFinish = opts.onFinish || onFinish;
    onQuit = opts.onQuit || onQuit;

    resetState(opts.difficulty || 'bloco');
    hideSwipe();
    hideRing();
    showPause(false);
    els.cups.innerHTML = '';
    els.floaters.innerHTML = '';
    els.count.hidden = true;
    els.fill.style.transform = 'scaleX(0)';
    els.time.textContent = '0,0s';
    els.score.textContent = '0';
    els.combo.textContent = 'x0';
    els.tip.textContent = TIPS[state.difficulty];

    renderCups();
    state.cueDur = state.diff.cue;
    state.phase = 'countdown';
    updateHud();

    const token = state.token;
    const ready = await countdown(token);
    if (!ready || !state || token !== state.token) return;

    state.running = true;
    state.phase = 'cue';
    state.startTime = performance.now();
    state.rows = [2, 1, 0].map((row) =>
      shuffle(state.cups.filter((cup) => cup.row === row))
    );
    state.rowIndex = -1;
    startNextRow();
    state.raf = requestAnimationFrame(loop);
  }

  function stop() {
    if (!state) {
      resetState('bloco');
    }
    state.token = ++tokenCounter;
    state.running = false;
    state.paused = false;
    state.phase = 'idle';
    state.finished = false;
    state.pointer = null;
    cancelAnimationFrame(state.raf);
    clearTimeout(state.countTimeout);
    if (els) {
      hideRing();
      hideSwipe();
      showPause(false);
      els.count.hidden = true;
      els.stage.classList.remove('is-shaking');
      els.fill.style.transform = 'scaleX(0)';
      els.ring.style.animationPlayState = 'running';
    }
  }

  function finish() {
    if (!state || !state.running) return;
    state.running = false;
    state.finished = true;
    cancelAnimationFrame(state.raf);
    hideRing();
    hideSwipe();

    const elapsed = Math.max(1, performance.now() - state.startTime + state.penaltyMs);
    const seconds = elapsed / 1000;
    const accuracy = state.totalCues ? state.correct / state.totalCues : 0;
    const timeBonus = Math.max(0, Math.round(2500 - seconds * 30));
    const stars = accuracy >= 0.99 ? 3 : accuracy >= 0.6 ? 2 : 1;
    const result = {
      score: Math.round(state.score) + timeBonus,
      baseScore: Math.round(state.score),
      timeBonus,
      timeMs: elapsed,
      accuracy,
      stars,
      correct: state.correct,
      total: state.totalCues,
      maxCombo: state.maxCombo,
      difficulty: state.difficulty
    };

    state.phase = 'idle';
    els.time.textContent = fmtTime(elapsed);
    Sound.fanfare(stars);
    if (typeof onFinish === 'function') onFinish(result);
  }

  function pause() {
    if (!state || !state.running || state.paused) return;
    state.paused = true;
    state.pauseAt = performance.now();
    cancelAnimationFrame(state.raf);
    showPause(true);
    els.ring.style.animationPlayState = 'paused';
  }

  function resume() {
    if (!state || !state.running || !state.paused) return;
    const delta = performance.now() - state.pauseAt;
    state.startTime += delta;
    if (state.cueStart) state.cueStart += delta;
    if (state.transitionAt) state.transitionAt += delta;
    state.paused = false;
    showPause(false);
    els.ring.style.animationPlayState = 'running';
    state.raf = requestAnimationFrame(loop);
  }

  function quit() {
    stop();
    if (typeof onQuit === 'function') onQuit();
  }

  function init(options) {
    const opts = options || {};
    onFinish = opts.onFinish || null;
    onQuit = opts.onQuit || null;
    if (!els) cache();
    resetState('bloco');

    document.getElementById('btn-pause').addEventListener('click', pause);
    document.getElementById('btn-resume').addEventListener('click', resume);
    document.getElementById('btn-quit').addEventListener('click', () => {
      if (state && state.running && !state.paused) {
        pause();
        return;
      }
      quit();
    });
    document.getElementById('btn-exit').addEventListener('click', quit);

    els.stage.addEventListener('pointerdown', onPointerDown);
    els.stage.addEventListener('pointerup', onPointerUp);
    els.stage.addEventListener('pointercancel', onPointerCancel);
    els.stage.addEventListener('contextmenu', (event) => event.preventDefault());

    document.addEventListener('keydown', (event) => {
      if (!state || !state.running || state.paused) return;
      if (state.phase !== 'swipe') return;
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        doSwipe();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && state && state.running) pause();
    });
  }

  return {
    init,
    start,
    stop,
    pause,
    resume,
    quit,
    isRunning: () => Boolean(state && state.running)
  };
})();
