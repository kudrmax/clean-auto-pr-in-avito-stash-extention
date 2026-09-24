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
        `/rest/ui/latest/dashboard/pull-requests?state=OPEN&role=REVIEWER&order=participant_status&order=draft_status` +
        `&avatarSize=${StashPullRequestApi.AVATAR_SIZE}&limit=${StashPullRequestApi.PAGE_LIMIT}&start=${start}`
      );
      pullRequests.push(...(body.values ?? []).map((item) =>
        StashPullRequestApi.toModel(item.pullRequest ?? item, item.buildSummaries)
      ));
      if (body.isLastPage !== false || body.nextPageStart == null) {
        break;
      }
      start = body.nextPageStart;
    }
    await Promise.all(pullRequests.filter((pr) => pr.builds === undefined).map((pr) => this.attachBuilds(pr)));
    return pullRequests;
  }

  async attachBuilds(pr) {
    if (!pr.latestCommit) {
      return;
    }
    try {
      const stats = await this.getJson(`/rest/build-status/latest/commits/stats/${encodeURIComponent(pr.latestCommit)}`);
      pr.builds = StashPullRequestApi.toBuilds(stats);
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

  static toModel(json, buildSummaries) {
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
      repoSlug,
      repoName: repository.name ?? repoSlug,
      repoUrl: `/projects/${encodeURIComponent(projectKey)}/repos/${encodeURIComponent(repoSlug)}/browse`,
      branch: json.toRef?.displayId ?? '',
      commentCount: json.properties?.commentCount ?? 0,
      openTaskCount: json.properties?.openTaskCount ?? 0,
      reviewers: (json.reviewers ?? []).map((reviewer) => ({
        ...StashPullRequestApi.toUser(reviewer.user),
        status: reviewer.status ?? (reviewer.approved ? 'APPROVED' : 'UNAPPROVED'),
        lastReviewedCommit: reviewer.lastReviewedCommit ?? null,
      })),
      latestCommit: json.fromRef?.latestCommit ?? null,
      builds: buildSummaries === undefined ? undefined : StashPullRequestApi.toBuilds(buildSummaries),
    };
  }

  static toBuilds(summary) {
    if (!summary) {
      return null;
    }
    return {
      successful: summary.successful ?? 0,
      failed: summary.failed ?? 0,
      inProgress: summary.inProgress ?? 0,
      cancelled: summary.cancelled ?? 0,
      unknown: summary.unknown ?? 0,
    };
  }

  static toUser(user) {
    return {
      username: user?.name ?? user?.slug ?? '',
      name: user?.displayName ?? user?.name ?? '',
      avatarUrl: user?.avatarUrl ?? '',
    };
  }
}

globalThis.StashPullRequestApi = StashPullRequestApi;
