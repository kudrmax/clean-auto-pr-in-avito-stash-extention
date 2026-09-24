const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { ORIGIN, dashboardHtml, REVIEW_ROWS } = require('./fixture');

const SOURCES = ['AutoPrSettings', 'AutoPrMatcher', 'ReviewDashboard', 'StashPullRequestApi', 'PullRequestRowRenderer', 'StashRowFactory', 'AutoPrSection', 'AutoPrController']
  .map((name) => fs.readFileSync(path.join(__dirname, '..', 'src', `${name}.js`), 'utf8'));

function apiPr(id, repo, title, extra = {}) {
  return {
    id,
    title,
    author: { user: { name: 'gen', displayName: 'Service Generator', avatarUrl: '/users/gen/avatar.png' } },
    toRef: { displayId: 'master', repository: { slug: repo, name: repo, project: { key: 'FMP' } } },
    fromRef: { latestCommit: `c${id}` },
    links: { self: [{ href: `${ORIGIN}/projects/FMP/repos/${repo}/pull-requests/${id}` }] },
    properties: { commentCount: 3, openTaskCount: 1 },
    reviewers: [
      { user: { name: 'e', displayName: 'E', avatarUrl: '/users/E/avatar.png' }, status: 'UNAPPROVED' },
      { user: { name: 'b', displayName: 'B', avatarUrl: '/users/B/avatar.png' }, status: 'NEEDS_WORK' },
      { user: { name: 'd', displayName: 'D', avatarUrl: '/users/D/avatar.png' }, status: 'UNAPPROVED' },
      { user: { name: 'me', displayName: 'Me', avatarUrl: '/users/me/avatar.png' }, status: 'UNAPPROVED', lastReviewedCommit: `old${id}` },
      { user: { name: 'a', displayName: 'A', avatarUrl: '/users/A/avatar.png' }, status: 'APPROVED' },
    ],
    ...extra,
  };
}

const PAGES = [
  {
    values: [
      apiPr(1203, 'service-installments-payment', 'FMP-24113 Добавить sdRef'),
      apiPr(1232, 'service-installments-api', '[AutoPR] AUTOPR-193 Update observability to v2.36.0'),
    ],
    isLastPage: false,
    nextPageStart: 2,
  },
  {
    values: [
      apiPr(829, 'service-installments-item', '[AutoPR] AUTOPR-193 Update platform'),
      apiPr(115, 'service-installments-dc-gateway', '[AutoPR] AUTOPR-193 Update testify to v1.12.1'),
    ],
    isLastPage: true,
  },
];

function wrap(pr) {
  return { pullRequest: pr, buildSummaries: { successful: 2, failed: pr.id === 829 ? 1 : 0, inProgress: 0 } };
}

function fakeFetch({ fail = false, gate = null } = {}) {
  const calls = [];
  const fetch = async (url) => {
    calls.push(url);
    if (gate) {
      await gate;
    }
    if (fail) {
      return { ok: false, status: 500, json: async () => ({}) };
    }
    if (url.startsWith('/rest/ui/latest/dashboard/pull-requests')) {
      const start = Number(new URL(url, ORIGIN).searchParams.get('start'));
      const page = start === 0 ? PAGES[0] : PAGES[1];
      return { ok: true, json: async () => ({ ...page, values: page.values.map(wrap) }) };
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
  const dom = new JSDOM(dashboardHtml(), { runScripts: 'outside-only', url: `${ORIGIN}/dashboard` });
  SOURCES.forEach((source) => dom.window.eval(source));
  const { window } = dom;
  const { fetch, calls } = fakeFetch(fetchOptions);
  const api = new window.StashPullRequestApi(fetch);
  const controller = new window.AutoPrController(window, window.AutoPrSettings.DEFAULT_PATTERN, api);
  return { window, document: window.document, controller, api, calls };
}

const tick = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));
const sectionRows = (document) => [...document.querySelectorAll('[data-autopr="section"] tbody tr')];
const sectionTitles = (document) => sectionRows(document).map((r) => r.querySelector('.title a').textContent);
const skeleton = (node) => node.nodeType !== 1 ? '' :
  `<${node.tagName.toLowerCase()} ${node.getAttribute('class') ?? ''}>${[...node.children].map(skeleton).join('')}</>`;

