/* App: telas, progresso, instalação PWA e ajustes */
(function () {
  'use strict';

  const KEY = 'hack-torre-copos-v1';
  const DEFAULTS = {
    name: 'Folião',
    bestScore: 0,
    bestStars: 0,
    bestTime: 0,
    sound: true,
    vibrate: true,
    reduceMotion: false,
    seenTutorial: false,
    difficulty: 'bloco',
    ranking: []
  };

  const SCREENS = {
    home: 'screen-home',
    game: 'screen-game',
    result: 'screen-result',
    paper: 'screen-paper',
    rank: 'screen-rank'
  };

  const DIFF_NAMES = { ensaio: 'Ensaio', bloco: 'Bloco', apoteose: 'Apoteose' };

  let state = load();
  let els = {};
  let current = 'home';
  let tutorialAction = null;
  let deferredPrompt = null;
  let previewItem = null;
  let pendingWorker = null;
  let refreshing = false;
  let toastTimer = 0;
  let confettiRaf = 0;
  let confettiToken = 0;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...DEFAULTS, ranking: [] };
      const data = JSON.parse(raw);
      return {
        ...DEFAULTS,
        ...data,
        ranking: Array.isArray(data.ranking) ? data.ranking : []
      };
    } catch (error) {
      return { ...DEFAULTS, ranking: [] };
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (error) {
      /* armazenamento indisponível — segue o jogo */
    }
  }

  function fmtTime(ms) {
    return (Math.max(0, ms) / 1000).toFixed(1).replace('.', ',') + 's';
  }

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function starsHTML(count, extraClass) {
    let html = '';
    for (let i = 0; i < 3; i++) {
      html += '<span class="star' + (i < count ? ' on' : '') + '" aria-hidden="true">★</span>';
    }
    return html;
  }

  function prefersReduced() {
    return state.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function toast(message, ms) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.hidden = true;
    }, ms || 2400);
  }

  function go(name) {
    if (!SCREENS[name]) return;
    if (current === 'game' && name !== 'game') Game.stop();

    document.querySelectorAll('.screen').forEach((screen) => {
      screen.classList.remove('is-active');
      screen.hidden = true;
    });

    const target = document.getElementById(SCREENS[name]);
    target.hidden = false;
    target.classList.add('is-active');
    current = name;

    closeAllSheets();
    window.scrollTo(0, 0);

    if (name === 'home') renderHome();
    if (name === 'paper') renderPaper();
    if (name === 'rank') renderRank();
    if (name !== 'result') clearConfetti();

    const focusTarget = target.querySelector('h1, h2');
    if (focusTarget) {
      setTimeout(() => {
        try { focusTarget.focus({ preventScroll: true }); } catch (error) { /* noop */ }
      }, 90);
    }
  }

  /* ---------------- HOME ---------------- */

  function renderHome() {
    if (document.activeElement !== els.name) els.name.value = state.name;

    els.record.innerHTML = state.bestScore
      ? state.bestScore.toLocaleString('pt-BR') + ' pts'
      : 'Ainda sem recorde';
    els.homeStars.innerHTML = starsHTML(state.bestStars);

    document.querySelectorAll('.chip[data-diff]').forEach((chip) => {
      chip.classList.toggle('is-on', chip.dataset.diff === state.difficulty);
      chip.setAttribute('aria-pressed', String(chip.dataset.diff === state.difficulty));
    });

    updateInstallButton();
  }

  function setDifficulty(diff) {
    if (!DIFF_NAMES[diff]) return;
    state.difficulty = diff;
    save();
    document.querySelectorAll('.chip[data-diff]').forEach((chip) => {
      chip.classList.toggle('is-on', chip.dataset.diff === diff);
      chip.setAttribute('aria-pressed', String(chip.dataset.diff === diff));
    });
    Sound.tick();
  }

  /* ---------------- FLUXO DO JOGO ---------------- */

  function startGame() {
    Sound.unlock();
    const typed = (els.name.value || '').trim().slice(0, 16);
    state.name = typed || 'Folião';
    els.name.value = state.name;
    save();

    go('game');
    Game.start({
      difficulty: state.difficulty,
      onFinish: handleFinish,
      onQuit: () => go('home')
    });
  }

  function handleFinish(result) {
    const previousStars = state.bestStars;

    state.bestScore = Math.max(state.bestScore, result.score);
    state.bestStars = Math.max(state.bestStars, result.stars);
    if (!state.bestTime || result.timeMs < state.bestTime) state.bestTime = result.timeMs;

    state.ranking.push({
      name: state.name,
      score: result.score,
      time: result.timeMs,
      stars: result.stars,
      difficulty: result.difficulty,
      ts: Date.now()
    });
    state.ranking.sort((a, b) => (b.score - a.score) || (a.time - b.time));
    state.ranking = state.ranking.slice(0, 10);
    save();

    const unlocked = Papercraft.items.filter(
      (item) => item.stars > previousStars && item.stars <= state.bestStars
    );

    renderResult(result, unlocked);
    go('result');
    launchConfetti(result.stars);
  }

  function renderResult(result, unlocked) {
    const titles = {
      3: ['Apoteose!', 'Colheita perfeita. O bloco inteiro aplaude!'],
      2: ['Mandou bem!', 'Quase lá — acerte o ritmo e busque as 3 estrelas.'],
      1: ['Folião estreante', 'Cada erro virou confete. Bora tentar de novo?']
    };
    const copy = titles[result.stars] || titles[1];

    els.resultStars.innerHTML = starsHTML(result.stars);
    els.resultStars.setAttribute(
      'aria-label',
      result.stars + (result.stars === 1 ? ' estrela conquistada' : ' estrelas conquistadas')
    );
    els.resultTitle.textContent = copy[0] + (result.stars === 3 ? ' 🎉' : '');
    els.resultSub.textContent =
      copy[1] + ' Combo máximo x' + result.maxCombo + ' · ' + (DIFF_NAMES[result.difficulty] || '');

    els.resultTime.textContent = fmtTime(result.timeMs);
    els.resultScore.textContent = result.score.toLocaleString('pt-BR');
    els.resultAcc.textContent = Math.round(result.accuracy * 100) + '%';

    if (unlocked.length) {
      els.unlock.hidden = false;
      const names = unlocked.map((item) => item.name);
      const list = names.length > 1
        ? names.slice(0, -1).join(', ') + ' e ' + names[names.length - 1]
        : names[0];
      els.unlockText.textContent =
        list + '. Baixe o molde em Prêmios e chame a galera para montar!';
    } else {
      els.unlock.hidden = true;
      els.unlockText.textContent = '';
    }
  }

  function openTutorial(action) {
    tutorialAction = action || null;
    openSheet('sheet-tutorial');
  }

  /* ---------------- PAPERCRAFTS ---------------- */

  function renderPaper() {
    Papercraft.render(els.paperList, state.bestStars);
    els.paperStars.textContent = '★ ' + state.bestStars + '/3';
  }

  function openPreview(id) {
    const item = Papercraft.get(id);
    if (!item) return;
    previewItem = item;
    els.previewTitle.textContent = item.name;
    els.previewDesc.textContent =
      item.desc + ' Molde A4: linha cheia = recorte, tracejada = dobra, hachurado = cola.';
    els.previewImg.src = item.preview;
    els.previewImg.alt = 'Prévia ampliada do molde ' + item.name;
    els.previewPdf.href = item.pdf;
    els.previewPdf.setAttribute('download', item.id + '.pdf');
    openSheet('sheet-preview');
  }

  /* ---------------- RANKING ---------------- */

  function renderRank() {
    els.rankList.innerHTML = '';
    if (!state.ranking.length) {
      els.rankEmpty.hidden = false;
      return;
    }
    els.rankEmpty.hidden = true;

    state.ranking.forEach((entry, index) => {
      const li = document.createElement('li');
      li.className = 'rank-item' + (index === 0 ? ' is-top' : '');
      const bought = Math.max(0, Math.min(3, entry.stars || 0));
      const stars = '<span class="rank-stars">' + '★'.repeat(bought) + '</span>' +
        '☆'.repeat(3 - bought);
      li.innerHTML =
        '<span class="rank-pos">' + (index + 1) + '</span>' +
        '<div class="rank-info">' +
          '<strong>' + escapeHTML(entry.name || 'Folião') + '</strong>' +
          '<small>' + stars + ' · ' + fmtTime(entry.time || 0) + ' · ' +
            (DIFF_NAMES[entry.difficulty] || 'Bloco') + '</small>' +
        '</div>' +
        '<div class="rank-score">' + (entry.score || 0).toLocaleString('pt-BR') +
          '<small>pts</small></div>';
      els.rankList.appendChild(li);
    });
  }

  /* ---------------- SHEETS ---------------- */

  function openSheet(id) {
    const sheet = document.getElementById(id);
    if (!sheet) return;
    sheet.hidden = false;
    document.body.classList.add('is-locked');
    const heading = sheet.querySelector('h2');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      setTimeout(() => {
        try { heading.focus({ preventScroll: true }); } catch (error) { /* noop */ }
      }, 60);
    }
  }

  function closeSheet(sheet) {
    if (!sheet) return;
    sheet.hidden = true;
    if (!document.querySelector('.sheet:not([hidden])')) {
      document.body.classList.remove('is-locked');
    }
  }

  function closeAllSheets() {
    document.querySelectorAll('.sheet').forEach((sheet) => {
      sheet.hidden = true;
    });
    document.body.classList.remove('is-locked');
  }

  /* ---------------- AJUSTES ---------------- */

  function applySettings() {
    Sound.setEnabled(state.sound);
    document.documentElement.classList.toggle('reduce-motion', Boolean(state.reduceMotion));
    window.haptic = (pattern) => {
      if (state.vibrate && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    };
  }

  function openSettings() {
    els.setSound.checked = state.sound;
    els.setVibrate.checked = state.vibrate;
    els.setMotion.checked = state.reduceMotion;
    openSheet('sheet-settings');
  }

  function resetProgress() {
    const ok = window.confirm('Apagar todo o progresso, ranking e prêmios deste aparelho?');
    if (!ok) return;
    try { localStorage.removeItem(KEY); } catch (error) { /* noop */ }
    const keepName = state.name;
    state = { ...DEFAULTS, name: keepName, ranking: [] };
    save();
    applySettings();
    renderHome();
    closeAllSheets();
    toast('Progresso apagado. O bloco recomeça!');
  }

  /* ---------------- INSTALAÇÃO / PWA ---------------- */

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }

  function updateInstallButton() {
    els.install.hidden = isStandalone();
  }

  function getInstallInstructions() {
    const ua = navigator.userAgent || '';
    const isIOS = /iphone|ipad|ipod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOS) {
      return '<p><strong>No iPhone ou iPad (Safari):</strong></p>' +
        '<ol><li>Toque no botão <strong>Compartilhar</strong> (quadrado com seta).</li>' +
        '<li>Escolha <strong>Adicionar à Tela de Início</strong>.</li>' +
        '<li>Confirme em <strong>Adicionar</strong>.</li></ol>' +
        '<p>Pronto: o app abre em tela cheia e funciona offline.</p>';
    }

    return '<p><strong>No Android (Chrome):</strong></p>' +
      '<ol><li>Abra o menu <strong>⋮</strong> no canto superior.</li>' +
      '<li>Toque em <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</li>' +
      '<li>Confirme em <strong>Instalar</strong>.</li></ol>' +
      '<p><strong>No computador:</strong> clique no ícone de instalação na barra de endereço.</p>';
  }

  async function handleInstall() {
    if (isStandalone()) {
      toast('Você já está com o app instalado. Bora jogar!');
      return;
    }

    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          toast('Instalando o app… 🎉');
        }
        deferredPrompt = null;
      } catch (error) {
        els.installInstructions.innerHTML = getInstallInstructions();
        openSheet('sheet-install');
      }
      return;
    }

    els.installInstructions.innerHTML = getInstallInstructions();
    openSheet('sheet-install');
  }

  /* ---------------- SERVICE WORKER ---------------- */

  function setupServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then((registration) => {
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              pendingWorker = worker;
              els.updateBar.hidden = false;
            }
          });
        });
      }).catch((error) => {
        console.warn('[PWA] Falha ao registrar o service worker:', error);
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) {
        refreshing = false;
        window.location.reload();
      }
    });
  }

  /* ---------------- CONFETES ---------------- */

  function clearConfetti() {
    confettiToken++;
    cancelAnimationFrame(confettiRaf);
    const canvas = els.confetti;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function launchConfetti(stars) {
    clearConfetti();
    if (prefersReduced()) return;

    const canvas = els.confetti;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const colors = ['#ff2d87', '#ffc93c', '#16e0c0', '#8b5cf6', '#fff4e6', '#ff7a3d'];
    const total = stars >= 3 ? 150 : stars === 2 ? 105 : 65;
    const pieces = Array.from({ length: total }, () => ({
      x: Math.random() * width,
      y: -20 - Math.random() * height * 0.5,
      vx: (Math.random() - 0.5) * 2.4,
      vy: 2 + Math.random() * 3.4,
      size: 4 + Math.random() * 7,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.28,
      color: colors[Math.floor(Math.random() * colors.length)],
      round: Math.random() > 0.55
    }));

    const started = performance.now();
    const token = ++confettiToken;

    function frame(now) {
      if (token !== confettiToken) return;
      const elapsed = now - started;
      ctx.clearRect(0, 0, width, height);

      for (const piece of pieces) {
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.vy += 0.045;
        piece.rot += piece.vr;
        if (piece.y > height + 24) {
          piece.y = -24;
          piece.x = Math.random() * width;
        }
        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.rot);
        ctx.globalAlpha = Math.max(0, 1 - elapsed / 4200);
        ctx.fillStyle = piece.color;
        if (piece.round) {
          ctx.beginPath();
          ctx.arc(0, 0, piece.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.62);
        }
        ctx.restore();
      }

      if (elapsed < 4200) {
        confettiRaf = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    }

    confettiRaf = requestAnimationFrame(frame);
  }

  /* ---------------- INICIALIZAÇÃO ---------------- */

  function cacheElements() {
    els = {
      name: document.getElementById('player-name'),
      record: document.getElementById('home-record'),
      homeStars: document.getElementById('home-stars'),
      install: document.getElementById('btn-install'),
      installInstructions: document.getElementById('install-instructions'),
      netDot: document.getElementById('net-dot'),
      netLabel: document.getElementById('net-label'),
      toast: document.getElementById('toast'),
      updateBar: document.getElementById('update-bar'),
      confetti: document.getElementById('confetti'),
      resultStars: document.getElementById('result-stars'),
      resultTitle: document.getElementById('result-title'),
      resultSub: document.getElementById('result-sub'),
      resultTime: document.getElementById('result-time'),
      resultScore: document.getElementById('result-score'),
      resultAcc: document.getElementById('result-acc'),
      unlock: document.getElementById('unlock'),
      unlockText: document.getElementById('unlock-text'),
      paperList: document.getElementById('paper-list'),
      paperStars: document.getElementById('paper-stars'),
      previewImg: document.getElementById('preview-img'),
      previewTitle: document.getElementById('preview-title'),
      previewDesc: document.getElementById('preview-desc'),
      previewPdf: document.getElementById('preview-pdf'),
      rankList: document.getElementById('rank-list'),
      rankEmpty: document.getElementById('rank-empty'),
      setSound: document.getElementById('set-sound'),
      setVibrate: document.getElementById('set-vibrate'),
      setMotion: document.getElementById('set-motion')
    };
  }

  function updateNetwork() {
    const online = navigator.onLine;
    els.netDot.classList.toggle('is-off', !online);
    els.netLabel.textContent = online ? 'Online' : 'Offline · tudo salvo';
  }

  function wireEvents() {
    document.querySelectorAll('[data-go]').forEach((button) => {
      button.addEventListener('click', () => {
        const target = button.dataset.go;
        if (target === 'home' && Game.isRunning()) {
          Game.stop();
        }
        go(target);
      });
    });

    document.querySelectorAll('.chip[data-diff]').forEach((chip) => {
      chip.addEventListener('click', () => setDifficulty(chip.dataset.diff));
    });

    els.name.addEventListener('input', () => {
      state.name = els.name.value.trim().slice(0, 16);
      save();
    });

    els.name.addEventListener('blur', () => {
      if (!els.name.value.trim()) {
        els.name.value = state.name || 'Folião';
      }
    });

    document.getElementById('btn-play').addEventListener('click', () => {
      if (!state.seenTutorial) {
        openTutorial('start');
      } else {
        startGame();
      }
    });

    document.getElementById('btn-how').addEventListener('click', () => openTutorial(null));

    document.getElementById('btn-tutorial-go').addEventListener('click', () => {
      state.seenTutorial = true;
      save();
      const action = tutorialAction;
      tutorialAction = null;
      closeAllSheets();
      if (action === 'start') startGame();
    });

    document.getElementById('btn-settings').addEventListener('click', openSettings);
    document.getElementById('btn-install').addEventListener('click', handleInstall);
    document.getElementById('btn-again').addEventListener('click', startGame);

    document.querySelectorAll('[data-close-sheet]').forEach((button) => {
      button.addEventListener('click', () => closeSheet(button.closest('.sheet')));
    });

    els.setSound.addEventListener('change', () => {
      state.sound = els.setSound.checked;
      save();
      Sound.setEnabled(state.sound);
      if (state.sound) Sound.pop();
    });

    els.setVibrate.addEventListener('change', () => {
      state.vibrate = els.setVibrate.checked;
      save();
      if (state.vibrate && typeof navigator.vibrate === 'function') navigator.vibrate(18);
    });

    els.setMotion.addEventListener('change', () => {
      state.reduceMotion = els.setMotion.checked;
      save();
      applySettings();
    });

    document.getElementById('btn-reset').addEventListener('click', resetProgress);

    document.addEventListener('click', (event) => {
      const previewBtn = event.target.closest('[data-preview]');
      if (previewBtn) {
        openPreview(previewBtn.dataset.preview);
        return;
      }

      const printBtn = event.target.closest('[data-print]');
      if (printBtn) {
        const src = printBtn.dataset.print;
        Papercraft.printTemplate(src, () => {
          window.open(src, '_blank', 'noopener');
        });
        toast('Abrindo molde para impressão…');
      }
    });

    document.getElementById('preview-print').addEventListener('click', () => {
      if (!previewItem) return;
      Papercraft.printTemplate(previewItem.svg, () => {
        window.open(previewItem.svg, '_blank', 'noopener');
      });
      toast('Abrindo molde para impressão…');
    });

    document.getElementById('btn-update').addEventListener('click', () => {
      if (!pendingWorker) return;
      refreshing = true;
      pendingWorker.postMessage({ type: 'SKIP_WAITING' });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const open = document.querySelector('.sheet:not([hidden])');
      if (open) closeSheet(open);
    });

    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredPrompt = event;
      updateInstallButton();
    });

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      updateInstallButton();
      toast('App instalado! Agora ele vive na sua tela inicial. 🎉');
    });

    window.addEventListener('resize', () => {
      if (current === 'result') clearConfetti();
    });
  }

  function init() {
    cacheElements();
    applySettings();
    renderHome();
    updateNetwork();
    updateInstallButton();
    wireEvents();

    Game.init({
      onFinish: handleFinish,
      onQuit: () => go('home')
    });

    setupServiceWorker();

    const params = new URLSearchParams(window.location.search);
    if (params.get('tela') === 'paper') go('paper');
    if (params.get('jogar') === '1') {
      if (state.seenTutorial) startGame();
      else openTutorial('start');
    }

    // Desbloqueia o áudio no primeiro gesto (política dos navegadores)
    const unlockAudio = () => {
      Sound.unlock();
      window.removeEventListener('pointerdown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });

    if (!navigator.onLine) updateNetwork();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
