class StashRowFactory {
  static VISIBLE_REVIEWERS = 3;
  static STATUS_LABELS = { APPROVED: 'Approved', NEEDS_WORK: 'Changes requested' };
  static STATUS_ORDER = { APPROVED: 1, NEEDS_WORK: 2, UNAPPROVED: 3 };
  static BUILD_STATES = ['failed', 'inProgress', 'successful', 'cancelled', 'unknown'];
  static BUILD_ICON_CLASSES = {
    failed: 'build-failed-icon',
    inProgress: 'build-in-progress-icon',
    successful: 'build-successful-icon',
    cancelled: 'build-cancelled-icon',
    unknown: 'build-unknown-icon',
  };
  static NATIVE_ROWS = '.dashboard-pull-request-table:not([data-autopr]) tr.pull-request-row';

  constructor(document) {
    this.document = document;
  }

  create(pr) {
    const nativeRows = [...this.document.querySelectorAll(StashRowFactory.NATIVE_ROWS)];
    const key = StashRowFactory.keyOf(pr.url);
    const own = nativeRows.find((row) =>
      row.closest(ReviewDashboard.REVIEW_SECTION) && StashRowFactory.keyOf(ReviewDashboard.rowUrl(row)) === key
    );
    if (own) {
      return own.cloneNode(true);
    }
    const template = nativeRows.find((row) => row.closest(ReviewDashboard.REVIEW_SECTION)) ?? nativeRows[0];
    if (!template) {
      return null;
    }
    const row = template.cloneNode(true);
    row.dataset.pullrequestid = String(pr.id);
    this.fillAuthor(row, pr.author);
    this.fillSummary(row, pr);
    this.clear(row.querySelector('.state-column'));
    const self = pr.reviewers.find((reviewer) => reviewer.username && reviewer.username === this.currentUsername());
    this.fillNewCommits(row, nativeRows, Boolean(self) && self.lastReviewedCommit !== pr.latestCommit);
    this.fillCount(row, nativeRows, 'comments-column', pr.commentCount);
    this.fillCount(row, nativeRows, 'tasks-column', pr.openTaskCount);
    this.fillReviewers(row, nativeRows, StashRowFactory.sortReviewers(pr.reviewers, self));
    this.fillBuilds(row, nativeRows, pr);
    return row;
  }

  fillAuthor(row, author) {
    const cell = row.querySelector('.avatar-column');
    if (cell && author.username) {
      cell.dataset.username = author.username;
    }
    this.setAvatar(row.querySelector('.avatar-column img'), author);
  }

  fillSummary(row, pr) {
    this.setLink(row.querySelector('.pr-summary .title a'), pr.url, pr.title);
    this.setText(row.querySelector('.details .user-name'), pr.author.name);
    this.setText(row.querySelector('.details .pr-id'), `#${pr.id}`);
    this.setLink(row.querySelector('.details .project-name a'), pr.projectUrl, pr.projectKey);
    this.setLink(row.querySelector('.details .pr-project-repo > a'), pr.repoUrl, pr.repoName);
    const lozenge = row.querySelector('.details .ref-lozenge');
    if (lozenge) {
      lozenge.dataset.projectKey = pr.projectKey;
      lozenge.dataset.repoSlug = pr.repoSlug;
      lozenge.querySelector('.ref-lozenge-content')
        ?.setAttribute('aria-label', `${pr.projectKey} / ${pr.repoSlug}, ${pr.branch}. Copy branch name`);
      const texts = lozenge.querySelectorAll('.ref-lozenge-content span');
      this.setText(texts[texts.length - 1], pr.branch);
    }
  }

  currentUsername() {
    return this.document.getElementById('current-user')?.dataset.username ?? '';
  }

  fillNewCommits(row, nativeRows, hasNewCommits) {
    const cell = row.querySelector('.new-commits-column');
    this.clear(cell);
    const prototype = this.findPrototype(nativeRows, '.new-commits-column .new-commits-icon')?.closest('.new-commits-column');
    if (cell && hasNewCommits && prototype) {
      cell.append(...[...prototype.childNodes].map((node) => node.cloneNode(true)));
    }
  }

  fillCount(row, nativeRows, columnClass, value) {
    const cell = row.querySelector(`.${columnClass}`);
    this.clear(cell);
    const prototype = this.findPrototype(nativeRows, `.${columnClass} .count-value`)?.closest(`.${columnClass}`);
    if (!cell || !value || !prototype) {
      return;
    }
    cell.append(...[...prototype.childNodes].map((node) => node.cloneNode(true)));
    this.setText(cell.querySelector('.count-value'), String(value));
  }

