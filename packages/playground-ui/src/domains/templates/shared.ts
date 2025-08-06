export function getRepoName(githubUrl: string) {
  return githubUrl.split('/').pop();
}
