class AutoPrSection {
  static TITLE = 'Pull requests to review (AutoPRs)';
  static LOADING_TEXT = 'Loading AutoPRs…';
  static SHOW_MORE_TEXT = 'Show more pull requests';
  static COLLAPSED_ROWS = 4;
  static SECTION_CLASS = 'autopr-pull-requests';
  static STYLE_ID = 'autopr-section-style';

  constructor(document, dashboard) {
    this.document = document;
    this.dashboard = dashboard;
    this.expanded = false;
  }

  render(originalRows, sectionRows) {
    this.remove();
    if (originalRows.length > 0) {
      this.hideOriginals(originalRows);
    }
    if (sectionRows.length > 0) {
      const content = [this.table(sectionRows)];
      if (!this.expanded && sectionRows.length > AutoPrSection.COLLAPSED_ROWS) {
        sectionRows.slice(AutoPrSection.COLLAPSED_ROWS).forEach((row) => { row.style.display = 'none'; });
        content.push(this.showMoreButton(sectionRows));
      }
      this.insertSection(`${AutoPrSection.TITLE} (${sectionRows.length})`, ...content);
    }
  }

  renderLoading(originalRows) {
    this.remove();
    if (originalRows.length > 0) {
      this.hideOriginals(originalRows);
    }
    const placeholder = this.document.createElement('p');
    placeholder.className = 'autopr-loading';
    placeholder.textContent = AutoPrSection.LOADING_TEXT;
    placeholder.style.color = 'var(--ds-text-subtlest, #626f86)';
    this.insertSection(AutoPrSection.TITLE, placeholder);
  }

  remove() {
    this.document.querySelectorAll('[data-autopr]').forEach((node) => node.remove());
    this.document.getElementById(AutoPrSection.STYLE_ID)?.remove();
  }

  hideOriginals(originalRows) {
    const rowSelectors = originalRows.map((row) =>
      `${ReviewDashboard.REVIEW_SECTION} ${ReviewDashboard.ROW}:has(${ReviewDashboard.TITLE_LINK}[href="${AutoPrSection.escape(ReviewDashboard.rowUrl(row))}"])`
    );
    const style = this.document.createElement('style');
    style.id = AutoPrSection.STYLE_ID;
    style.textContent = `${rowSelectors.join(',\n')} { display: none !important; }`;
    this.document.head.appendChild(style);
  }

  showMoreButton(sectionRows) {
    const prototype = this.document.querySelector('.dashboard-pull-request-table:not([data-autopr]) button.show-more');
    const button = prototype ? prototype.cloneNode(true) : this.document.createElement('button');
    if (!prototype) {
      button.type = 'button';
      button.className = 'show-more';
      button.textContent = AutoPrSection.SHOW_MORE_TEXT;
    }
    button.addEventListener('click', () => {
      this.expanded = true;
      sectionRows.forEach((row) => { row.style.display = ''; });
      button.remove();
    });
    return button;
  }

  insertSection(title, ...content) {
    const section = this.document.createElement('div');
    section.className = `dashboard-pull-request-table main-section ${AutoPrSection.SECTION_CLASS}`;
    section.dataset.autopr = 'section';

    const heading = this.document.createElement('h3');
    heading.textContent = title;
    section.append(heading, ...content);
    (this.dashboard.createdSection() ?? this.dashboard.reviewSection()).after(section);
  }

  table(sectionRows) {
    const table = this.document.createElement('table');
    const head = this.dashboard.reviewTableHead();
    if (head) {
      table.appendChild(head.cloneNode(true));
    }
    const body = this.document.createElement('tbody');
    body.append(...sectionRows);
    table.appendChild(body);
    return table;
  }

  static escape(value) {
    return value.replace(/["\\]/g, '\\$&');
  }
}

globalThis.AutoPrSection = AutoPrSection;
