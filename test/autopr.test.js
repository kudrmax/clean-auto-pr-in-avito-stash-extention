const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { dashboardHtml, row, REVIEW_ROWS } = require('./fixture');

const SOURCES = ['AutoPrSettings', 'AutoPrMatcher', 'ReviewDashboard', 'StashPullRequestApi', 'PullRequestRowRenderer', 'AutoPrSection', 'AutoPrController']
  .map((name) => fs.readFileSync(path.join(__dirname, '..', 'src', `${name}.js`), 'utf8'));

function setup(html = dashboardHtml()) {
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  SOURCES.forEach((source) => dom.window.eval(source));
  const { window } = dom;
  const controller = new window.AutoPrController(window, window.AutoPrSettings.DEFAULT_PATTERN);
  return { window, document: window.document, controller };
}

const tick = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));
const titles = (rows) => [...rows].map((r) => r.querySelector('.title a').textContent);
const visibleReviewRows = (document) =>
  [...document.querySelectorAll('.reviewing-pull-requests tbody tr.pull-request-row')]
    .filter((r) => document.defaultView.getComputedStyle(r).display !== 'none');

test('matcher: default pattern detects AutoPR titles only', () => {
  const { window } = setup();
  const matcher = new window.AutoPrMatcher(window.AutoPrSettings.DEFAULT_PATTERN);
  assert.equal(matcher.matches('[AutoPR] AUTOPR-193 Update x'), true);
  assert.equal(matcher.matches('  [autopr] something'), true);
  assert.equal(matcher.matches('[FMP-24382] Привязка'), false);
  assert.equal(matcher.matches('FMP-22189 AutoPRs are bad'), false);
});

test('matcher: invalid pattern is rejected', () => {
  const { window } = setup();
  assert.equal(window.AutoPrMatcher.isValidPattern('(['), false);
  assert.equal(window.AutoPrMatcher.isValidPattern('^foo'), true);
});

test('without API: section is inserted after "Your pull requests" with AutoPR rows and count', () => {
  const { document, controller } = setup();
  controller.start();

  const section = document.querySelector('[data-autopr="section"]');
  assert.ok(section);
  assert.equal(section.previousElementSibling.classList.contains('created-pull-requests'), true);
  assert.equal(section.nextElementSibling.classList.contains('closed-pull-requests'), true);
  assert.equal(section.querySelector('h3').textContent, 'Pull requests to review (AutoPRs) (2)');
  assert.deepEqual(titles(section.querySelectorAll('tbody tr')), [
    '[AutoPR] AUTOPR-193 Update observability to v2.36.0',
    '[AutoPR] AUTOPR-193 Update testify to v1.12.1',
  ]);
  assert.ok(section.querySelector('thead'));
  controller.stop();
});

test('originals are hidden, not moved; same PR id in other repo stays visible', () => {
  const { document, controller } = setup();
  controller.start();

  assert.equal(document.querySelectorAll('.reviewing-pull-requests tbody tr').length, REVIEW_ROWS.length);
  assert.deepEqual(titles(visibleReviewRows(document)), [
    'FMP-24113 Добавить sdRef',
    '[FMP-24382] Привязка в оплате',
    'FMP-1 same id, other repo',
  ]);
  controller.stop();
});

test('review heading is left untouched', () => {
  const { document, controller } = setup();
  controller.start();

  const headings = [...document.querySelectorAll('.reviewing-pull-requests > h3')]
    .filter((h) => document.defaultView.getComputedStyle(h).display !== 'none');
  assert.deepEqual(headings.map((h) => h.textContent), [`Pull requests to review (${REVIEW_ROWS.length})`]);
  controller.stop();
});

test('no AutoPRs: nothing is rendered or hidden', () => {
  const { document, controller } = setup(dashboardHtml([REVIEW_ROWS[0], REVIEW_ROWS[2]]));
  controller.start();

  assert.equal(document.querySelector('[data-autopr]'), null);
  assert.equal(document.getElementById('autopr-section-style'), null);
  controller.stop();
});

test('re-renders when page adds a new AutoPR row and does not loop on own mutations', async () => {
  const { document, controller } = setup();
  const renderSpy = { count: 0 };
  const original = controller.section.render.bind(controller.section);
  controller.section.render = (...args) => { renderSpy.count++; return original(...args); };
  controller.start();
  await tick();
  assert.equal(renderSpy.count, 1);

  document.querySelector('.reviewing-pull-requests tbody')
    .insertAdjacentHTML('beforeend', row(450, 'service-installments-entrypoint', '[AutoPR] AUTOPR-193 Update platform'));
  await tick();

  assert.equal(renderSpy.count, 2);
  assert.equal(document.querySelectorAll('[data-autopr="section"]').length, 1);
  assert.equal(document.querySelector('[data-autopr="section"] h3').textContent, 'Pull requests to review (AutoPRs) (3)');
  await tick();
  assert.equal(renderSpy.count, 2);
  controller.stop();
});

test('works when dashboard appears later (SPA render)', async () => {
  const { window, document } = setup('<!doctype html><html><head></head><body></body></html>');
  const controller = new window.AutoPrController(window, window.AutoPrSettings.DEFAULT_PATTERN);
  controller.start();
  document.body.innerHTML = new JSDOM(dashboardHtml()).window.document.body.innerHTML;
  await tick();

  assert.ok(document.querySelector('[data-autopr="section"]'));
  controller.stop();
});

test('setPattern re-evaluates rows', () => {
  const { document, controller } = setup();
  controller.start();
  controller.setPattern('^FMP-24113');

  assert.equal(document.querySelector('[data-autopr="section"] h3').textContent, 'Pull requests to review (AutoPRs) (1)');
  controller.stop();
});
