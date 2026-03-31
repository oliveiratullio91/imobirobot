(function () {
  const chips = Array.from(document.querySelectorAll('[data-filter]'));
  const rows = Array.from(document.querySelectorAll('.listing-card'));
  const detailTriggers = Array.from(document.querySelectorAll('[data-listing-id]'));
  const board = document.querySelector('.listing-board');
  const heroSearch = document.getElementById('hero-search');
  const boardSearch = document.getElementById('board-search');
  const sortSelect = document.getElementById('board-sort');
  const boardCount = document.getElementById('board-count');
  const expandButtons = Array.from(document.querySelectorAll('[data-expand-target]'));
  const detailDataElement = document.getElementById('listing-details-data');
  const mapDataElement = document.getElementById('map-listings-data');
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
  const mapListings = (() => {
    try {
      const parsed = JSON.parse(mapDataElement?.textContent || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  let activeFilter = 'all';
  let mapState = null;
  const compactViewport = window.matchMedia('(max-width: 760px)');
  const expandedSections = new Map();

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

  function createMarkerIcon(item) {
    const modeClass = item.mode === 'venda' ? 'marker-badge--sale' : 'marker-badge--rent';
    const score = Number(item.radarScore || 0);
    return L.divIcon({
      className: 'listing-map__marker-shell',
      html: `
        <button class="listing-map__marker ${escapeHtml(modeClass)}" type="button" aria-label="${escapeHtml(item.title || 'Imovel')}">
          <span>${escapeHtml(item.modeLabel || item.mode || 'Radar')}</span>
          <strong>${escapeHtml(String(score))}</strong>
        </button>
      `,
      iconSize: [54, 54],
      iconAnchor: [27, 27],
    });
  }

  function buildPopupHtml(item) {
    const precisionLabel = item.coordPrecision === 'exact'
      ? 'local exato'
      : item.coordPrecision === 'geocoded_address'
        ? 'endereco geocodificado'
        : item.coordPrecision === 'geocoded_query'
          ? 'busca geocodificada'
          : item.coordPrecision === 'neighborhood'
            ? 'bairro aproximado'
            : 'centro aproximado';

    return `
      <div class="listing-map__popup">
        <span>${escapeHtml(item.sourceLabel || 'Origem')} • ${escapeHtml(item.modeLabel || item.mode || 'Radar')}</span>
        <strong>${escapeHtml(item.title || 'Imovel')}</strong>
        <p>${escapeHtml(item.coordLabel || item.neighborhood || item.location || 'Local nao informado')}</p>
        <small>${escapeHtml(item.priceText || 'Sem preco')} • score ${escapeHtml(String(item.radarScore || 0))} • ${escapeHtml(precisionLabel)}</small>
      </div>
    `;
  }

  function initializeMap() {
    const container = document.getElementById('listing-map');
    if (!container || typeof L === 'undefined' || !mapListings.length) return null;

    const map = L.map(container, {
      zoomControl: false,
      scrollWheelZoom: true,
      attributionControl: true,
    }).setView([-8.055, -34.895], 12);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const markers = mapListings.map((item) => {
      const marker = L.marker([item.lat, item.lng], {
        icon: createMarkerIcon(item),
        keyboard: false,
      });

      marker.bindPopup(buildPopupHtml(item), {
        closeButton: false,
        offset: [0, -18],
      });

      marker.on('click', () => {
        openDetail(item.listing_id);
      });

      return {
        item,
        marker,
      };
    });

    const state = {
      map,
      markers,
      layerGroup: L.layerGroup().addTo(map),
    };

    return state;
  }

  function refreshMap() {
    if (!mapState) return;

    mapState.layerGroup.clearLayers();

    const visibleMarkers = mapState.markers.filter(({ item }) => (
      activeFilter === 'all' || item.mode === activeFilter
    ));

    visibleMarkers.forEach(({ marker }) => marker.addTo(mapState.layerGroup));

    if (!visibleMarkers.length) return;

    const bounds = L.latLngBounds(visibleMarkers.map(({ item }) => [item.lat, item.lng]));
    mapState.map.fitBounds(bounds, {
      padding: [26, 26],
      maxZoom: 14,
    });
  }

  function getSectionItems(section) {
    return Array.from(section?.children || []).filter((child) => child.dataset.mobileItem === 'true');
  }

  function updateExpandableSection(button) {
    const targetId = button?.dataset.expandTarget;
    const section = targetId ? document.getElementById(targetId) : null;
    if (!button || !section) return;

    const limit = Number(section.dataset.mobileLimit || 0);
    if (!limit) {
      button.hidden = true;
      return;
    }

    const items = getSectionItems(section);
    const visibleItems = items.filter((item) => item.dataset.hidden !== 'true');
    const compact = compactViewport.matches;
    const overflow = visibleItems.length > limit;
    const expanded = expandedSections.get(targetId) === true;

    visibleItems.forEach((item, index) => {
      item.dataset.mobileHidden = compact && overflow && !expanded && index >= limit ? 'true' : 'false';
    });

    items
      .filter((item) => item.dataset.hidden === 'true')
      .forEach((item) => {
        item.dataset.mobileHidden = 'false';
      });

    button.hidden = !compact || !overflow;
    button.textContent = expanded
      ? (button.dataset.expandLess || 'Ver menos')
      : (button.dataset.expandMore || 'Ver mais');
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  function updateExpandableSections() {
    expandButtons.forEach(updateExpandableSection);
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

    if (boardCount) {
      boardCount.textContent = `${new Intl.NumberFormat('pt-BR').format(visible)} resultados`;
    }

    sortRows(sortSelect?.value || 'recent');
    updateExpandableSections();
    refreshMap();
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
            <article>
              <span>Mapa</span>
              <strong>${escapeHtml(detail.locationLabel || detail.neighborhood || 'Recife')}</strong>
            </article>
            <article>
              <span>Precisao</span>
              <strong>${escapeHtml(detail.locationPrecision || 'fallback')}</strong>
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

  expandButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = button.dataset.expandTarget;
      if (!targetId) return;
      expandedSections.set(targetId, !(expandedSections.get(targetId) === true));
      updateExpandableSection(button);
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

  if (typeof compactViewport.addEventListener === 'function') {
    compactViewport.addEventListener('change', updateExpandableSections);
  } else if (typeof compactViewport.addListener === 'function') {
    compactViewport.addListener(updateExpandableSections);
  }

  mapState = initializeMap();
  applyFilters();
})();
