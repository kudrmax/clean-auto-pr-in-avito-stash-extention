class PullRequestRowRenderer {
  static VISIBLE_REVIEWERS = 3;
  static STYLE_ID = 'autopr-row-style';
  static STYLE = `
    .autopr-pull-requests td { vertical-align: middle; }
    .autopr-avatar { border-radius: 50%; object-fit: cover; background: var(--ds-background-neutral, #dfe1e6); }
    .autopr-avatar-author { width: 48px; height: 48px; }
    .autopr-reviewers { display: flex; align-items: center; }
    .autopr-reviewer { position: relative; margin-left: -6px; }
    .autopr-reviewer:first-child { margin-left: 0; }
    .autopr-reviewer .autopr-avatar { width: 32px; height: 32px; border: 2px solid var(--ds-surface, #fff); }
    .autopr-reviewer-approved .autopr-avatar { border-color: var(--ds-icon-success, #22a06b); }
    .autopr-reviewer-needs-work .autopr-avatar { border-color: var(--ds-icon-warning, #e2b203); }
    .autopr-more { margin-left: 4px; padding: 0 6px; border-radius: 12px; font-size: 11px; cursor: default;
      background: var(--ds-background-neutral, #f1f2f4); color: var(--ds-text-subtle, #44546f); line-height: 24px; }
    .autopr-count { display: inline-flex; align-items: center; gap: 4px; color: var(--ds-text-subtle, #44546f); }
    .autopr-count svg { width: 24px; height: 24px; }
    .autopr-build { font-weight: 700; text-decoration: none; }
    .autopr-build-successful { color: var(--ds-icon-success, #22a06b); }
    .autopr-build-failed { color: var(--ds-icon-danger, #c9372c); }
    .autopr-build-in-progress { color: var(--ds-icon-information, #1d7afc); }
  `;
  static COMMENT_ICON = 'M4.998 11.513c0-3.038 3.141-5.51 7.002-5.51 3.861 0 7.002 2.472 7.002 5.51 0 3.039-3.141 5.51-7.002 5.51-3.861 0-7.002-2.471-7.002-5.51zm14.84 7.771v-.002s-1.564-2.26-.767-3.116l-.037.02C20.261 14.902 21 13.279 21 11.513 21 7.371 16.963 4 12 4s-9 3.37-9 7.513 4.037 7.514 9 7.514c1.42 0 2.76-.285 3.957-.776 1.003 1.022 2.287 1.572 3.24 1.719l.002-.003a.524.524 0 00.164.033.515.515 0 00.474-.716z';
  static TASK_ICON = 'M3 3.993C3 3.445 3.445 3 3.993 3h16.014c.548 0 .993.445.993.993v16.014a.994.994 0 01-.993.993H3.993A.994.994 0 013 20.007V3.993zM5 5v14h14V5H5zm4.707 6.3a1 1 0 10-1.414 1.414l2 2a1 1 0 001.414 0l4-4a1 1 0 10-1.414-1.414L11 12.586l-1.293-1.293z';

  constructor(document) {
    this.document = document;
  }

  ensureStyle() {
    if (this.document.getElementById(PullRequestRowRenderer.STYLE_ID)) {
      return;
    }
    const style = this.document.createElement('style');
    style.id = PullRequestRowRenderer.STYLE_ID;
    style.textContent = PullRequestRowRenderer.STYLE;
    this.document.head.appendChild(style);
  }

  render(pr) {
    this.ensureStyle();
    const row = this.element('tr', 'pull-request-row');
    row.dataset.pullrequestid = String(pr.id);
    row.append(
      this.cell('avatar-column', this.authorAvatar(pr.author)),
      this.cell('summary-column', this.summary(pr)),
      this.cell('state-column'),
      this.cell('new-commits-column'),
      this.cell('comments-column', this.count(pr.commentCount, PullRequestRowRenderer.COMMENT_ICON, 'Comments')),
      this.cell('tasks-column', this.count(pr.openTaskCount, PullRequestRowRenderer.TASK_ICON, 'Open tasks')),
      this.cell('reviewers-column', this.reviewers(pr.reviewers)),
      this.cell('builds-column', this.builds(pr)),
    );
    return row;
  }

  summary(pr) {
    const title = this.element('div', 'title');
    title.appendChild(this.link(pr.url, pr.title));

    const repo = this.element('span', 'pr-project-repo');
    const project = this.element('span', 'project-name details-item');
    project.appendChild(this.link(pr.projectUrl, pr.projectKey));
    repo.append(project, this.element('span', 'details-item separator', ' / '), this.link(pr.repoUrl, pr.repoName, 'details-item'));

    const branch = this.element('span', 'ref-lozenge details-item');
    const branchContent = this.element('span', 'ref-lozenge-content');
    branchContent.appendChild(this.element('span', '', pr.branch));
    branch.appendChild(branchContent);

    const details = this.element('div', 'details');
    details.append(
      this.element('span', 'user-name details-item', pr.author.name),
      this.element('span', 'details-item', '-'),
      this.element('span', 'details-item pr-id', `#${pr.id}`),
      repo,
      branch,
    );

    const summary = this.element('div', 'pr-summary');
    summary.append(title, details);
    return summary;
  }

  authorAvatar(author) {
    const wrapper = this.element('div', 'user-avatar author-avatar');
    wrapper.appendChild(this.avatar(author, 'autopr-avatar autopr-avatar-author'));
    return wrapper;
  }

  reviewers(reviewers) {
    const list = this.element('div', 'autopr-reviewers');
    reviewers.slice(0, PullRequestRowRenderer.VISIBLE_REVIEWERS).forEach((reviewer) => {
      const item = this.element('span', `autopr-reviewer ${PullRequestRowRenderer.statusClass(reviewer.status)}`);
      item.title = PullRequestRowRenderer.reviewerLabel(reviewer);
      item.appendChild(this.avatar(reviewer, 'autopr-avatar'));
      list.appendChild(item);
    });
    const hidden = reviewers.slice(PullRequestRowRenderer.VISIBLE_REVIEWERS);
    if (hidden.length > 0) {
      const more = this.element('span', 'autopr-more', `+${hidden.length}`);
      more.title = hidden.map(PullRequestRowRenderer.reviewerLabel).join('\n');
      list.appendChild(more);
    }
    return list;
  }

  builds(pr) {
    if (!pr.builds) {
      return null;
    }
    const { successful, failed, inProgress } = pr.builds;
    const total = successful + failed + inProgress;
    if (total === 0) {
      return null;
    }
    const [modifier, symbol] = failed > 0 ? ['failed', '✕'] : inProgress > 0 ? ['in-progress', '●'] : ['successful', '✓'];
    const link = this.link(`${pr.url}/builds`, symbol, `autopr-build autopr-build-${modifier}`);
    link.title = `${successful} successful, ${failed} failed, ${inProgress} in progress`;
    return link;
  }

  count(value, iconPath, label) {
    if (!value) {
      return null;
    }
    const wrapper = this.element('span', 'autopr-count');
    wrapper.title = label;
    const svg = this.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const path = this.document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', iconPath);
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('fill-rule', 'evenodd');
    svg.appendChild(path);
    wrapper.append(svg, this.element('span', 'count-value', String(value)));
    return wrapper;
  }

  avatar(user, className) {
    const img = this.element('img', className);
    img.alt = user.name;
    if (user.avatarUrl) {
      img.src = user.avatarUrl;
    }
    return img;
  }

  cell(className, content) {
    const cell = this.element('td', className);
    if (content) {
      cell.appendChild(content);
    }
    return cell;
  }

  link(href, text, className = '') {
    const link = this.element('a', className, text);
    link.href = href;
    return link;
  }

  element(tag, className = '', text = null) {
    const element = this.document.createElement(tag);
    if (className) {
      element.className = className;
    }
    if (text !== null) {
      element.textContent = text;
    }
    return element;
  }

  static statusClass(status) {
    return { APPROVED: 'autopr-reviewer-approved', NEEDS_WORK: 'autopr-reviewer-needs-work' }[status] ?? '';
  }

  static reviewerLabel(reviewer) {
    const status = { APPROVED: 'approved', NEEDS_WORK: 'needs work' }[reviewer.status];
    return status ? `${reviewer.name} (${status})` : reviewer.name;
  }
}

globalThis.PullRequestRowRenderer = PullRequestRowRenderer;
