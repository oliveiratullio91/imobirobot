(function () {
  const chips = Array.from(document.querySelectorAll('[data-filter]'));
  const rows = Array.from(document.querySelectorAll('.listing-card'));
  const mapPins = Array.from(document.querySelectorAll('.map-pin'));
  const board = document.querySelector('.listing-board');
  const heroSearch = document.getElementById('hero-search');
  const boardSearch = document.getElementById('board-search');
  const sortSelect = document.getElementById('board-sort');
  const boardCount = document.getElementById('board-count');
  let activeFilter = 'all';

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

  applyFilters();
})();
