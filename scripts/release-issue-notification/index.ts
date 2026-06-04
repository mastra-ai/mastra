import { Octokit } from 'octokit';

const OWNER = requireEnv('OWNER');
const REPO = requireEnv('REPO');
const GITHUB_TOKEN = requireEnv('GITHUB_TOKEN');
const MODE = process.env.MODE ?? 'pending-release';
const PR_NUMBER = process.env.PR_NUMBER;

const PENDING_RELEASE_LABEL = 'pending-release';
const PENDING_RELEASE_LABEL_COLOR = 'ededed';
const PENDING_CLOSE_LABEL = 'status: pending-close';
const PENDING_CLOSE_LABEL_COLOR = 'ededed';
const COMMENT_MARKER = '<!-- mastra-release-notification -->';

const octokit = new Octokit({ auth: GITHUB_TOKEN });

type LinkedIssue = {
  number: number;
  title: string;
  url: string;
};

async function main() {
  if (MODE === 'pending-release') {
    if (!PR_NUMBER) {
      throw new Error('PR_NUMBER is required in pending-release mode');
    }
    await pendingRelease(Number(PR_NUMBER));
    return;
  }

  if (MODE === 'alpha-released') {
    await alphaReleased();
    return;
  }

  if (MODE === 'stable-released') {
    await stableReleased();
    return;
  }

  throw new Error(`Unknown MODE "${MODE}". Expected "pending-release", "alpha-released", or "stable-released".`);
}

async function pendingRelease(prNumber: number) {
  const linkedIssues = await getLinkedIssues(prNumber);

  if (linkedIssues.length === 0) {
    console.log(`PR #${prNumber} has no linked issues`);
    return;
  }

  console.log(`PR #${prNumber} links ${linkedIssues.length} issue(s)`);

  await ensurePendingReleaseLabel();

  for (const issue of linkedIssues) {
    await addLabel(issue.number, PENDING_RELEASE_LABEL);
    await upsertReleaseComment(
      issue.number,
      `This issue has been resolved in PR #${prNumber} and will be included in the next release.`,
    );
    console.log(`Added pending-release label and comment to issue #${issue.number}`);
  }
}

async function alphaReleased() {
  const issues = await listIssuesWithLabel(PENDING_RELEASE_LABEL, 'all');
  console.log(`Found ${issues.length} issue(s) with ${PENDING_RELEASE_LABEL} label`);

  for (const issue of issues) {
    await upsertReleaseComment(
      issue.number,
      `This issue has been resolved and is available in the **alpha** channel. Install with \`npm install <package>@alpha\`.`,
    );
    console.log(`Updated comment on issue #${issue.number} (alpha released)`);
  }
}

async function ensurePendingCloseLabel() {
  try {
    await octokit.rest.issues.createLabel({
      owner: OWNER,
      repo: REPO,
      name: PENDING_CLOSE_LABEL,
      color: PENDING_CLOSE_LABEL_COLOR,
      description: 'Issue is fixed in stable but still open — needs manual review/close',
    });
    console.log(`Created label ${PENDING_CLOSE_LABEL}`);
  } catch (error) {
    if (isOctokitError(error, 422)) {
      await octokit.rest.issues.updateLabel({
        owner: OWNER,
        repo: REPO,
        name: PENDING_CLOSE_LABEL,
        color: PENDING_CLOSE_LABEL_COLOR,
        description: 'Issue is fixed in stable but still open — needs manual review/close',
      });
      console.log(`Updated label ${PENDING_CLOSE_LABEL}`);
      return;
    }

    throw error;
  }
}

type PublishedVersion = {
  name: string;
  version: string;
  path: string;
};

