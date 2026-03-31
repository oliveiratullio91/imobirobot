(function () {
  const chips = Array.from(document.querySelectorAll('[data-filter]'));
  const rows = Array.from(document.querySelectorAll('.listing-card'));
  const mapPins = Array.from(document.querySelectorAll('.map-pin'));
  const detailTriggers = Array.from(document.querySelectorAll('[data-listing-id]'));
  const board = document.querySelector('.listing-board');
  const heroSearch = document.getElementById('hero-search');
  const boardSearch = document.getElementById('board-search');
  const sortSelect = document.getElementById('board-sort');
  const boardCount = document.getElementById('board-count');
  const detailDataElement = document.getElementById('listing-details-data');
  const detailModal = document.getElementById('listing-detail-modal');
  const detailContent = document.getElementById('listing-detail-content');
  const detailCloseTriggers = Array.from(document.querySelectorAll('[data-detail-close="true"]'));
  const detailsByListingId = (() => {
    try {
      return JSON.parse(detailDataElement?.textContent || '{}');
    } catch {
      return {};
    }
  })();
  let activeFilter = 'all';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function syncSearchInputs(source, target) {
    if (!source || !target || target.value === source.value) return;
    target.value = source.value;
  }

  function sortRows(mode) {
    if (!board) return;

    const sorted = [...rows].sort((left, right) => {
      if (mode === 'price-desc') {
        return Number(right.dataset.price || 0) - Number(left.dataset.price || 0);
      }

      if (mode === 'price-asc') {
        return Number(left.dataset.price || 0) - Number(right.dataset.price || 0);
      }

      if (mode === 'title') {
        return (left.querySelector('h3')?.textContent || '').localeCompare(
          right.querySelector('h3')?.textContent || '',
          'pt-BR',
        );
      }

      return (right.dataset.date || '').localeCompare(left.dataset.date || '');
    });

    sorted.forEach((row) => board.appendChild(row));
  }

  function applyFilters() {
    const query = (boardSearch?.value || heroSearch?.value || '').trim().toLowerCase();
    let visible = 0;

    chips.forEach((chip) => {
      chip.classList.toggle('is-active', chip.dataset.filter === activeFilter);
    });

    rows.forEach((row) => {
      const modeMatch = activeFilter === 'all' || row.dataset.mode === activeFilter;
      const queryMatch = !query || (row.dataset.search || '').includes(query);
      const shouldShow = modeMatch && queryMatch;
      row.setAttribute('data-hidden', shouldShow ? 'false' : 'true');
      if (shouldShow) visible += 1;
    });

    mapPins.forEach((pin) => {
      const modeMatch = activeFilter === 'all' || pin.dataset.targetMode === activeFilter;
      pin.setAttribute('data-hidden', modeMatch ? 'false' : 'true');
    });

    if (boardCount) {
      boardCount.textContent = `${new Intl.NumberFormat('pt-BR').format(visible)} resultados`;
    }

    sortRows(sortSelect?.value || 'recent');
  }

  function buildDetailMarkup(detail) {
    const featureMarkup = (detail.features || [])
      .map((feature) => `<span>${escapeHtml(feature)}</span>`)
      .join('');

    const timelineMarkup = (detail.timeline || [])
      .map((item) => `
        <article class="detail-timeline__item">
          <div>
            <strong>${escapeHtml(item.priceText || 'N/A')}</strong>
            <p>${escapeHtml(item.capturedAtLabel || 'Sem data')}</p>
          </div>
          <span class="detail-timeline__delta is-${escapeHtml(item.direction || 'flat')}">${escapeHtml(item.changeText || 'Sem variacao')}</span>
        </article>
      `)
      .join('');

    return `
      <div class="detail-modal__hero detail-modal__hero--${escapeHtml(detail.mode || 'geral')}">
        <div class="detail-modal__eyebrow">
          <span>${escapeHtml(detail.sourceLabel || 'Origem')}</span>
          <span>${escapeHtml(detail.modeLabel || 'Modo')}</span>
        </div>
        <h2 id="detail-title">${escapeHtml(detail.title || 'Imovel')}</h2>
        <p>${escapeHtml(detail.neighborhood || detail.city || 'Local nao informado')}</p>
        <div class="detail-modal__hero-metrics">
          <article>
            <span>Preco atual</span>
            <strong>${escapeHtml(detail.currentPriceText || 'N/A')}</strong>
          </article>
          <article>
            <span>Melhor preco</span>
            <strong>${escapeHtml(detail.bestPriceText || 'N/A')}</strong>
            <small>${escapeHtml(detail.bestPriceAtLabel || 'Sem data')}</small>
          </article>
          <article>
            <span>Maior preco</span>
            <strong>${escapeHtml(detail.highestPriceText || 'N/A')}</strong>
            <small>${escapeHtml(`economia contra pico ${detail.savingsVsPeakText || 'N/A'}`)}</small>
          </article>
        </div>
      </div>

      <div class="detail-modal__grid">
        <section class="detail-panel">
          <div class="detail-panel__head">
            <strong>Resumo do imovel</strong>
            <a href="${escapeHtml(detail.url || '#')}" target="_blank" rel="noreferrer">Abrir anuncio</a>
          </div>
          <div class="detail-panel__stats">
            <article>
              <span>Variacao vs melhor preco</span>
              <strong>${escapeHtml(detail.currentVsBestText || 'N/A')}</strong>
            </article>
            <article>
              <span>Snapshots</span>
              <strong>${escapeHtml(detail.snapshotsLabel || '0')}</strong>
            </article>
            <article>
              <span>Dias acompanhados</span>
              <strong>${escapeHtml(detail.trackedDaysLabel || 'N/A')}</strong>
            </article>
            <article>
              <span>Ultima variacao</span>
              <strong class="is-${escapeHtml(detail.latestChangeDirection || 'flat')}">${escapeHtml(detail.latestChangeText || 'Sem variacao')}</strong>
            </article>
          </div>
          <div class="detail-panel__meta">
            ${featureMarkup}
          </div>
          <div class="detail-panel__text">
            <p><strong>Endereco:</strong> ${escapeHtml(detail.address || 'Nao informado')}</p>
            <p><strong>Primeira captura:</strong> ${escapeHtml(detail.firstSeenLabel || 'Sem registro')}</p>
            <p><strong>Ultima captura:</strong> ${escapeHtml(detail.lastSeenLabel || 'Sem registro')}</p>
            ${detail.description ? `<p><strong>Descricao:</strong> ${escapeHtml(detail.description)}</p>` : ''}
          </div>
        </section>

        <section class="detail-panel">
          <div class="detail-panel__head">
            <strong>Historico de preco</strong>
            <span>${escapeHtml(`${detail.timeline?.length || 0} eventos visiveis`)}</span>
          </div>
          <div class="detail-timeline">
            ${timelineMarkup || '<p class="detail-empty">Ainda nao ha variacoes suficientes para montar a timeline.</p>'}
          </div>
        </section>
      </div>
    `;
  }

  function openDetail(listingId) {
    const detail = detailsByListingId[listingId];
    if (!detailModal || !detailContent || !detail) return;

    detailContent.innerHTML = buildDetailMarkup(detail);
    detailModal.hidden = false;
    document.body.classList.add('is-modal-open');
  }

  function closeDetail() {
    if (!detailModal || detailModal.hidden) return;
    detailModal.hidden = true;
    if (detailContent) {
      detailContent.innerHTML = '';
    }
    document.body.classList.remove('is-modal-open');
  }

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      activeFilter = chip.dataset.filter;
      applyFilters();
    });
  });

  heroSearch?.addEventListener('input', () => {
    syncSearchInputs(heroSearch, boardSearch);
    applyFilters();
  });

  boardSearch?.addEventListener('input', () => {
    syncSearchInputs(boardSearch, heroSearch);
    applyFilters();
  });

  sortSelect?.addEventListener('change', applyFilters);

  mapPins.forEach((pin) => {
    pin.addEventListener('click', () => {
      const targetMode = pin.dataset.targetMode || 'all';
      activeFilter = targetMode;
      applyFilters();
      document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  detailTriggers.forEach((trigger) => {
    const listingId = trigger.dataset.listingId;
    if (!listingId) return;

    if (trigger.matches('button')) {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openDetail(listingId);
      });
      return;
    }

    trigger.addEventListener('click', (event) => {
      if (event.target.closest('a, button')) return;
      openDetail(listingId);
    });

    trigger.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (event.target.closest('a, button')) return;
      event.preventDefault();
      openDetail(listingId);
    });
  });

  detailCloseTriggers.forEach((trigger) => {
    trigger.addEventListener('click', closeDetail);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeDetail();
    }
  });

  applyFilters();
})();
