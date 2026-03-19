/**
 * Shared GitHub API utilities — fetch helper, response mappers, and file content fetcher.
 */

export async function githubFetch(path: string, accept = 'application/vnd.github.v3+json'): Promise<Response> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN environment variable is not set');

  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: accept,
      'User-Agent': 'mastra-pr-reviewer',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${body}`);
  }

  return response;
}

export function mapPRResponse(data: any) {
  return {
    title: data.title as string,
    body: (data.body as string) ?? null,
    state: data.state as string,
    author: (data.user?.login as string) ?? 'ghost',
    baseBranch: data.base.ref as string,
    headBranch: data.head.ref as string,
    headSha: data.head.sha as string,
    labels: ((data.labels ?? []) as Array<{ name: string }>).map(l => l.name),
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    additions: data.additions as number,
    deletions: data.deletions as number,
    changedFiles: data.changed_files as number,
  };
}

export function mapFilesResponse(data: any[]) {
  return data.map(f => ({
    filename: f.filename as string,
    status: f.status as string,
    additions: f.additions as number,
    deletions: f.deletions as number,
    changes: f.changes as number,
    ...(f.patch !== undefined ? { patch: f.patch as string } : {}),
  }));
}

/**
 * Fetch ALL files for a PR with automatic pagination (GitHub returns max 100 per page).
 */
export async function fetchAllPRFiles(owner: string, repo: string, pullNumber: number) {
  const allFiles: ReturnType<typeof mapFilesResponse> = [];
  let page = 1;

  while (true) {
    const response = await githubFetch(`/repos/${owner}/${repo}/pulls/${pullNumber}/files?per_page=100&page=${page}`);
    const data = (await response.json()) as Array<Record<string, unknown>>;
    if (data.length === 0) break;
    allFiles.push(...mapFilesResponse(data));
    if (data.length < 100) break;
    page++;
  }

  return allFiles;
}

export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<{ content: string; encoding: string; size: number } | null> {
  let response: Response;
  try {
    response = await githubFetch(`/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`);
  } catch (err) {
    if (err instanceof Error && err.message.includes('404')) return null;
    throw err;
  }

  const data = await response.json();

  if (data.type !== 'file' || !data.content) return null;

  const decoded = Buffer.from(data.content, 'base64').toString('utf-8');

  return {
    content: decoded,
    encoding: 'utf-8',
    size: data.size as number,
  };
}
