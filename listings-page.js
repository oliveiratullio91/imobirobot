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

  let activeMode = 'all';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
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
            <div class="detail-panel__radar-reasons">${reasonMarkup}</div>
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
          <div class="detail-panel__meta">${featureMarkup}</div>
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
            <span>Operação local</span>
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

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeDetail();
    }
  });

  wireCardImages();
  applyFilters();
})();
