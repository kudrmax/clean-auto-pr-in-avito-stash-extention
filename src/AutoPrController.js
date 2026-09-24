class AutoPrController {
  static DEBOUNCE_MS = 50;

  constructor(window, pattern, api) {
    this.window = window;
    this.api = api;
    this.dashboard = new ReviewDashboard(window.document);
    this.section = new AutoPrSection(window.document, this.dashboard);
    this.rowFactory = new StashRowFactory(window.document);
    this.fallbackRenderer = new PullRequestRowRenderer(window.document);
    this.matcher = new AutoPrMatcher(pattern);
    this.pullRequests = null;
    this.loading = false;
    this.loadedFor = null;
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
    this.loadIfDashboardChanged();
    const rows = this.dashboard.reviewRows();
    const autoPrRows = rows.filter((row) => this.matcher.matches(ReviewDashboard.rowTitle(row)));
    const autoPullRequests = this.pullRequests?.filter((pr) => this.matcher.matches(pr.title)) ?? null;
    const signature = JSON.stringify([
      this.loading,
      rows.map((row) => row.outerHTML),
      autoPullRequests,
    ]);
    if (signature === this.signature && this.isRendered(autoPullRequests ?? autoPrRows)) {
      return;
    }
    this.signature = signature;

    if (this.loading) {
      this.section.renderLoading(autoPrRows);
    } else if (autoPullRequests) {
      this.section.render(autoPrRows, autoPullRequests.map((pr) => this.rowFor(pr)));
    } else {
      this.section.render(autoPrRows, autoPrRows.map((row) => row.cloneNode(true)));
    }
  }

  rowFor(pr) {
    return this.rowFactory.create(pr) ?? this.fallbackRenderer.render(pr);
  }

  loadIfDashboardChanged() {
    const reviewSection = this.dashboard.reviewSection();
    if (!this.api || !reviewSection || reviewSection === this.loadedFor) {
      return;
    }
    this.loadedFor = reviewSection;
    this.loading = true;
    this.load();
  }

  async load() {
    try {
      this.pullRequests = await this.api.fetchReviewing();
    } catch (error) {
      console.warn('[Clean AutoPR in Avito Stash] Falling back to visible rows:', error);
      this.pullRequests = null;
    }
    this.loading = false;
    this.signature = null;
    this.refresh();
  }

  isRendered(sectionItems) {
    const hasSection = Boolean(this.window.document.querySelector('[data-autopr="section"]'));
    return hasSection === (this.loading || sectionItems.length > 0);
  }
}

globalThis.AutoPrController = AutoPrController;