test('api: uses the same endpoint and order as the Stash dashboard, loads all pages, attaches builds', async () => {
  const { api, calls } = setup();
  const prs = await api.fetchReviewing();

  const pageCalls = calls.filter((u) => u.includes('dashboard/pull-requests')).map((u) => new URL(u, ORIGIN).searchParams);
  assert.deepEqual(pageCalls.map((p) => p.get('start')), ['0', '2']);
  assert.deepEqual(pageCalls[0].getAll('order'), ['participant_status', 'draft_status']);
  assert.equal(pageCalls[0].get('state'), 'OPEN');
  assert.equal(pageCalls[0].get('role'), 'REVIEWER');
  assert.equal(prs.length, 4);
  assert.equal(prs[1].title, '[AutoPR] AUTOPR-193 Update observability to v2.36.0');
  assert.deepEqual({ ...prs.find((pr) => pr.id === 829).builds }, { successful: 2, failed: 1, inProgress: 0, cancelled: 0, unknown: 0 });
  assert.equal(calls.some((u) => u.includes('build-status')), false);
});

test('api: plain PR items without buildSummaries fetch build stats separately', async () => {
  const { window } = setup();
  const calls = [];
  const api = new window.StashPullRequestApi(async (url) => {
    calls.push(url);
    return {
      ok: true,
      json: async () => (url.includes('dashboard')
        ? { values: [apiPr(5, 'r', '[AutoPR] plain')], isLastPage: true }
        : { successful: 1, failed: 0, inProgress: 0 }),
    };
  });
  const prs = await api.fetchReviewing();

  assert.equal(prs[0].title, '[AutoPR] plain');
  assert.equal(prs[0].builds.successful, 1);
  assert.ok(calls.some((u) => u === '/rest/build-status/latest/commits/stats/c5'));
});

test('shows loading placeholder until API responds, then all AutoPRs at once', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const { document, controller } = setup({ gate });
  controller.start();
  await tick();

  assert.equal(document.querySelector('[data-autopr="section"] h3').textContent, 'Pull requests to review (AutoPRs)');
  assert.equal(document.querySelector('[data-autopr="section"] table'), null);
  assert.equal(document.querySelector('[data-autopr="section"] .autopr-loading').textContent, 'Loading AutoPRs…');
  const visible = [...document.querySelectorAll('.reviewing-pull-requests tbody tr')]
    .filter((r) => document.defaultView.getComputedStyle(r).display !== 'none');
  assert.equal(visible.length, REVIEW_ROWS.length - 2);

  release();
  await tick();
  assert.equal(document.querySelector('[data-autopr="section"] h3').textContent, 'Pull requests to review (AutoPRs) (3)');
  assert.equal(document.querySelector('.autopr-loading'), null);
  controller.stop();
});

test('section keeps API order and sits between review and "Your pull requests"', async () => {
  const { document, controller } = setup();
  controller.start();
  await tick();

  const section = document.querySelector('[data-autopr="section"]');
  assert.ok(section.previousElementSibling.classList.contains('reviewing-pull-requests'));
  assert.ok(section.nextElementSibling.classList.contains('created-pull-requests'));
  assert.deepEqual(sectionTitles(document), [
    '[AutoPR] AUTOPR-193 Update observability to v2.36.0',
    '[AutoPR] AUTOPR-193 Update platform',
    '[AutoPR] AUTOPR-193 Update testify to v1.12.1',
  ]);
  controller.stop();
});

