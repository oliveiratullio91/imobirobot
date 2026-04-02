(function () {
  const chips = Array.from(document.querySelectorAll('[data-filter]'));
  const rows = Array.from(document.querySelectorAll('.listing-card'));
  const heroCards = Array.from(document.querySelectorAll('.hero-listing-card'));
  const detailTriggers = Array.from(document.querySelectorAll('[data-listing-id]'));
  const board = document.querySelector('.listing-board');
  const heroSearch = document.getElementById('hero-search');
  const boardSearch = document.getElementById('board-search');
  const sortSelect = document.getElementById('board-sort');
  const boardCount = document.getElementById('board-count');
  const workspaceEmpty = document.getElementById('workspace-empty');
  const expandButtons = Array.from(document.querySelectorAll('[data-expand-target]'));
  const mobileSectionButtons = Array.from(document.querySelectorAll('[data-section-target]'));
  const mapFilterButtons = Array.from(document.querySelectorAll('[data-map-filter]'));
  const mapFocusContainer = document.getElementById('map-focus-chips');
  const mapSummaryTitle = document.getElementById('map-summary-title');
  const mapSummaryHelper = document.getElementById('map-summary-helper');
  const mapSummaryCount = document.getElementById('map-summary-count');
  const mapShortlist = document.getElementById('map-shortlist');
  const sidebarLinks = Array.from(document.querySelectorAll('.site-nav a[href^="#"]'));
  const siteNav = document.getElementById('site-nav');
  const headerElement = document.querySelector('.market-header');
  const headerMenuToggle = document.getElementById('header-menu-toggle');
  const detailDataElement = document.getElementById('listing-details-data');
  const heroMapDataElement = document.getElementById('hero-map-listings-data');
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
  const heroMapListings = (() => {
    try {
      const parsed = JSON.parse(heroMapDataElement?.textContent || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  const WORKFLOW_API_BASE = 'http://127.0.0.1:3210';
  const WORKFLOW_STATUS_LABELS = {
    novo: 'Novo',
    analisando: 'Analisando',
    abordado: 'Abordado',
    visitado: 'Visitado',
    negociando: 'Negociando',
    descartado: 'Descartado',
  };
  const workflowStateCache = {};

  let activeFilter = 'all';
  let activeMapFilter = 'all';
  let activeMapFocus = 'all';
  let mapState = null;
  let heroMapState = null;
  const compactViewport = window.matchMedia('(max-width: 760px)');
  const expandedSections = new Map();
  const mobileSectionState = new Map();

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function wireCardImages() {
    document.querySelectorAll('.listing-card__media-image, .hero-listing-card__media-image').forEach((image) => {
      image.addEventListener('error', () => {
        image.closest('.listing-card__media, .hero-listing-card__media')?.classList.remove('has-photo');
        image.remove();
      }, { once: true });
    });
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
  }

  function syncSearchInputs(source, target) {
    if (!source || !target || target.value === source.value) return;
    target.value = source.value;
  }

  function renderWorkflowPanel(listingId, workflow, options = {}) {
    const state = workflow || {
      listingId,
      isFavorite: false,
      isShortlisted: false,
      pipelineStatus: 'novo',
      notes: '',
      updatedAt: null,
    };
    const disabledAttr = options.disabled ? ' disabled' : '';
    const messageMarkup = options.message
      ? `<p class="workflow-panel__message${options.error ? ' is-error' : ''}">${escapeHtml(options.message)}</p>`
      : '';

    return `
      <div class="workflow-panel__toggles">
        <button class="workflow-toggle${state.isFavorite ? ' is-active' : ''}" type="button" data-workflow-toggle="favorite"${disabledAttr}>
          ${state.isFavorite ? 'Favorito' : 'Favoritar'}
        </button>
        <button class="workflow-toggle${state.isShortlisted ? ' is-active' : ''}" type="button" data-workflow-toggle="shortlist"${disabledAttr}>
          ${state.isShortlisted ? 'Shortlist ativa' : 'Adicionar a shortlist'}
        </button>
      </div>
      <label class="workflow-panel__field">
        <span>Status comercial</span>
        <select data-workflow-field="pipelineStatus"${disabledAttr}>
          ${Object.entries(WORKFLOW_STATUS_LABELS).map(([value, label]) => `
            <option value="${escapeAttribute(value)}"${state.pipelineStatus === value ? ' selected' : ''}>${escapeHtml(label)}</option>
          `).join('')}
        </select>
      </label>
      <label class="workflow-panel__field">
        <span>Observações</span>
        <textarea rows="4" maxlength="4000" placeholder="Ex.: ligar amanhã, condomínio interessante, preço fora da curva." data-workflow-field="notes"${disabledAttr}>${escapeHtml(state.notes || '')}</textarea>
      </label>
      <div class="workflow-panel__footer">
        <span>${escapeHtml(state.updatedAt ? `Atualizado em ${new Date(state.updatedAt).toLocaleString('pt-BR')}` : 'Ainda sem atualização manual')}</span>
        <button class="workflow-save" type="button" data-workflow-save="${escapeAttribute(listingId)}"${disabledAttr}>Salvar</button>
      </div>
      ${messageMarkup}
    `;
  }

  async function fetchWorkflowState(listingId) {
    const response = await fetch(`${WORKFLOW_API_BASE}/listing-workflow-state?listingId=${encodeURIComponent(listingId)}`);
    const payload = await response.json();
    if (!response.ok || !payload?.workflow) {
      throw new Error(payload?.error || 'Falha ao carregar workflow comercial.');
    }
    workflowStateCache[listingId] = payload.workflow;
    return payload.workflow;
  }

  async function saveWorkflowState(listingId, payload) {
    const response = await fetch(`${WORKFLOW_API_BASE}/listing-workflow-state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        listingId,
        ...payload,
      }),
    });
    const result = await response.json();
    if (!response.ok || !result?.workflow) {
      throw new Error(result?.error || 'Falha ao salvar workflow comercial.');
    }
    workflowStateCache[listingId] = result.workflow;
    return result.workflow;
  }

  async function loadWorkflowPanel(listingId) {
    const panel = detailContent?.querySelector(`[data-workflow-panel="${CSS.escape(listingId)}"]`);
    if (!panel) return;

    panel.innerHTML = renderWorkflowPanel(listingId, workflowStateCache[listingId], {
      disabled: true,
      message: 'Carregando preferências comerciais...',
    });

    try {
      const workflow = await fetchWorkflowState(listingId);
      const refreshedPanel = detailContent?.querySelector(`[data-workflow-panel="${CSS.escape(listingId)}"]`);
      if (refreshedPanel) {
        refreshedPanel.innerHTML = renderWorkflowPanel(listingId, workflow);
      }
    } catch (error) {
      const refreshedPanel = detailContent?.querySelector(`[data-workflow-panel="${CSS.escape(listingId)}"]`);
      if (refreshedPanel) {
        refreshedPanel.innerHTML = renderWorkflowPanel(listingId, workflowStateCache[listingId], {
          message: error.message || 'Nao foi possivel carregar o workflow comercial.',
          error: true,
        });
      }
    }
  }

  function matchesSearchQuery(searchText, query) {
    return !query || String(searchText || '').includes(query);
  }

  function setHeaderMenu(open) {
    if (!headerElement || !siteNav || !headerMenuToggle) return;
    headerElement.classList.toggle('is-nav-open', open);
    siteNav.setAttribute('aria-hidden', open ? 'false' : 'true');
    headerMenuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function invalidateMaps() {
    if (heroMapState?.map) {
      heroMapState.map.invalidateSize();
    }

    if (mapState?.map) {
      mapState.map.invalidateSize();
    }
  }

  function setActiveSidebarLink(targetId) {
    sidebarLinks.forEach((link) => {
      const isActive = link.getAttribute('href') === `#${targetId}`;
      link.classList.toggle('is-active', isActive);
    });
  }

  function syncSidebarByScroll() {
    const targets = sidebarLinks
      .map((link) => document.querySelector(link.getAttribute('href')))
      .filter(Boolean);

    if (!targets.length) return;

    const activeSection = targets.reduce((best, section) => {
      const rect = section.getBoundingClientRect();
      const distance = Math.abs(rect.top - 140);
      if (!best || distance < best.distance) {
        return { id: section.id, distance };
      }
      return best;
    }, null);

    if (activeSection?.id) {
      setActiveSidebarLink(activeSection.id);
    }
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
        <button class="listing-map__marker ${escapeHtml(modeClass)}" type="button" aria-label="${escapeHtml(item.title || 'Imóvel')}">
          <span>${escapeHtml(item.modeLabel || item.mode || 'Radar')}</span>
          <strong>${escapeHtml(String(score))}</strong>
        </button>
      `,
      iconSize: [54, 54],
      iconAnchor: [27, 27],
    });
  }

  function createHeroMarkerIcon(item) {
    const modeClass = item.mode === 'venda' ? 'marker-badge--sale' : 'marker-badge--rent';
    return L.divIcon({
      className: 'hero-listing-map__marker-shell',
      html: `
        <button class="hero-listing-map__marker ${escapeHtml(modeClass)}" type="button" aria-label="${escapeHtml(item.title || 'Imóvel')}">
          <span>${escapeHtml(item.modeLabel || item.mode || 'Radar')}</span>
          <strong>${escapeHtml(item.priceText || '')}</strong>
        </button>
      `,
      iconSize: [104, 52],
      iconAnchor: [52, 26],
    });
  }

  function buildPopupHtml(item) {
    const precisionLabel = item.coordPrecision === 'exact'
      ? 'local exato'
      : item.coordPrecision === 'geocoded_address'
        ? 'endereço geocodificado'
        : item.coordPrecision === 'geocoded_query'
          ? 'busca geocodificada'
          : item.coordPrecision === 'neighborhood'
            ? 'bairro aproximado'
            : 'centro aproximado';

    return `
      <div class="listing-map__popup">
        <span>${escapeHtml(item.sourceLabel || 'Origem')} • ${escapeHtml(item.modeLabel || item.mode || 'Radar')}</span>
        <strong>${escapeHtml(item.title || 'Imóvel')}</strong>
        <p>${escapeHtml(item.coordLabel || item.neighborhood || item.location || 'Local não informado')}</p>
        <small>${escapeHtml(item.priceText || 'Sem preço')} • pontuação ${escapeHtml(String(item.radarScore || 0))} • ${escapeHtml(precisionLabel)}</small>
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
      attribution: '&copy; colaboradores do OpenStreetMap',
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

  function initializeHeroMap() {
    const container = document.getElementById('hero-listing-map');
    if (!container || typeof L === 'undefined' || !heroMapListings.length) return null;

    const map = L.map(container, {
      zoomControl: false,
      scrollWheelZoom: true,
      dragging: !compactViewport.matches,
      attributionControl: false,
    }).setView([-8.055, -34.895], compactViewport.matches ? 11 : 12);

    L.control.zoom({
      position: compactViewport.matches ? 'bottomright' : 'topright',
    }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; colaboradores do OpenStreetMap',
    }).addTo(map);

    const markers = heroMapListings
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
      .map((item) => {
        const marker = L.marker([item.lat, item.lng], {
          icon: createHeroMarkerIcon(item),
          keyboard: false,
        });

        marker.on('click', () => {
          openDetail(item.listing_id);
        });

        return { item, marker };
      });

    const layerGroup = L.layerGroup(markers.map(({ marker }) => marker)).addTo(map);

    if (markers.length) {
      const bounds = L.latLngBounds(markers.map(({ item }) => [item.lat, item.lng]));
      map.fitBounds(bounds, {
        padding: compactViewport.matches ? [18, 18] : [34, 34],
        maxZoom: compactViewport.matches ? 12 : 13,
      });
    }

    return { map, layerGroup, markers };
  }

  function refreshHeroShowcase() {
    const query = (heroSearch?.value || boardSearch?.value || '').trim().toLowerCase();

    heroCards.forEach((card) => {
      const modeMatch = activeFilter === 'all' || card.dataset.mode === activeFilter;
      const queryMatch = matchesSearchQuery(card.dataset.search, query);
      card.setAttribute('data-hidden', modeMatch && queryMatch ? 'false' : 'true');
    });

    if (!heroMapState) return;

    heroMapState.layerGroup.clearLayers();

    const visibleMarkers = heroMapState.markers.filter(({ item }) => {
      const modeMatch = activeFilter === 'all' || item.mode === activeFilter;
      const queryText = [
        item.title,
        item.neighborhood,
        item.location,
        item.source,
        item.sourceLabel,
        item.priceText,
      ].filter(Boolean).join(' ').toLowerCase();
      return modeMatch && matchesSearchQuery(queryText, query);
    });

    visibleMarkers.forEach(({ marker }) => marker.addTo(heroMapState.layerGroup));

    if (!visibleMarkers.length) return;

    const bounds = L.latLngBounds(visibleMarkers.map(({ item }) => [item.lat, item.lng]));
    heroMapState.map.fitBounds(bounds, {
      padding: compactViewport.matches ? [18, 18] : [34, 34],
      maxZoom: compactViewport.matches ? 12 : 13,
    });
  }

  function refreshMap() {
    if (!mapState) return;

    mapState.layerGroup.clearLayers();

    let visibleMarkers = mapState.markers.filter(({ item }) => (
      activeFilter === 'all' || item.mode === activeFilter
    ));

    if (activeMapFilter === 'venda' || activeMapFilter === 'aluguel') {
      visibleMarkers = visibleMarkers.filter(({ item }) => item.mode === activeMapFilter);
    } else if (activeMapFilter === 'top-score') {
      visibleMarkers = [...visibleMarkers]
        .sort((left, right) => Number(right.item.radarScore || 0) - Number(left.item.radarScore || 0))
        .slice(0, 8);
    } else if (activeMapFilter === 'best-discount') {
      visibleMarkers = [...visibleMarkers]
        .sort((left, right) => Number(right.item.discountPct || 0) - Number(left.item.discountPct || 0))
        .slice(0, 8);
    }

    if (activeMapFocus !== 'all') {
      visibleMarkers = visibleMarkers.filter(({ item }) => (
        String(item.neighborhood || item.location || '').toLowerCase() === activeMapFocus
      ));
    }

    visibleMarkers.forEach(({ marker }) => marker.addTo(mapState.layerGroup));

    updateMapOperationalPanel(visibleMarkers.map(({ item }) => item));

    if (!visibleMarkers.length) return;

    const bounds = L.latLngBounds(visibleMarkers.map(({ item }) => [item.lat, item.lng]));
    mapState.map.fitBounds(bounds, {
      padding: [26, 26],
      maxZoom: 14,
    });
  }

  function buildMapFocusOptions() {
    const grouped = new Map();
    mapListings.forEach((item) => {
      const key = String(item.neighborhood || item.location || '').trim();
      if (!key) return;
      grouped.set(key, (grouped.get(key) || 0) + 1);
    });

    return [...grouped.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'pt-BR'))
      .slice(0, 6);
  }

  function renderMapFocusButtons() {
    if (!mapFocusContainer) return;

    const options = buildMapFocusOptions();
    mapFocusContainer.innerHTML = [
      `<button class="map-focus-chip${activeMapFocus === 'all' ? ' is-active' : ''}" type="button" data-map-focus="all">Recife inteiro</button>`,
      ...options.map(([label, total]) => (
        `<button class="map-focus-chip${activeMapFocus === String(label).toLowerCase() ? ' is-active' : ''}" type="button" data-map-focus="${escapeAttribute(String(label).toLowerCase())}">${escapeHtml(label)} <span>${escapeHtml(String(total))}</span></button>`
      )),
    ].join('');
  }

  function updateMapOperationalPanel(items) {
    if (mapSummaryCount) {
      mapSummaryCount.textContent = `${new Intl.NumberFormat('pt-BR').format(items.length)} imóveis`;
    }

    if (mapSummaryTitle) {
      if (!items.length) {
        mapSummaryTitle.textContent = 'Nenhum imóvel visível neste recorte.';
      } else if (activeMapFocus !== 'all') {
        mapSummaryTitle.textContent = `Mapa focado em ${activeMapFocus}.`;
      } else if (activeMapFilter === 'top-score') {
        mapSummaryTitle.textContent = 'Recorte com os imóveis mais fortes do radar.';
      } else if (activeMapFilter === 'best-discount') {
        mapSummaryTitle.textContent = 'Recorte com os maiores descontos do radar.';
      } else {
        mapSummaryTitle.textContent = 'Imóveis visíveis no mapa operacional do radar.';
      }
    }

    if (mapSummaryHelper) {
      const topItem = items[0];
      mapSummaryHelper.textContent = topItem
        ? `${topItem.modeLabel || topItem.mode} • ${topItem.priceText || ''} • ${topItem.neighborhood || topItem.location || 'Recife'}`
        : 'Ajuste filtros e foco por bairro para refinar a leitura.';
    }

    if (!mapShortlist) return;

    mapShortlist.innerHTML = items.slice(0, 4).map((item) => `
      <button class="map-shortlist__item" type="button" data-map-open="${escapeAttribute(item.listing_id)}">
        <span>${escapeHtml(item.modeLabel || item.mode || 'Radar')}</span>
        <strong>${escapeHtml(item.title || 'Imóvel')}</strong>
        <small>${escapeHtml(`${item.priceText || 'Sem preço'} • ${item.neighborhood || item.location || 'Recife'}`)}</small>
      </button>
    `).join('');
  }

  function syncMapFilterButtons() {
    mapFilterButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.mapFilter === activeMapFilter);
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

  function updateMobileSection(button) {
    const targetId = button?.dataset.sectionTarget;
    const section = targetId ? document.getElementById(targetId) : null;
    if (!button || !section) return;

    const compact = compactViewport.matches;
    const expanded = mobileSectionState.get(targetId) === true;

    if (!compact) {
      section.dataset.mobileSectionHidden = 'false';
      button.hidden = true;
      return;
    }

    section.dataset.mobileSectionHidden = expanded ? 'false' : 'true';
    button.hidden = false;
    button.textContent = expanded
      ? (button.dataset.sectionClose || 'Fechar secao')
      : (button.dataset.sectionOpen || 'Abrir secao');
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');

    if (expanded && targetId === 'map-panel' && mapState?.map) {
      window.setTimeout(() => {
        mapState.map.invalidateSize();
        refreshMap();
      }, 80);
    }
  }

  function updateMobileSections() {
    mobileSectionButtons.forEach(updateMobileSection);
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

    if (workspaceEmpty) {
      workspaceEmpty.hidden = visible !== 0;
    }

    sortRows(sortSelect?.value || 'recent');
    updateExpandableSections();
    refreshMap();
    refreshHeroShowcase();
  }

  function buildDetailMarkup(detail, listingId) {
    const featureMarkup = (detail.features || [])
      .map((feature) => `<span>${escapeHtml(feature)}</span>`)
      .join('');
    const sourceVariantMarkup = (detail.sourceVariants || [])
      .map((variant) => `
        <article class="detail-source-card">
          <div class="detail-source-card__body">
            <div class="detail-source-card__head">
              <strong>${escapeHtml(variant.sourceLabel || 'Origem')}</strong>
              <span>${escapeHtml(variant.isActive ? 'Ativo' : 'Histórico')}</span>
            </div>
            <p>${escapeHtml(variant.currentPriceText || 'Preço indisponível')}</p>
            <small>${escapeHtml(variant.lastSeenLabel || 'Sem registro')}</small>
          </div>
          <a class="detail-source-card__action" href="${escapeHtml(variant.url || '#')}" target="_blank" rel="noreferrer">Abrir</a>
        </article>
      `)
      .join('');
    const relatedMarkup = (detail.relatedListings || [])
      .map((item) => `
        <article class="detail-related-card">
          <div class="detail-related-card__thumb"${item.imageUrl ? ` style="background-image:url('${escapeAttribute(item.imageUrl)}')"` : ''}></div>
          <div class="detail-related-card__body">
            <div class="detail-source-card__head">
              <strong>${escapeHtml(item.title || 'Imóvel relacionado')}</strong>
              <span>${escapeHtml(item.confidenceLabel || 'Correlação automática')}</span>
            </div>
            <p>${escapeHtml(item.currentPriceText || 'Preço indisponível')}</p>
            <small>${escapeHtml(`${item.locationLabel || 'Local não informado'} • ${item.sourceSummaryLabel || 'Origem'}`)}</small>
            ${item.reasonSummary ? `<small>${escapeHtml(item.reasonSummary)}</small>` : ''}
          </div>
          <a class="detail-source-card__action" href="${escapeHtml(item.url || '#')}" target="_blank" rel="noreferrer">Abrir</a>
        </article>
      `)
      .join('');

    const timelineMarkup = (detail.timeline || [])
      .map((item) => `
        <article class="detail-timeline__item">
          <div>
        <strong>${escapeHtml(item.priceText || 'N/D')}</strong>
            <p>${escapeHtml(item.capturedAtLabel || 'Sem data')}</p>
          </div>
          <span class="detail-timeline__delta is-${escapeHtml(item.direction || 'flat')}">${escapeHtml(item.changeText || 'Sem variação')}</span>
        </article>
      `)
      .join('');

    return `
      <div class="detail-modal__hero detail-modal__hero--${escapeHtml(detail.mode || 'geral')}">
        <div class="detail-modal__eyebrow">
          <span>${escapeHtml(detail.sourceSummaryLabel || detail.sourceLabel || 'Origem')}</span>
          <span>${escapeHtml(detail.modeLabel || 'Modo')}</span>
        </div>
        <h2 id="detail-title">${escapeHtml(detail.title || 'Imóvel')}</h2>
        <p>${escapeHtml(detail.neighborhood || detail.city || 'Local não informado')}</p>
        <div class="detail-modal__hero-metrics">
          <article>
            <span>Preço atual</span>
            <strong>${escapeHtml(detail.currentPriceText || 'N/D')}</strong>
          </article>
          <article>
            <span>Melhor preço</span>
            <strong>${escapeHtml(detail.bestPriceText || 'N/D')}</strong>
            <small>${escapeHtml(detail.bestPriceAtLabel || 'Sem data')}</small>
          </article>
          <article>
            <span>Maior preço</span>
            <strong>${escapeHtml(detail.highestPriceText || 'N/D')}</strong>
            <small>${escapeHtml(`economia contra pico ${detail.savingsVsPeakText || 'N/D'}`)}</small>
          </article>
          <article>
            <span>Portais ativos</span>
            <strong>${escapeHtml(detail.sourceSummaryLabel || '1 portal')}</strong>
            <small>${escapeHtml(detail.sourceSummaryText || detail.sourceLabel || 'Origem principal')}</small>
          </article>
        </div>
      </div>

      <div class="detail-modal__grid">
        <section class="detail-panel">
          <div class="detail-panel__head">
            <strong>Resumo do imóvel</strong>
            <a class="detail-panel__action" href="${escapeHtml(detail.url || '#')}" target="_blank" rel="noreferrer">Abrir anúncio</a>
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
                <span>Preço / m2</span>
                <strong>${escapeHtml(detail.radarPricePerM2Text || 'N/D')}</strong>
              </article>
              <article>
                <span>Média local</span>
                <strong>${escapeHtml(detail.radarBenchmarkText || 'N/D')}</strong>
              </article>
              <article>
                <span>Amostra</span>
                <strong>${escapeHtml(`${detail.radarSampleSizeLabel || '0'} comps`)}</strong>
              </article>
            </div>
            <div class="detail-panel__radar-reasons">
              ${(detail.radarReasons || []).map((reason) => `<span>${escapeHtml(reason)}</span>`).join('')}
            </div>
          </div>
          <div class="detail-panel__stats">
            <article>
              <span>Variação vs melhor preço</span>
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
              <span>Última variação</span>
              <strong class="is-${escapeHtml(detail.latestChangeDirection || 'flat')}">${escapeHtml(detail.latestChangeText || 'Sem variação')}</strong>
            </article>
            <article>
              <span>Mapa</span>
              <strong>${escapeHtml(detail.locationLabel || detail.neighborhood || 'Recife')}</strong>
            </article>
            <article>
              <span>Precisao</span>
              <strong>${escapeHtml(detail.locationPrecision || 'aproximado')}</strong>
            </article>
            <article>
              <span>Melhor ao vivo</span>
              <strong>${escapeHtml(detail.bestLiveVariantPriceText || 'N/D')}</strong>
            </article>
            <article>
              <span>Portal mais barato</span>
              <strong>${escapeHtml(detail.bestLiveVariantSourceLabel || 'Sem origem')}</strong>
            </article>
          </div>
          <div class="detail-panel__sources">
            <div class="detail-panel__subhead">
              <strong>Fontes monitoradas</strong>
              <span>${escapeHtml(detail.sourceSummaryLabel || '1 portal')}</span>
            </div>
            <div class="detail-panel__source-list">
              ${sourceVariantMarkup || '<p class="detail-empty">Ainda não há outras fontes relacionadas para este imóvel.</p>'}
            </div>
          </div>
          <div class="detail-panel__related">
            <div class="detail-panel__subhead">
              <strong>Correlatos automáticos</strong>
              <span>${escapeHtml(detail.relatedSummaryLabel || 'Sem correlatos')}</span>
            </div>
            <div class="detail-panel__stats detail-panel__stats--related">
              <article>
                <span>Melhor preço consolidado</span>
                <strong>${escapeHtml(detail.consolidatedBestPriceText || detail.bestPriceText || 'N/D')}</strong>
              </article>
              <article>
                <span>Portais correlacionados</span>
                <strong>${escapeHtml(detail.consolidatedPortalSummaryLabel || detail.sourceSummaryLabel || '1 portal')}</strong>
              </article>
              <article>
                <span>Relacionados automáticos</span>
                <strong>${escapeHtml(detail.relatedCountLabel || '0')}</strong>
              </article>
              <article>
                <span>Sinais de reaparição</span>
                <strong>${escapeHtml(detail.reappearanceLabel || '0')}</strong>
              </article>
            </div>
            <div class="detail-panel__source-list detail-panel__source-list--related">
              ${relatedMarkup || '<p class="detail-empty">Ainda não há correlações automáticas fortes para este imóvel.</p>'}
            </div>
          </div>
          <div class="detail-panel__meta">
            ${featureMarkup}
          </div>
          <div class="detail-panel__text">
            <p><strong>Endereço:</strong> ${escapeHtml(detail.address || 'Não informado')}</p>
            <p><strong>Primeira captura:</strong> ${escapeHtml(detail.firstSeenLabel || 'Sem registro')}</p>
            <p><strong>Ultima captura:</strong> ${escapeHtml(detail.lastSeenLabel || 'Sem registro')}</p>
            ${detail.description ? `<p><strong>Descrição:</strong> ${escapeHtml(detail.description)}</p>` : ''}
          </div>
        </section>

        <section class="detail-panel">
          <div class="detail-panel__head">
            <strong>Histórico consolidado</strong>
            <span>${escapeHtml(`${detail.timeline?.length || 0} eventos visiveis`)}</span>
          </div>
          <div class="detail-timeline">
            ${timelineMarkup || '<p class="detail-empty">Ainda não há variações suficientes para montar a timeline.</p>'}
          </div>
        </section>
        <section class="detail-panel">
          <div class="detail-panel__head">
            <strong>Fluxo comercial</strong>
            <span>OperaÃ§Ã£o local</span>
          </div>
          <div class="workflow-panel" data-workflow-panel="${escapeAttribute(listingId)}">
            ${renderWorkflowPanel(listingId, workflowStateCache[listingId], {
              disabled: true,
              message: 'Carregando preferências comerciais...',
            })}
          </div>
        </section>
      </div>
    `;
  }

  function openDetail(listingId) {
    const detail = detailsByListingId[listingId];
    if (!detailModal || !detailContent || !detail) return;

    detailContent.innerHTML = buildDetailMarkup(detail, listingId);
    detailModal.hidden = false;
    document.body.classList.add('is-modal-open');
    loadWorkflowPanel(listingId);
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

  heroSearch?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  mobileSectionButtons.forEach((button) => {
    const targetId = button.dataset.sectionTarget;
    if (!targetId) return;
    if (!mobileSectionState.has(targetId)) {
      mobileSectionState.set(targetId, false);
    }

    button.addEventListener('click', () => {
      mobileSectionState.set(targetId, !(mobileSectionState.get(targetId) === true));
      updateMobileSection(button);
    });
  });

  mapFilterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      activeMapFilter = button.dataset.mapFilter || 'all';
      syncMapFilterButtons();
      refreshMap();
    });
  });

  mapFocusContainer?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-map-focus]');
    if (!button) return;
    activeMapFocus = button.getAttribute('data-map-focus') || 'all';
    renderMapFocusButtons();
    refreshMap();
  });

  mapShortlist?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-map-open]');
    if (!button) return;
    const listingId = button.getAttribute('data-map-open');
    if (!listingId) return;
    openDetail(listingId);
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

  detailContent?.addEventListener('click', async (event) => {
    const panel = event.target.closest('[data-workflow-panel]');
    if (!panel) return;

    const listingId = panel.getAttribute('data-workflow-panel');
    if (!listingId) return;

    const toggle = event.target.closest('[data-workflow-toggle]');
    if (toggle) {
      const currentState = workflowStateCache[listingId] || await fetchWorkflowState(listingId);
      if (toggle.dataset.workflowToggle === 'favorite') {
        currentState.isFavorite = !currentState.isFavorite;
      } else if (toggle.dataset.workflowToggle === 'shortlist') {
        currentState.isShortlisted = !currentState.isShortlisted;
      }
      workflowStateCache[listingId] = currentState;
      panel.innerHTML = renderWorkflowPanel(listingId, currentState);
      return;
    }

    const saveButton = event.target.closest('[data-workflow-save]');
    if (!saveButton) return;

    const statusField = panel.querySelector('[data-workflow-field="pipelineStatus"]');
    const notesField = panel.querySelector('[data-workflow-field="notes"]');
    const currentState = workflowStateCache[listingId] || await fetchWorkflowState(listingId);

    panel.innerHTML = renderWorkflowPanel(listingId, currentState, {
      disabled: true,
      message: 'Salvando atualizacao...',
    });

    try {
      const savedState = await saveWorkflowState(listingId, {
        isFavorite: currentState.isFavorite,
        isShortlisted: currentState.isShortlisted,
        pipelineStatus: statusField?.value || currentState.pipelineStatus,
        notes: notesField?.value || '',
      });
      panel.innerHTML = renderWorkflowPanel(listingId, savedState, {
        message: 'Workflow comercial salvo com sucesso.',
      });
    } catch (error) {
      panel.innerHTML = renderWorkflowPanel(listingId, workflowStateCache[listingId], {
        message: error.message || 'Nao foi possivel salvar o workflow comercial.',
        error: true,
      });
    }
  });

  sidebarLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const targetId = (link.getAttribute('href') || '').replace(/^#/, '');
      setHeaderMenu(false);
      if (targetId) {
        window.setTimeout(() => setActiveSidebarLink(targetId), 20);
      }
    });
  });

  Array.from(document.querySelectorAll('.site-nav a:not([href^="#"])')).forEach((link) => {
    link.addEventListener('click', () => {
      setHeaderMenu(false);
    });
  });

  headerMenuToggle?.addEventListener('click', () => {
    const isOpen = headerElement?.classList.contains('is-nav-open') === true;
    setHeaderMenu(!isOpen);
  });

  document.addEventListener('click', (event) => {
    if (!headerElement?.classList.contains('is-nav-open')) return;
    if (headerElement.contains(event.target)) return;
    setHeaderMenu(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setHeaderMenu(false);
      closeDetail();
    }
  });

  window.addEventListener('scroll', syncSidebarByScroll, { passive: true });
  window.addEventListener('hashchange', syncSidebarByScroll);

  if (typeof compactViewport.addEventListener === 'function') {
    compactViewport.addEventListener('change', () => {
      updateExpandableSections();
      updateMobileSections();
      if (!compactViewport.matches) {
        setHeaderMenu(false);
      }
      if (heroMapState?.map) {
        heroMapState.map.dragging[compactViewport.matches ? 'disable' : 'enable']();
        window.setTimeout(invalidateMaps, 40);
      }
    });
  } else if (typeof compactViewport.addListener === 'function') {
    compactViewport.addListener(() => {
      updateExpandableSections();
      updateMobileSections();
      if (!compactViewport.matches) {
        setHeaderMenu(false);
      }
      if (heroMapState?.map) {
        heroMapState.map.dragging[compactViewport.matches ? 'disable' : 'enable']();
        window.setTimeout(invalidateMaps, 40);
      }
    });
  }

  heroMapState = initializeHeroMap();
  mapState = initializeMap();
  wireCardImages();
  renderMapFocusButtons();
  syncMapFilterButtons();
  applyFilters();
  updateMobileSections();
  setHeaderMenu(false);
  syncSidebarByScroll();
  window.addEventListener('resize', invalidateMaps);
  window.addEventListener('load', () => {
    invalidateMaps();
    window.setTimeout(invalidateMaps, 180);
  });
})();
