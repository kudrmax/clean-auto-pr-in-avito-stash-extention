class AutoPrSection {
  static TITLE = 'Pull requests to review (AutoPRs)';
  static SECTION_CLASS = 'autopr-pull-requests';
  static STYLE_ID = 'autopr-section-style';

  constructor(document, dashboard) {
    this.document = document;
    this.dashboard = dashboard;
  }

  render(autoPrRows, totalRows) {
    this.remove();
    if (autoPrRows.length === 0) {
      return;
    }
    this.hideOriginals(autoPrRows);
    this.insertReviewHeading(totalRows - autoPrRows.length);
    this.insertSection(autoPrRows);
  }

  remove() {
    this.document.querySelectorAll('[data-autopr]').forEach((node) => node.remove());
    this.document.getElementById(AutoPrSection.STYLE_ID)?.remove();
  }

  hideOriginals(autoPrRows) {
    const rowSelectors = autoPrRows.map((row) =>
      `${ReviewDashboard.REVIEW_SECTION} ${ReviewDashboard.ROW}:has(${ReviewDashboard.TITLE_LINK}[href="${AutoPrSection.escape(ReviewDashboard.rowUrl(row))}"])`
    );
    const headingSelector = `${ReviewDashboard.REVIEW_SECTION} > h3:not([data-autopr])`;
    const style = this.document.createElement('style');
    style.id = AutoPrSection.STYLE_ID;
    style.textContent = `${[...rowSelectors, headingSelector].join(',\n')} { display: none !important; }`;
    this.document.head.appendChild(style);
  }

  insertReviewHeading(remaining) {
    const original = this.dashboard.reviewHeading();
    if (!original) {
      return;
    }
    const heading = this.document.createElement('h3');
    heading.dataset.autopr = 'review-heading';
    heading.textContent = original.textContent.replace(/\(\d+\)\s*$/, `(${remaining})`);
    original.after(heading);
  }

  insertSection(autoPrRows) {
    const section = this.document.createElement('div');
    section.className = `dashboard-pull-request-table main-section ${AutoPrSection.SECTION_CLASS}`;
    section.dataset.autopr = 'section';

    const heading = this.document.createElement('h3');
    heading.textContent = `${AutoPrSection.TITLE} (${autoPrRows.length})`;

    const table = this.document.createElement('table');
    const head = this.dashboard.reviewTableHead();
    if (head) {
      table.appendChild(head.cloneNode(true));
    }
    const body = this.document.createElement('tbody');
    autoPrRows.forEach((row) => body.appendChild(row.cloneNode(true)));
    table.appendChild(body);

    section.append(heading, table);
    const anchor = this.dashboard.createdSection() ?? this.dashboard.reviewSection();
    anchor.after(section);
  }

  static escape(value) {
    return value.replace(/["\\]/g, '\\$&');
  }
}

globalThis.AutoPrSection = AutoPrSection;
