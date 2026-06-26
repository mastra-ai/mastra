export const MASTRACODE_WEB_GIT_CLONE_CONTEXT_KEY = 'mastracode.web.gitClone';

export interface MastraCodeWebGitCloneContext {
  gitUrl: string;
  cloneParentPath?: string;
}

const SCP_LIKE_GIT_URL_RE = /^git@([^:\s]+):(.+)$/;

export function normalizeWebGitUrl(input: string): string {
  const gitUrl = input.trim();

  if (!gitUrl) {
    throw new Error('Git URL is required');
  }

  if (/\p{C}/u.test(gitUrl)) {
    throw new Error('Git URL contains invalid characters');
  }

  const scpLike = SCP_LIKE_GIT_URL_RE.exec(gitUrl);
  if (scpLike) {
    const [, host, repoPath] = scpLike;
    if (!host || !repoPath || repoPath.startsWith('/') || repoPath.includes('..')) {
      throw new Error('Invalid Git URL');
    }
    return gitUrl;
  }

  let parsed: URL;
  try {
    parsed = new URL(gitUrl);
  } catch {
    throw new Error('Enter an https://, http://, ssh://, or git@host:org/repo.git URL');
  }

  if (!['https:', 'http:', 'ssh:'].includes(parsed.protocol)) {
    throw new Error('Git URL must use https://, http://, ssh://, or git@host:org/repo.git');
  }

  if (!parsed.hostname || parsed.pathname === '/' || parsed.pathname.includes('..')) {
    throw new Error('Invalid Git URL');
  }

  return parsed.toString();
}

export function getWebGitRepoName(gitUrl: string): string {
  const normalizedGitUrl = normalizeWebGitUrl(gitUrl);
  const tail = normalizedGitUrl.split(/[/:]/).filter(Boolean).pop() ?? 'repository';
  return tail.replace(/\.git$/, '') || 'repository';
}

function shortHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function getWebGitCloneDirectoryName(gitUrl: string): string {
  const normalizedGitUrl = normalizeWebGitUrl(gitUrl);
  const repoName = getWebGitRepoName(normalizedGitUrl)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${repoName || 'repository'}-${shortHash(normalizedGitUrl)}`;
}
