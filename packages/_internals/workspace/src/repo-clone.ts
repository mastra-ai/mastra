/**
 * The one way a repository is cloned into a sandbox, shared by the repo
 * templates (which bake the clone into an image) and by Factory (which clones
 * at session start when no image provided one), so both produce the same
 * checkout: shallow, single branch, `origin` pointing at the plain URL.
 *
 * Credentials never enter the URL or `.git/config`. When `tokenEnv` is set,
 * the token is read from that environment variable at run time and sent as a
 * per-invocation `Authorization` header, so nothing persists in the checkout.
 */
export interface RepoCloneCommandOptions {
  /** Plain https clone URL, without credentials. */
  cloneUrl: string;
  /** Directory to clone into; relative paths resolve against the cwd. */
  destination: string;
  /** Branch to check out. Omit for the remote's default branch. */
  branch?: string;
  /** Name of the environment variable holding a GitHub installation token. */
  tokenEnv?: string;
}

export function repoCloneCommand({ cloneUrl, destination, branch, tokenEnv }: RepoCloneCommandOptions): string {
  const auth = tokenEnv ? `${gitAuthFlag(tokenEnv)} ` : '';
  const branchFlag = branch ? `--branch ${shellQuote(branch)} ` : '';
  return `git ${auth}clone --depth=1 --single-branch ${branchFlag}${shellQuote(cloneUrl)} ${shellQuote(destination)}`;
}

/** Per-invocation auth header; `-c` config never reaches `.git/config`. */
function gitAuthFlag(tokenEnv: string): string {
  return `-c http.extraheader="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$${tokenEnv}" | base64 -w0)"`;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
