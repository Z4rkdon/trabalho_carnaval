/* Galeria de papercrafts + impressão dos moldes */
window.Papercraft = (function () {
  const ITEMS = [
    {
      id: 'estandarte',
      name: 'Estandarte do Bloco',
      desc: 'Bandeirola gigante com túnel para mastro. Perfeita para enfeitar a rua.',
      stars: 1,
      pdf: 'papercrafts/estandarte.pdf',
      svg: 'papercrafts/estandarte.svg',
      preview: 'papercrafts/preview-estandarte.png'
    },
    {
      id: 'mascara',
      name: 'Máscara da Corte',
      desc: 'Máscara veneziana com abas para elástico e recortes de estrela.',
      stars: 2,
      pdf: 'papercrafts/mascara.pdf',
      svg: 'papercrafts/mascara.svg',
      preview: 'papercrafts/preview-mascara.png'
    },
    {
      id: 'trofeu',
      name: 'Copo-Troféu do Bloco',
      desc: 'Troféu 3D com alças, pedestal e estrela. Guarde os doces da folia!',
      stars: 3,
      pdf: 'papercrafts/trofeu.pdf',
      svg: 'papercrafts/trofeu.svg',
      preview: 'papercrafts/preview-trofeu.png'
    }
  ];

  function starLabel(n) {
    return '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));
  }

  function render(container, bestStars) {
    container.innerHTML = '';

    ITEMS.forEach((item) => {
      const unlocked = bestStars >= item.stars;
      const card = document.createElement('article');
      card.className = 'paper-card' + (unlocked ? '' : ' is-locked');

      const actions = unlocked
        ? '<div class="paper-actions">' +
            '<a class="btn" href="' + item.pdf + '" download>Baixar PDF</a>' +
            '<button type="button" class="btn btn-ghost" data-print="' + item.svg + '">Imprimir</button>' +
          '</div>'
        : '<p class="paper-lock">Ganhe ' + item.stars + ' estrela' + (item.stars > 1 ? 's' : '') + ' para liberar</p>';

      const thumbInner =
        '<img src="' + item.preview + '" alt="Prévia do molde ' + item.name + '" loading="lazy" width="82" height="116">' +
        (unlocked ? '' : '<span class="lock-badge" aria-hidden="true">🔒</span>');

      const thumb = unlocked
        ? '<button type="button" class="paper-thumb paper-thumb-btn" data-preview="' + item.id +
            '" aria-label="Ampliar prévia do molde ' + item.name + '">' + thumbInner + '</button>'
        : '<div class="paper-thumb">' + thumbInner + '</div>';

      card.innerHTML =
        thumb +
        '<div class="paper-body">' +
          '<div class="paper-name-row">' +
            '<h3>' + item.name + '</h3>' +
            '<span class="paper-diff" aria-label="Requer ' + item.stars + ' estrelas">' + starLabel(item.stars) + '</span>' +
          '</div>' +
          '<p>' + item.desc + '</p>' +
          actions +
        '</div>';

      container.appendChild(card);
    });
  }

  function printTemplate(src, onFail) {
    const frame = document.getElementById('print-frame');
    if (!frame) {
      if (onFail) onFail();
      return;
    }

    frame.hidden = false;
    frame.onload = () => {
      try {
        frame.contentWindow.print();
      } catch (error) {
        if (onFail) onFail();
      }
    };
    frame.onerror = () => {
      if (onFail) onFail();
    };
    frame.src = src;
  }

  return {
    items: ITEMS,
    get(id) {
      return ITEMS.find((item) => item.id === id) || null;
    },
    render,
    printTemplate
  };
})();
