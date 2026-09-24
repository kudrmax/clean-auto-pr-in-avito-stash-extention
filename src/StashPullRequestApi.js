class StashPullRequestApi {
  static PAGE_LIMIT = 100;
  static MAX_PAGES = 20;
  static AVATAR_SIZE = 64;

  constructor(fetch) {
    this.fetch = fetch;
  }

  async fetchReviewing() {
    const pullRequests = [];
    let start = 0;
    for (let page = 0; page < StashPullRequestApi.MAX_PAGES; page++) {
      const body = await this.getJson(
        `/rest/api/latest/dashboard/pull-requests?state=OPEN&role=REVIEWER` +
        `&avatarSize=${StashPullRequestApi.AVATAR_SIZE}&limit=${StashPullRequestApi.PAGE_LIMIT}&start=${start}`
      );
      pullRequests.push(...(body.values ?? []).map(StashPullRequestApi.toModel));
      if (body.isLastPage !== false || body.nextPageStart == null) {
        break;
      }
      start = body.nextPageStart;
    }
    await Promise.all(pullRequests.map((pr) => this.attachBuilds(pr)));
    return pullRequests;
  }

  async attachBuilds(pr) {
    if (!pr.latestCommit) {
      return;
    }
    try {
      const stats = await this.getJson(`/rest/build-status/latest/commits/stats/${encodeURIComponent(pr.latestCommit)}`);
      pr.builds = {
        successful: stats.successful ?? 0,
        failed: stats.failed ?? 0,
        inProgress: stats.inProgress ?? 0,
      };
    } catch {
      pr.builds = null;
    }
  }

  async getJson(url) {
    const response = await this.fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!response.ok) {
      throw new Error(`Stash API ${url} responded ${response.status}`);
    }
    return response.json();
  }

  static toModel(json) {
    const repository = json.toRef?.repository ?? {};
    const projectKey = repository.project?.key ?? '';
    const repoSlug = repository.slug ?? '';
    return {
      id: json.id,
      title: json.title ?? '',
      url: json.links?.self?.[0]?.href ?? `/projects/${projectKey}/repos/${repoSlug}/pull-requests/${json.id}`,
      author: StashPullRequestApi.toUser(json.author?.user),
      projectKey,
      projectUrl: `/projects/${encodeURIComponent(projectKey)}`,
      repoName: repository.name ?? repoSlug,
      repoUrl: `/projects/${encodeURIComponent(projectKey)}/repos/${encodeURIComponent(repoSlug)}/browse`,
      branch: json.toRef?.displayId ?? '',
      commentCount: json.properties?.commentCount ?? 0,
      openTaskCount: json.properties?.openTaskCount ?? 0,
      reviewers: (json.reviewers ?? []).map((reviewer) => ({
        ...StashPullRequestApi.toUser(reviewer.user),
        status: reviewer.status ?? (reviewer.approved ? 'APPROVED' : 'UNAPPROVED'),
      })),
      latestCommit: json.fromRef?.latestCommit ?? null,
      builds: null,
    };
  }

  static toUser(user) {
    return {
      name: user?.displayName ?? user?.name ?? '',
      avatarUrl: user?.avatarUrl ?? '',
    };
  }
}

globalThis.StashPullRequestApi = StashPullRequestApi;
