class ReviewDashboard {
  static REVIEW_SECTION = '.dashboard-pull-request-table.reviewing-pull-requests';
  static CREATED_SECTION = '.dashboard-pull-request-table.created-pull-requests';
  static ROW = 'tr.pull-request-row';
  static TITLE_LINK = '.pr-summary .title a';

  constructor(document) {
    this.document = document;
  }

  reviewSection() {
    return this.document.querySelector(ReviewDashboard.REVIEW_SECTION);
  }

  createdSection() {
    return this.document.querySelector(ReviewDashboard.CREATED_SECTION);
  }

  observedRoot() {
    return this.reviewSection()?.parentElement ?? null;
  }

  reviewRows() {
    const section = this.reviewSection();
    return section ? [...section.querySelectorAll(`tbody ${ReviewDashboard.ROW}`)] : [];
  }

  reviewTableHead() {
    return this.reviewSection()?.querySelector('thead') ?? null;
  }

  reviewHeading() {
    return this.reviewSection()?.querySelector(':scope > h3:not([data-autopr])') ?? null;
  }

  static rowUrl(row) {
    return row.querySelector(ReviewDashboard.TITLE_LINK)?.getAttribute('href') ?? '';
  }

  static rowTitle(row) {
    return row.querySelector(ReviewDashboard.TITLE_LINK)?.textContent.trim() ?? '';
  }
}

globalThis.ReviewDashboard = ReviewDashboard;