async function stableReleased() {
  const issues = await listIssuesWithLabel(PENDING_RELEASE_LABEL, 'all');
  console.log(`Found ${issues.length} issue(s) with ${PENDING_RELEASE_LABEL} label`);

  await ensurePendingCloseLabel();

  const publishedVersions = parsePublishedVersions();

  for (const issue of issues) {
    const versions = await getVersionsForIssue(issue.number, publishedVersions);

    let message = `This issue has been resolved and is available in the **latest stable** release.`;
    if (versions.length > 0) {
      message += `\n\n**Published packages:**\n`;
      message += versions.map(v => `- \`${v.name}@${v.version}\``).join('\n');
    }

    await upsertReleaseComment(issue.number, message);
    await removeLabelIfPresent(issue.number, PENDING_RELEASE_LABEL);

    // If the issue is still open, add pending-close label for manual triage
    if (issue.state === 'open') {
      await addLabel(issue.number, PENDING_CLOSE_LABEL);
      console.log(`Updated comment, removed pending-release, added pending-close on open issue #${issue.number}`);
    } else {
      console.log(`Updated comment and removed pending-release label from closed issue #${issue.number}`);
    }
  }
}

function parsePublishedVersions(): PublishedVersion[] {
  const raw = process.env.PUBLISHED_VERSIONS;
  if (!raw) {
    console.log('PUBLISHED_VERSIONS not set, skipping version detection');
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as PublishedVersion[];
    if (!Array.isArray(parsed)) {
      console.log('PUBLISHED_VERSIONS is not an array, skipping');
      return [];
    }
    return parsed.filter(v => v.name && v.version);
  } catch (e) {
    console.log('Failed to parse PUBLISHED_VERSIONS, skipping version detection');
    return [];
  }
}

async function getVersionsForIssue(
  issueNumber: number,
  publishedVersions: PublishedVersion[],
): Promise<PublishedVersion[]> {
  if (publishedVersions.length === 0) return [];

  const prs = await getClosingPRsForIssue(issueNumber);
  if (prs.length === 0) return [];

  const changedPaths = new Set<string>();
  for (const prNumber of prs) {
    const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
      owner: OWNER,
      repo: REPO,
      pull_number: prNumber,
      per_page: 100,
    });
    for (const file of Array.from(files as Array<{ filename?: string }>)) {
      if (file.filename) {
        changedPaths.add(file.filename);
      }
    }
  }

  if (changedPaths.size === 0) return [];

  // Normalize published package paths to relative paths for matching
  const workspaceRoot = process.env.GITHUB_WORKSPACE ?? '';
  const normalizedPackages = publishedVersions.map(pv => {
    let relativePath = pv.path;
    if (workspaceRoot && relativePath.startsWith(workspaceRoot)) {
      relativePath = relativePath.slice(workspaceRoot.length).replace(/^\/+/, '');
    }
    return { ...pv, relativePath };
  });

  const matched = new Map<string, PublishedVersion>();
  for (const file of Array.from(changedPaths)) {
    for (const pkg of normalizedPackages) {
      // Match if the changed file is inside the package directory
      // e.g. packages/core/src/foo.ts matches package at packages/core
      const pkgDir = pkg.relativePath.replace(/\/+$/, '');
      if (file === pkgDir || file.startsWith(pkgDir + '/')) {
        matched.set(pkg.name, { name: pkg.name, version: pkg.version, path: pkg.path });
      }
    }
  }

  return Array.from(matched.values());
}