test('PR already on the page is shown as a clone of its native Stash row', async () => {
  const { document, controller } = setup();
  controller.start();
  await tick();

  const native = [...document.querySelectorAll('.reviewing-pull-requests tbody tr')]
    .find((r) => r.textContent.includes('Update testify'));
  const shown = sectionRows(document).find((r) => r.textContent.includes('Update testify'));
  assert.equal(shown.outerHTML, native.outerHTML);
  controller.stop();
});

test('PR not on the page is built from a native Stash row with the same markup', async () => {
  const { document, controller } = setup();
  controller.start();
  await tick();

  const row = sectionRows(document).find((r) => r.textContent.includes('Update platform'));
  const native = document.querySelector('.reviewing-pull-requests tbody tr');
  assert.equal(skeleton(row.querySelector('.summary-column')), skeleton(native.querySelector('.summary-column')));
  assert.equal(skeleton(row.querySelector('.comments-column')), skeleton(native.querySelector('.comments-column')));

  assert.equal(row.dataset.pullrequestid, '829');
  assert.equal(row.querySelector('.avatar-column').dataset.username, 'gen');
  assert.equal(row.querySelector('.avatar-column img').getAttribute('src'), '/users/gen/avatar.png');
  assert.equal(row.querySelector('.title a').getAttribute('href'), `${ORIGIN}/projects/FMP/repos/service-installments-item/pull-requests/829`);
  assert.equal(row.querySelector('.user-name').textContent, 'Service Generator');
  assert.equal(row.querySelector('.pr-id').textContent, '#829');
  assert.equal(row.querySelector('.pr-project-repo > a').textContent, 'service-installments-item');
  assert.equal(row.querySelector('.ref-lozenge').dataset.repoSlug, 'service-installments-item');
  assert.ok(row.querySelector('.new-commits-column .new-commits-icon'));
  assert.equal(row.querySelector('.comments-column .count-value').textContent, '3');
  assert.equal(row.querySelector('.tasks-column .count-value').textContent, '1');

  const items = row.querySelectorAll('.reviewers-column li');
  assert.equal(items.length, 4);
  assert.deepEqual([...row.querySelectorAll('.reviewers-column img')].map((i) => i.alt), ['Me', 'A', 'B']);
  assert.equal(items[0].querySelector('[data-testid="reviewer-avatar--status"]'), null);
  assert.ok(items[1].querySelector('[aria-label="Approved"]'));
  assert.equal(items[2].querySelector('[data-testid="reviewer-avatar--status"]'), null);
  assert.equal(items[3].querySelector('button').textContent, '+2');
  assert.equal(items[3].querySelector('button').title, 'D\nE');

  assert.ok(row.querySelector('.builds-column .build-failed-icon'));
  assert.equal(row.querySelector('.builds-column a').getAttribute('href'), `${ORIGIN}/projects/FMP/repos/service-installments-item/pull-requests/829/builds`);
  assert.equal(row.querySelector('.autopr-avatar'), null);
  controller.stop();
});

test('no "New commits" icon when current user reviewed the latest commit', async () => {
  const { window, document } = setup();
  const pr = apiPr(700, 'r', '[AutoPR] reviewed');
  pr.reviewers.find((r) => r.user.name === 'me').lastReviewedCommit = 'c700';
  const api = new window.StashPullRequestApi(async (url) => ({
    ok: true,
    json: async () => (url.includes('dashboard') ? { values: [pr], isLastPage: true } : {}),
  }));
  const controller = new window.AutoPrController(window, window.AutoPrSettings.DEFAULT_PATTERN, api);
  controller.start();
  await tick();

  assert.equal(sectionRows(document)[0].querySelector('.new-commits-column').children.length, 0);
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
  const { document, controller } = setup({ fail: true });
  const originalWarn = console.warn;
  console.warn = () => {};
  controller.start();
  await tick();
  console.warn = originalWarn;

  assert.equal(document.querySelector('[data-autopr="section"] h3').textContent, 'Pull requests to review (AutoPRs) (2)');
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
