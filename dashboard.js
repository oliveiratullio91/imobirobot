(function () {
  const chips = Array.from(document.querySelectorAll('[data-filter]'));
  const rows = Array.from(document.querySelectorAll('.listing-row'));
  const searchInput = document.getElementById('board-search');
  const sortSelect = document.getElementById('board-sort');
  const board = document.querySelector('.listing-board');
  let activeFilter = 'all';

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
    const query = (searchInput?.value || '').trim().toLowerCase();

    chips.forEach((chip) => {
      chip.classList.toggle('is-active', chip.dataset.filter === activeFilter);
    });

    rows.forEach((row) => {
      const modeMatch = activeFilter === 'all' || row.dataset.mode === activeFilter;
      const queryMatch = !query || (row.dataset.search || '').includes(query);
      row.setAttribute('data-hidden', modeMatch && queryMatch ? 'false' : 'true');
    });

    sortRows(sortSelect?.value || 'recent');
  }

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      activeFilter = chip.dataset.filter;
      applyFilters();
    });
  });

  searchInput?.addEventListener('input', applyFilters);
  sortSelect?.addEventListener('change', applyFilters);

  applyFilters();
})();
