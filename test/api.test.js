const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { dashboardHtml, REVIEW_ROWS } = require('./fixture');

const SOURCES = ['AutoPrSettings', 'AutoPrMatcher', 'ReviewDashboard', 'StashPullRequestApi', 'PullRequestRowRenderer', 'AutoPrSection', 'AutoPrController']
  .map((name) => fs.readFileSync(path.join(__dirname, '..', 'src', `${name}.js`), 'utf8'));

function apiPr(id, repo, title, extra = {}) {
  return {
    id,
    title,
    author: { user: { displayName: 'Service Generator', avatarUrl: `/users/gen/avatar.png` } },
    toRef: { displayId: 'master', repository: { slug: repo, name: repo, project: { key: 'FMP' } } },
    fromRef: { latestCommit: `c${id}` },
    links: { self: [{ href: `https://stash.example/projects/FMP/repos/${repo}/pull-requests/${id}` }] },
    properties: { commentCount: 3, openTaskCount: 1 },
    reviewers: ['A', 'B', 'C', 'D', 'E'].map((name, i) => ({
      user: { displayName: name, avatarUrl: `/users/${name}/avatar.png` },
      status: i === 0 ? 'APPROVED' : 'UNAPPROVED',
    })),
    ...extra,
  };
}

const PAGES = [
  { values: [apiPr(1203, 'payment', 'FMP-24113 Добавить sdRef'), apiPr(1232, 'api', '[AutoPR] AUTOPR-193 Update observability')], isLastPage: false, nextPageStart: 2 },
  { values: [apiPr(829, 'item', '[AutoPR] AUTOPR-193 Update platform'), apiPr(115, 'dc-gateway', '[AutoPR] AUTOPR-193 Update testify')], isLastPage: true },
];

function fakeFetch({ fail = false } = {}) {
  const calls = [];
  const fetch = async (url) => {
    calls.push(url);
    if (fail) {
      return { ok: false, status: 500, json: async () => ({}) };
    }
    if (url.startsWith('/rest/api/latest/dashboard/pull-requests')) {
      const start = Number(new URL(url, 'https://x').searchParams.get('start'));
      return { ok: true, json: async () => (start === 0 ? PAGES[0] : PAGES[1]) };
    }
    if (url.startsWith('/rest/build-status/latest/commits/stats/')) {
      const failed = url.endsWith('c829') ? 1 : 0;
      return { ok: true, json: async () => ({ successful: 2, failed, inProgress: 0 }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { fetch, calls };
}

function setup(fetchOptions) {
  const dom = new JSDOM(dashboardHtml(), { runScripts: 'outside-only', url: 'https://stash.example/dashboard' });
  SOURCES.forEach((source) => dom.window.eval(source));
  const { window } = dom;
  const { fetch, calls } = fakeFetch(fetchOptions);
  const api = new window.StashPullRequestApi(fetch);
  const controller = new window.AutoPrController(window, window.AutoPrSettings.DEFAULT_PATTERN, api);
  return { window, document: window.document, controller, api, calls };
}

const tick = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));
const sectionTitles = (document) =>
  [...document.querySelectorAll('[data-autopr="section"] tbody tr .title a')].map((a) => a.textContent);

test('api: loads all pages and attaches build stats', async () => {
  const { api, calls } = setup();
  const prs = await api.fetchReviewing();

  assert.equal(prs.length, 4);
  assert.deepEqual(calls.filter((u) => u.includes('dashboard/pull-requests')).map((u) => new URL(u, 'https://x').searchParams.get('start')), ['0', '2']);
  assert.ok(calls[0].includes('state=OPEN') && calls[0].includes('role=REVIEWER'));
  assert.deepEqual({ ...prs.find((pr) => pr.id === 829).builds }, { successful: 2, failed: 1, inProgress: 0 });
  assert.equal(prs[0].repoUrl, '/projects/FMP/repos/payment/browse');
});

test('section shows all AutoPRs from API, including ones not rendered on the page', async () => {
  const { document, controller } = setup();
  controller.start();
  await tick();

  assert.equal(document.querySelector('[data-autopr="section"] h3').textContent, 'Pull requests to review (AutoPRs) (3)');
  assert.deepEqual(sectionTitles(document), [
    '[AutoPR] AUTOPR-193 Update observability',
    '[AutoPR] AUTOPR-193 Update platform',
    '[AutoPR] AUTOPR-193 Update testify',
  ]);
  controller.stop();
});

test('rendered AutoPR row: details, counts, reviewers with +N tooltip, build status', async () => {
  const { document, controller } = setup();
  controller.start();
  await tick();

  const row = [...document.querySelectorAll('[data-autopr="section"] tbody tr')]
    .find((r) => r.querySelector('.title a').textContent.includes('platform'));
  assert.equal(row.children.length, 8);
  assert.equal(row.querySelector('.title a').getAttribute('href'), 'https://stash.example/projects/FMP/repos/item/pull-requests/829');
  assert.equal(row.querySelector('.pr-id').textContent, '#829');
  assert.equal(row.querySelector('.user-name').textContent, 'Service Generator');
  assert.equal(row.querySelector('.ref-lozenge').textContent, 'master');
  assert.equal(row.querySelector('.comments-column .count-value').textContent, '3');
  assert.equal(row.querySelector('.tasks-column .count-value').textContent, '1');
  assert.equal(row.querySelectorAll('.autopr-reviewer').length, 3);
  assert.equal(row.querySelector('.autopr-reviewer-approved').title, 'A (approved)');
  assert.equal(row.querySelector('.autopr-more').textContent, '+2');
  assert.equal(row.querySelector('.autopr-more').title, 'D\nE');
  assert.ok(row.querySelector('.autopr-build-failed'));
  controller.stop();
});

test('titles from API are inserted as text, not HTML', async () => {
  const { window, document } = setup();
  const api = new window.StashPullRequestApi(async (url) => ({
    ok: true,
    json: async () => (url.includes('dashboard') ? { values: [apiPr(1, 'r', '[AutoPR] <img src=x onerror=alert(1)>')], isLastPage: true } : {}),
  }));
  const controller = new window.AutoPrController(window, window.AutoPrSettings.DEFAULT_PATTERN, api);
  controller.start();
  await tick();

  assert.equal(document.querySelector('[data-autopr="section"] img[src="x"]'), null);
  assert.equal(sectionTitles(document)[0], '[AutoPR] <img src=x onerror=alert(1)>');
  controller.stop();
});

test('API failure falls back to visible rows', async () => {
  const { window, document, controller } = setup({ fail: true });
  window.console.warn = () => {};
  const originalWarn = console.warn;
  console.warn = () => {};
  controller.start();
  await tick();
  console.warn = originalWarn;

  assert.equal(document.querySelector('[data-autopr="section"] h3').textContent, 'Pull requests to review (AutoPRs) (2)');
  controller.stop();
});

test('visible AutoPR rows in review list are still hidden when API is used', async () => {
  const { document, controller } = setup();
  controller.start();
  await tick();

  const visible = [...document.querySelectorAll('.reviewing-pull-requests tbody tr')]
    .filter((r) => document.defaultView.getComputedStyle(r).display !== 'none');
  assert.equal(visible.length, REVIEW_ROWS.length - 2);
  controller.stop();
});

test('API is called once per dashboard, not on every mutation', async () => {
  const { document, controller, calls } = setup();
  controller.start();
  await tick();
  document.querySelector('.reviewing-pull-requests tbody').appendChild(document.createElement('tr'));
  await tick();

  assert.equal(calls.filter((u) => u.includes('dashboard/pull-requests')).length, 2);
  controller.stop();
});
