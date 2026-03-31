(function () {
  const modeButtons = Array.from(document.querySelectorAll('[data-mode-filter]'));
  const rows = Array.from(document.querySelectorAll('.listing-card'));
  const locationInput = document.getElementById('listings-location-filter');
  const priceMinInput = document.getElementById('listings-price-min');
  const priceMaxInput = document.getElementById('listings-price-max');
  const countElement = document.getElementById('listings-page-count');
  const emptyState = document.getElementById('listings-page-empty');
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

  let activeMode = 'all';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatResultCount(total) {
    return `${new Intl.NumberFormat('pt-BR').format(total)} resultados`;
  }

  function wireCardImages() {
    document.querySelectorAll('.listing-card__media-image').forEach((image) => {
      image.addEventListener('error', () => {
        image.closest('.listing-card__media')?.classList.remove('has-photo');
        image.remove();
      }, { once: true });
    });
  }

  function buildDetailMarkup(detail) {
    const featureMarkup = (detail.features || [])
      .map((feature) => `<span>${escapeHtml(feature)}</span>`)
      .join('');

    const reasonMarkup = (detail.radarReasons || [])
      .map((reason) => `<span>${escapeHtml(reason)}</span>`)
      .join('');

    const timelineMarkup = (detail.timeline || [])
      .map((item) => `
        <article class="detail-timeline__item">
          <div>
            <strong>${escapeHtml(item.priceText || 'N/D')}</strong>
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
            <strong>${escapeHtml(detail.currentPriceText || 'N/D')}</strong>
          </article>
          <article>
            <span>Melhor preco</span>
            <strong>${escapeHtml(detail.bestPriceText || 'N/D')}</strong>
            <small>${escapeHtml(detail.bestPriceAtLabel || 'Sem data')}</small>
          </article>
          <article>
            <span>Maior preco</span>
            <strong>${escapeHtml(detail.highestPriceText || 'N/D')}</strong>
            <small>${escapeHtml(`economia contra pico ${detail.savingsVsPeakText || 'N/D'}`)}</small>
          </article>
        </div>
      </div>

      <div class="detail-modal__grid">
        <section class="detail-panel">
          <div class="detail-panel__head">
            <strong>Resumo do imovel</strong>
            <a class="detail-panel__action" href="${escapeHtml(detail.url || '#')}" target="_blank" rel="noreferrer">Abrir anuncio</a>
          </div>
          <div class="detail-panel__radar">
            <div class="detail-panel__radar-head">
              <span>Radar</span>
              <strong>${escapeHtml(detail.radarConfidence || 'Inicial')}</strong>
            </div>
            <div class="detail-panel__radar-metrics">
              <article>
                <span>Desconto</span>
                <strong>${escapeHtml(detail.radarDiscountText || 'N/D')}</strong>
              </article>
              <article>
                <span>Preco / m2</span>
                <strong>${escapeHtml(detail.radarPricePerM2Text || 'N/D')}</strong>
              </article>
              <article>
                <span>Media local</span>
                <strong>${escapeHtml(detail.radarBenchmarkText || 'N/D')}</strong>
              </article>
              <article>
                <span>Amostra</span>
                <strong>${escapeHtml(`${detail.radarSampleSizeLabel || '0'} comps`)}</strong>
              </article>
            </div>
            <div class="detail-panel__radar-reasons">${reasonMarkup}</div>
          </div>
          <div class="detail-panel__stats">
            <article>
              <span>Variacao vs melhor preco</span>
              <strong>${escapeHtml(detail.currentVsBestText || 'N/D')}</strong>
            </article>
            <article>
              <span>Snapshots</span>
              <strong>${escapeHtml(detail.snapshotsLabel || '0')}</strong>
            </article>
            <article>
              <span>Dias acompanhados</span>
              <strong>${escapeHtml(detail.trackedDaysLabel || 'N/D')}</strong>
            </article>
            <article>
              <span>Ultima variacao</span>
              <strong class="is-${escapeHtml(detail.latestChangeDirection || 'flat')}">${escapeHtml(detail.latestChangeText || 'Sem variacao')}</strong>
            </article>
            <article>
              <span>Mapa</span>
              <strong>${escapeHtml(detail.locationLabel || detail.neighborhood || 'Recife')}</strong>
            </article>
            <article>
              <span>Precisao</span>
              <strong>${escapeHtml(detail.locationPrecision || 'aproximado')}</strong>
            </article>
          </div>
          <div class="detail-panel__meta">${featureMarkup}</div>
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
    detailContent.innerHTML = '';
    document.body.classList.remove('is-modal-open');
  }

  function applyFilters() {
    const locationQuery = String(locationInput?.value || '').trim().toLowerCase();
    const minPrice = Number(priceMinInput?.value || 0);
    const maxPrice = Number(priceMaxInput?.value || 0);
    let visible = 0;

    modeButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.modeFilter === activeMode);
    });

    rows.forEach((row) => {
      const modeMatch = activeMode === 'all' || row.dataset.mode === activeMode;
      const locationMatch = !locationQuery || String(row.dataset.search || '').includes(locationQuery);
      const price = Number(row.dataset.price || 0);
      const minMatch = !minPrice || price >= minPrice;
      const maxMatch = !maxPrice || price <= maxPrice;
      const shouldShow = modeMatch && locationMatch && minMatch && maxMatch;
      row.setAttribute('data-hidden', shouldShow ? 'false' : 'true');
      if (shouldShow) visible += 1;
    });

    if (countElement) {
      countElement.textContent = formatResultCount(visible);
    }

    if (emptyState) {
      emptyState.hidden = visible !== 0;
    }
  }

  modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      activeMode = button.dataset.modeFilter || 'all';
      applyFilters();
    });
  });

  locationInput?.addEventListener('input', applyFilters);
  priceMinInput?.addEventListener('input', applyFilters);
  priceMaxInput?.addEventListener('input', applyFilters);

  rows.forEach((row) => {
    const listingId = row.dataset.listingId;
    if (!listingId) return;

    row.addEventListener('click', (event) => {
      if (event.target.closest('a, button')) return;
      openDetail(listingId);
    });

    row.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (event.target.closest('a, button')) return;
      event.preventDefault();
      openDetail(listingId);
    });
  });

  document.querySelectorAll('[data-listing-id]').forEach((trigger) => {
    const listingId = trigger.dataset.listingId;
    if (!listingId || !trigger.matches('button')) return;
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
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

  wireCardImages();
  applyFilters();
})();