async function getClosingPRsForIssue(issueNumber: number): Promise<number[]> {
  const result = await octokit.graphql<{
    repository: {
      issue: {
        timelineItems: {
          nodes: Array<{
            source: {
              __typename: string;
              number: number;
            } | null;
          }>;
        };
      } | null;
    } | null;
  }>(
    `query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          timelineItems(first: 100, itemTypes: [CLOSED_EVENT, CROSS_REFERENCED_EVENT]) {
            nodes {
              ... on ClosedEvent {
                closer {
                  __typename
                  ... on PullRequest {
                    number
                  }
                }
              }
              ... on CrossReferencedEvent {
                source {
                  __typename
                  ... on PullRequest {
                    number
                  }
                }
              }
            }
          }
        }
      }
    }`,
    { owner: OWNER, repo: REPO, number: issueNumber },
  );

  const prs = new Set<number>();
  const nodes = result.repository?.issue?.timelineItems.nodes ?? [];
  for (const node of nodes) {
    if (node.source && node.source.__typename === 'PullRequest') {
      prs.add(node.source.number);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const closer = (node as any).closer;
    if (closer && closer.__typename === 'PullRequest') {
      prs.add(closer.number as number);
    }
  }
  return Array.from(prs);
}

async function getLinkedIssues(prNumber: number): Promise<LinkedIssue[]> {
  const result = await octokit.graphql<{
    repository: {
      pullRequest: {
        closingIssuesReferences: {
          nodes: LinkedIssue[];
        };
      } | null;
    } | null;
  }>(
    `query($owner: String!, $repo: String!, $prNumber: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $prNumber) {
          closingIssuesReferences(first: 10) {
            nodes { number title url }
          }
        }
      }
    }`,
    { owner: OWNER, repo: REPO, prNumber },
  );

  return result.repository?.pullRequest?.closingIssuesReferences.nodes ?? [];
}

async function listIssuesWithLabel(label: string, state: 'open' | 'closed' | 'all') {
  return octokit.paginate(octokit.rest.issues.listForRepo, {
    owner: OWNER,
    repo: REPO,
    state,
    labels: label,
    per_page: 100,
  });
}

async function upsertReleaseComment(issueNumber: number, message: string) {
  const comments = await listIssueComments(issueNumber);
  const existing = comments.find(comment => comment.body?.includes(COMMENT_MARKER));
  const body = `${COMMENT_MARKER}\n${message}`;

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner: OWNER,
      repo: REPO,
      comment_id: existing.id,
      body,
    });
    console.log(`Updated release notification comment on issue #${issueNumber}`);
    return;
  }

  await octokit.rest.issues.createComment({
    owner: OWNER,
    repo: REPO,
    issue_number: issueNumber,
    body,
  });
  console.log(`Created release notification comment on issue #${issueNumber}`);
}

async function listIssueComments(issueNumber: number) {
  return octokit.paginate(octokit.rest.issues.listComments, {
    owner: OWNER,
    repo: REPO,
    issue_number: issueNumber,
    per_page: 100,
  });
}

async function ensurePendingReleaseLabel() {
  try {
    await octokit.rest.issues.createLabel({
      owner: OWNER,
      repo: REPO,
      name: PENDING_RELEASE_LABEL,
      color: PENDING_RELEASE_LABEL_COLOR,
      description: 'Issue is fixed but not yet released',
    });
    console.log(`Created label ${PENDING_RELEASE_LABEL}`);
  } catch (error) {
    if (isOctokitError(error, 422)) {
      await octokit.rest.issues.updateLabel({
        owner: OWNER,
        repo: REPO,
        name: PENDING_RELEASE_LABEL,
        color: PENDING_RELEASE_LABEL_COLOR,
        description: 'Issue is fixed but not yet released',
      });
      console.log(`Updated label ${PENDING_RELEASE_LABEL}`);
      return;
    }

    throw error;
  }
}

async function addLabel(issueNumber: number, label: string) {
  await octokit.rest.issues.addLabels({
    owner: OWNER,
    repo: REPO,
    issue_number: issueNumber,
    labels: [label],
  });
}

async function removeLabelIfPresent(issueNumber: number, label: string) {
  try {
    await octokit.rest.issues.removeLabel({
      owner: OWNER,
      repo: REPO,
      issue_number: issueNumber,
      name: label,
    });
    console.log(`Removed label ${label} from #${issueNumber}`);
  } catch (error) {
    if (isOctokitError(error, 404)) {
      return;
    }

    throw error;
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function isOctokitError(error: unknown, status: number) {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === status;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
