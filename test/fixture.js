const ORIGIN = 'https://stash.example';

function reviewerItem(name, zIndex, statusLabel) {
  const status = statusLabel
    ? `<span aria-hidden="true" data-testid="reviewer-avatar--status" style="position: absolute;"><span role="presentation" class="css-i36oiv">` +
      `<div class="reviewer-avatar-status"><span role="img" aria-label="${statusLabel}" class="css-snhnyn"><svg></svg></span></div></span></span>`
    : '';
  return `<li class="css-1rr4y08"><div role="presentation"><div data-testid="reviewer-avatar" style="display: inline-block; position: relative; z-index: ${zIndex};">` +
    `<span class="css-owljq2" data-testid="reviewer-avatar--inner"><img src="/users/${name}/avatar.png" alt="${name}" data-testid="reviewer-avatar--image" class="css-13ep12v"></span>` +
    `${status}</div></div></li>`;
}

function row(id, repo, title, { comments = 0, tasks = 0, build = 'successful', approved = false, more = 7 } = {}) {
  const url = `${ORIGIN}/projects/FMP/repos/${repo}/pull-requests/${id}/overview`;
  const count = (label, value) => value
    ? `<span role="presentation"><span class="count-icon"><span role="img" aria-label="${label}" class="css-snhnyn"><svg></svg></span></span><span class="count-value">${value}</span></span>`
    : '';
  return `<tr class="pull-request-row" data-pullrequestid="${id}">` +
    `<td class="avatar-column" data-username="author${id}"><div class="user-avatar author-avatar"><div style="display: inline-block;"><span class="css-1qdk52b">` +
    `<img src="/users/author${id}/avatar.png" alt="Author ${id}" class="css-13ep12v"></span></div></div></td>` +
    `<td class="summary-column"><div class="pr-summary"><div class="title"><a href="${url}">${title}</a></div>` +
    `<div class="details"><span class="user-name details-item">Author ${id}</span><span class="details-item">-</span>` +
    `<span class="details-item pr-id">#${id}</span><span class="pr-project-repo"><span class="project-name details-item"><a href="${ORIGIN}/projects/FMP">FMP</a></span>` +
    `<span class="details-item separator"> / </span><a class="details-item" href="${ORIGIN}/projects/FMP/repos/${repo}/browse">${repo}</a></span>` +
    `<span class="ref-lozenge details-item" data-project-key="FMP" data-repo-slug="${repo}"><span role="presentation">` +
    `<span class="ref-lozenge-content" role="button" aria-label="FMP / ${repo}, master. Copy branch name"><span>master</span></span></span></span></div></div></td>` +
    `<td class="state-column"></td>` +
    `<td class="new-commits-column"><div role="presentation"><span class="new-commits-icon"></span></div></td>` +
    `<td class="comments-column">${count('Comments:', comments)}</td>` +
    `<td class="tasks-column">${count('Open tasks:', tasks)}</td>` +
    `<td class="reviewers-column"><ul aria-label="avatar group" class="css-1n6q81t">` +
    reviewerItem('me', 4) + reviewerItem('rev1', 3, approved ? 'Approved' : null) + reviewerItem('rev2', 2) +
    `<li class="css-1rr4y08"><div style="display: inline-block;"><button type="button" class="css-y2vdr0">+${more}</button></div></li></ul></td>` +
    `<td class="builds-column"><div role="presentation"><a class="css-16qk9va" data-testid="build-summary-icon-link" href="${ORIGIN}/projects/FMP/repos/${repo}/pull-requests/${id}/builds">` +
    `<span class="css-bwxjrz"><div class="build-status-icon build-${build}-icon"><span role="img" aria-label="2 builds" class="css-1wits42"><svg></svg></span></div></span></a></div></td>` +
    `</tr>`;
}

function section(cls, heading, rows) {
  return `<div class="dashboard-pull-request-table main-section ${cls}"><h3>${heading}</h3>` +
    `<table><thead><tr><th class="summary-column" colspan="6"></th><th class="reviewers-column">Reviewers</th><th class="builds-column">Builds</th></tr></thead>` +
    `<tbody>${rows.join('')}</tbody></table></div>`;
}

const REVIEW_ROWS = [
  row(1203, 'service-installments-payment', 'FMP-24113 Добавить sdRef', { comments: 6, tasks: 1 }),
  row(1232, 'service-installments-api', '[AutoPR] AUTOPR-193 Update observability to v2.36.0', { comments: 1 }),
  row(1233, 'service-installments-api', '[FMP-24382] Привязка в оплате', { approved: true }),
  row(1232, 'service-installments-item', 'FMP-1 same id, other repo', { build: 'failed' }),
  row(115, 'service-installments-dc-gateway', '[AutoPR] AUTOPR-193 Update testify to v1.12.1'),
];

function dashboardHtml(reviewRows = REVIEW_ROWS) {
  return `<!doctype html><html><head></head><body><span id="current-user" data-username="me"></span><section id="content"><div id="dashboard-container"><div class="main-panel">` +
    `<h2>Your work</h2>` +
    section('reviewing-pull-requests', `Pull requests to review (${reviewRows.length})`, reviewRows) +
    section('created-pull-requests', 'Your pull requests (1)', [row(9, 'svc', 'FMP-9 mine')]) +
    section('closed-pull-requests', 'Recently closed pull requests (0)', []) +
    `</div></div></section></body></html>`;
}

module.exports = { ORIGIN, dashboardHtml, row, REVIEW_ROWS };
