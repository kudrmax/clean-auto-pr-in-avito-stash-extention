class AutoPrController {
  static DEBOUNCE_MS = 50;

  constructor(window, pattern) {
    this.window = window;
    this.dashboard = new ReviewDashboard(window.document);
    this.section = new AutoPrSection(window.document, this.dashboard);
    this.matcher = new AutoPrMatcher(pattern);
    this.signature = null;
    this.timer = null;
    this.observer = new window.MutationObserver(() => this.schedule());
  }

  start() {
    this.observer.observe(this.window.document.body, { childList: true, subtree: true, characterData: true });
    this.refresh();
  }

  stop() {
    this.observer.disconnect();
    this.window.clearTimeout(this.timer);
  }

  setPattern(pattern) {
    this.matcher = new AutoPrMatcher(pattern);
    this.signature = null;
    this.refresh();
  }

  schedule() {
    this.window.clearTimeout(this.timer);
    this.timer = this.window.setTimeout(() => this.refresh(), AutoPrController.DEBOUNCE_MS);
  }

  refresh() {
    const rows = this.dashboard.reviewRows();
    const autoPrRows = rows.filter((row) => this.matcher.matches(ReviewDashboard.rowTitle(row)));
    const signature = this.signatureOf(rows, autoPrRows);
    if (signature === this.signature && this.isRendered(autoPrRows)) {
      return;
    }
    this.signature = signature;
    this.section.render(autoPrRows, rows.length);
  }

  signatureOf(rows, autoPrRows) {
    return JSON.stringify([
      rows.map((row) => row.outerHTML),
      autoPrRows.map(ReviewDashboard.rowUrl),
      Boolean(this.dashboard.createdSection()),
      this.dashboard.reviewHeading()?.textContent,
    ]);
  }

  isRendered(autoPrRows) {
    const hasSection = Boolean(this.window.document.querySelector('[data-autopr="section"]'));
    return hasSection === autoPrRows.length > 0;
  }
}

globalThis.AutoPrController = AutoPrController;
