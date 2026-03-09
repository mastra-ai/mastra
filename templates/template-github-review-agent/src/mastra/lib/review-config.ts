/**
 * Shared review configuration — file skip patterns and review depth thresholds.
 */

export const SKIP_PATTERNS = [
  /\.lock$/,
  /\.lockb$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /node_modules\//,
  /dist\//,
  /build\//,
  /\.min\.(js|css)$/,
  /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|mp4|webm|mp3)$/,
  /\.map$/,
  /\.generated\./,
  /__snapshots__\//,
];

export const SMALL_PR_MAX = 6;
export const MEDIUM_PR_MAX = 20;

export function getReviewDepth(fileCount: number): string {
  if (fileCount <= SMALL_PR_MAX) {
    return 'DETAILED — perform a thorough line-by-line review of every change.';
  }
  if (fileCount <= MEDIUM_PR_MAX) {
    return 'FOCUSED — focus on logic correctness and architectural decisions. Call out key issues but skip minor style nits.';
  }
  return 'HIGH-LEVEL — focus only on critical issues: bugs, security vulnerabilities, and major design concerns.';
}

export const REVIEW_DEPTH_INSTRUCTIONS = `- **Small PRs (1–${SMALL_PR_MAX} files):** Perform a detailed line-by-line review. Examine every change closely, comment on style, logic, naming, and edge cases.
- **Medium PRs (${SMALL_PR_MAX + 1}–${MEDIUM_PR_MAX} files):** Focus on logic correctness and architectural decisions. Call out key issues but don't nitpick every line.
- **Large PRs (${MEDIUM_PR_MAX + 1}+ files):** Provide a high-level architecture review. Focus only on critical issues — bugs, security vulnerabilities, and major design concerns.`;

export const MIN_DELETION_ONLY_LINES = 50;