  fillReviewers(row, nativeRows, reviewers) {
    const list = row.querySelector('.reviewers-column ul');
    const avatarItem = this.findPrototype(nativeRows, '.reviewers-column li [data-testid="reviewer-avatar"]')?.closest('li');
    if (!list || !avatarItem) {
      return;
    }
    const moreItem = this.findPrototype(nativeRows, '.reviewers-column li button')?.closest('li');
    const visible = reviewers.slice(0, StashRowFactory.VISIBLE_REVIEWERS);
    const hidden = reviewers.slice(StashRowFactory.VISIBLE_REVIEWERS);
    this.clear(list);

    visible.forEach((reviewer, index) => {
      const item = avatarItem.cloneNode(true);
      item.querySelectorAll('[data-testid="reviewer-avatar--status"]').forEach((node) => node.remove());
      const avatar = item.querySelector('[data-testid="reviewer-avatar"]');
      avatar.style.zIndex = String(visible.length + 1 - index);
      this.setAvatar(item.querySelector('img'), reviewer);
      const status = this.statusBadge(nativeRows, reviewer.status);
      if (status) {
        avatar.appendChild(status);
      }
      list.appendChild(item);
    });

    if (hidden.length > 0 && moreItem) {
      const item = moreItem.cloneNode(true);
      const button = item.querySelector('button');
      button.textContent = `+${hidden.length}`;
      button.title = hidden.map((reviewer) => reviewer.name).join('\n');
      list.appendChild(item);
    }
  }

  statusBadge(nativeRows, status) {
    const label = StashRowFactory.STATUS_LABELS[status];
    if (!label) {
      return null;
    }
    const icon = this.findPrototype(nativeRows, `[data-testid="reviewer-avatar--status"] [aria-label="${label}"]`);
    return icon?.closest('[data-testid="reviewer-avatar--status"]').cloneNode(true) ?? null;
  }

  fillBuilds(row, nativeRows, pr) {
    const cell = row.querySelector('.builds-column');
    this.clear(cell);
    const state = StashRowFactory.buildState(pr.builds);
    if (!cell || !state) {
      return;
    }
    const prototype = this.findPrototype(nativeRows, `.builds-column .${StashRowFactory.BUILD_ICON_CLASSES[state]}`)
      ?.closest('.builds-column');
    if (!prototype) {
      return;
    }
    cell.append(...[...prototype.childNodes].map((node) => node.cloneNode(true)));
    const count = pr.builds[state];
    cell.querySelector('a')?.setAttribute('href', `${pr.url}/builds`);
    cell.querySelector('.build-status-icon [aria-label]')
      ?.setAttribute('aria-label', count === 1 ? '1 build' : `${count} builds`);
  }

  findPrototype(nativeRows, selector) {
    for (const row of nativeRows) {
      const found = row.querySelector(selector);
      if (found) {
        return found;
      }
    }
    return null;
  }

  setAvatar(img, user) {
    if (!img) {
      return;
    }
    img.alt = user.name;
    if (user.avatarUrl) {
      img.src = user.avatarUrl;
    } else {
      img.removeAttribute('src');
    }
  }

  setLink(link, href, text) {
    if (link) {
      link.href = href;
      link.textContent = text;
    }
  }

  setText(node, text) {
    if (node) {
      node.textContent = text;
    }
  }

  clear(node) {
    node?.replaceChildren();
  }

  static sortReviewers(reviewers, self) {
    const rank = StashRowFactory.STATUS_ORDER;
    return reviewers.slice().sort((a, b) => {
      if (a === self) return -1;
      if (b === self) return 1;
      if (rank[a.status] < rank[b.status]) return -1;
      if (rank[a.status] > rank[b.status]) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  static buildState(builds) {
    return StashRowFactory.BUILD_STATES.find((state) => builds?.[state] > 0) ?? null;
  }

  static keyOf(url) {
    const match = /\/projects\/([^/]+)\/repos\/([^/]+)\/pull-requests\/(\d+)/i.exec(url ?? '');
    return match ? `${match[1]}/${match[2]}/${match[3]}`.toLowerCase() : url;
  }
}

globalThis.StashRowFactory = StashRowFactory;
