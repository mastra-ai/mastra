export function getRepoName(githubUrl: string) {
  return githubUrl.replace(/\/$/, '').split('/').pop();
}
