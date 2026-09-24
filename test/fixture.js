function row(id, repo, title) {
  const url = `https://stash.example/projects/FMP/repos/${repo}/pull-requests/${id}/overview`;
  return `<tr class="pull-request-row" data-pullrequestid="${id}"><td class="avatar-column"></td>` +
    `<td class="summary-column"><div class="pr-summary"><div class="title"><a href="${url}">${title}</a></div>` +
    `<div class="details"><span class="details-item pr-id">#${id}</span></div></div></td></tr>`;
}

function section(cls, heading, rows) {
  return `<div class="dashboard-pull-request-table main-section ${cls}"><h3>${heading}</h3>` +
    `<table><thead><tr><th class="summary-column" colspan="6"></th><th class="reviewers-column">Reviewers</th></tr></thead>` +
    `<tbody>${rows.join('')}</tbody></table></div>`;
}

const REVIEW_ROWS = [
  row(1203, 'service-installments-payment', 'FMP-24113 Добавить sdRef'),
  row(1232, 'service-installments-api', '[AutoPR] AUTOPR-193 Update observability to v2.36.0'),
  row(1233, 'service-installments-api', '[FMP-24382] Привязка в оплате'),
  row(1232, 'service-installments-item', 'FMP-1 same id, other repo'),
  row(115, 'service-installments-dc-gateway', '[AutoPR] AUTOPR-193 Update testify to v1.12.1'),
];

function dashboardHtml(reviewRows = REVIEW_ROWS) {
  return `<!doctype html><html><head></head><body><section id="content"><div id="dashboard-container"><div class="main-panel">` +
    `<h2>Your work</h2>` +
    section('reviewing-pull-requests', `Pull requests to review (${reviewRows.length})`, reviewRows) +
    section('created-pull-requests', 'Your pull requests (1)', [row(9, 'svc', 'FMP-9 mine')]) +
    section('closed-pull-requests', 'Recently closed pull requests (0)', []) +
    `</div></div></section></body></html>`;
}

module.exports = { dashboardHtml, row, REVIEW_ROWS };
