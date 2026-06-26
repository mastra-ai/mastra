import { appendFileSync } from 'node:fs';
import { Octokit } from 'octokit';

const OWNER = requireEnv('OWNER');
const REPO = requireEnv('REPO');
const GITHUB_TOKEN = requireEnv('GITHUB_TOKEN');
const MODE = process.env.MODE ?? 'nudge';
const PR_NUMBER = process.env.PR_NUMBER;
const STALE_DAYS = Number(process.env.STALE_DAYS ?? '14');

const NEEDS_ISSUE_LABEL = 'needs-issue';
const NEEDS_ISSUE_LABEL_COLOR = 'e4e669';
const ISSUE_LINK_EXCLUDED_LOGINS = new Set([
  'dane-ai-mastra',
  'dane-ai-mastra[bot]',
  'devin-ai-integration',
  'devin-ai-integration[bot]',
]);

const octokit = new Octokit({ auth: GITHUB_TOKEN });
const coreContributorCache = new Map<string, Promise<boolean>>();

type PullRequest = {
  number: number;
  user?: { login?: string } | null;
  created_at: string;
  html_url: string;
};

type LinkedIssue = {
  number: number;
  title: string;
  url: string;
};

async function main() {
  if (!Number.isFinite(STALE_DAYS) || STALE_DAYS < 1) {
    throw new Error('STALE_DAYS must be a positive number');
  }

  if (MODE === 'nudge') {
    if (!PR_NUMBER) {
      throw new Error('PR_NUMBER is required in nudge mode');
    }

    await nudge(Number(PR_NUMBER));
    return;
  }

  if (MODE === 'close-stale') {
    await closeStale();
    return;
  }

  throw new Error(`Unknown MODE "${MODE}". Expected "nudge" or "close-stale".`);
}

async function nudge(prNumber: number) {
  const { data: pr } = await octokit.rest.pulls.get({ owner: OWNER, repo: REPO, pull_number: prNumber });
  const author = pr.user?.login;

  if (isIssueLinkExcluded(author)) {
    console.log(`Skipping #${prNumber}: ${author} is excluded from linked issue enforcement`);
    await removeLabelIfPresent(prNumber, NEEDS_ISSUE_LABEL);
    setOutput('needs_issue', 'false');
    setOutput('summary', buildIssueLinkExcludedSummary(author));
    return;
  }

  if (await isCoreContributor(author)) {
    console.log(`Skipping #${prNumber}: ${author} is a core contributor`);
    await removeLabelIfPresent(prNumber, NEEDS_ISSUE_LABEL);
    setOutput('needs_issue', 'false');
    setOutput('summary', buildCoreContributorSummary(author));
    return;
  }

  const linkedIssues = await getLinkedIssues(prNumber);

  if (linkedIssues.length > 0) {
    console.log(`PR #${prNumber} links ${linkedIssues.length} issue(s)`);
    await removeLabelIfPresent(prNumber, NEEDS_ISSUE_LABEL);
    setOutput('needs_issue', 'false');
    setOutput('summary', buildLinkedIssueSummary(linkedIssues));
    return;
  }

  console.log(`PR #${prNumber} has no linked issue`);
  await ensureNeedsIssueLabel();
  await addLabel(prNumber, NEEDS_ISSUE_LABEL);
  setOutput('needs_issue', 'true');
  setOutput('summary', buildNeedsIssueSummary(STALE_DAYS));
}

async function closeStale() {
  await ensureNeedsIssueLabel();

  const prs = await listOpenPrsWithLabel(NEEDS_ISSUE_LABEL);
  console.log(`Found ${prs.length} open PR(s) with ${NEEDS_ISSUE_LABEL}`);

  const now = Date.now();
  const staleMs = STALE_DAYS * 24 * 60 * 60 * 1000;

  for (const pr of prs) {
    const author = pr.user?.login;

    if (isIssueLinkExcluded(author)) {
      console.log(`Skipping #${pr.number}: ${author} is excluded from linked issue enforcement`);
      await removeLabelIfPresent(pr.number, NEEDS_ISSUE_LABEL);
      continue;
    }

    if (await isCoreContributor(author)) {
      console.log(`Skipping #${pr.number}: ${author} is a core contributor`);
      await removeLabelIfPresent(pr.number, NEEDS_ISSUE_LABEL);
      continue;
    }

    const linkedIssues = await getLinkedIssues(pr.number);
    if (linkedIssues.length > 0) {
      console.log(`Skipping #${pr.number}: now links ${linkedIssues.length} issue(s)`);
      await removeLabelIfPresent(pr.number, NEEDS_ISSUE_LABEL);
      continue;
    }

    const labelAppliedAt = await getLatestLabelAppliedAt(pr.number, NEEDS_ISSUE_LABEL);
    if (!labelAppliedAt) {
      console.log(`Skipping #${pr.number}: could not find when ${NEEDS_ISSUE_LABEL} was applied`);
      continue;
    }

    const labelAgeMs = now - labelAppliedAt.getTime();
    if (labelAgeMs < staleMs) {
      const labelAgeDays = Math.floor(labelAgeMs / (24 * 60 * 60 * 1000));
      console.log(
        `Skipping #${pr.number}: ${NEEDS_ISSUE_LABEL} applied ${labelAgeDays} day(s) ago, threshold is ${STALE_DAYS}`,
      );
      continue;
    }

    console.log(`Closing #${pr.number}: ${NEEDS_ISSUE_LABEL} is stale and PR still has no linked issue`);
    await octokit.rest.issues.createComment({
      owner: OWNER,
      repo: REPO,
      issue_number: pr.number,
      body: `Closing this PR because it has had the ${NEEDS_ISSUE_LABEL} label for at least ${STALE_DAYS} days without a linked issue. Please open or link an issue first, then reopen this PR when it is ready.`,
    });
    await octokit.rest.pulls.update({ owner: OWNER, repo: REPO, pull_number: pr.number, state: 'closed' });
  }
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

async function listOpenPrsWithLabel(label: string): Promise<PullRequest[]> {
  const issues = await octokit.paginate(octokit.rest.issues.listForRepo, {
    owner: OWNER,
    repo: REPO,
    state: 'open',
    labels: label,
    per_page: 100,
  });

  return issues.filter(issue => Boolean(issue.pull_request)) as PullRequest[];
}

async function getLatestLabelAppliedAt(issueNumber: number, label: string) {
  const events = await octokit.paginate(octokit.rest.issues.listEventsForTimeline, {
    owner: OWNER,
    repo: REPO,
    issue_number: issueNumber,
    per_page: 100,
  });

  let latestLabelAppliedAt: Date | null = null;

  for (const event of events) {
    if (
      event.event === 'labeled' &&
      'label' in event &&
      event.label?.name === label &&
      'created_at' in event &&
      typeof event.created_at === 'string'
    ) {
      latestLabelAppliedAt = new Date(event.created_at);
    }
  }

  return latestLabelAppliedAt;
}

async function ensureNeedsIssueLabel() {
  try {
    await octokit.rest.issues.createLabel({
      owner: OWNER,
      repo: REPO,
      name: NEEDS_ISSUE_LABEL,
      color: NEEDS_ISSUE_LABEL_COLOR,
      description: 'PR is missing a linked issue',
    });
    console.log(`Created label ${NEEDS_ISSUE_LABEL}`);
  } catch (error) {
    if (isOctokitError(error, 422)) {
      await octokit.rest.issues.updateLabel({
        owner: OWNER,
        repo: REPO,
        name: NEEDS_ISSUE_LABEL,
        color: NEEDS_ISSUE_LABEL_COLOR,
        description: 'PR is missing a linked issue',
      });
      console.log(`Updated label ${NEEDS_ISSUE_LABEL}`);
      return;
    }

    throw error;
  }
}

async function addLabel(issueNumber: number, label: string) {
  await octokit.rest.issues.addLabels({ owner: OWNER, repo: REPO, issue_number: issueNumber, labels: [label] });
}

async function removeLabelIfPresent(issueNumber: number, label: string) {
  try {
    await octokit.rest.issues.removeLabel({ owner: OWNER, repo: REPO, issue_number: issueNumber, name: label });
    console.log(`Removed label ${label} from #${issueNumber}`);
  } catch (error) {
    if (isOctokitError(error, 404)) {
      return;
    }

    throw error;
  }
}

function buildNeedsIssueSummary(staleDays: number) {
  return `## PR triage

This PR needs to fix an existing issue. Please link an issue in the PR description, for example with \`Fixes #1234\` or \`Closes #1234\`.

Applied label: \`${NEEDS_ISSUE_LABEL}\`

PRs without a linked issue will automatically close after ${staleDays} day(s) with the label.`;
}

function buildLinkedIssueSummary(linkedIssues: LinkedIssue[]) {
  const issueLinks = linkedIssues.map(issue => `#${issue.number}`).join(', ');

  return `## PR triage

Linked issue check passed (${issueLinks}).

Mastra uses CodeRabbit for automated code reviews. Please address all feedback from CodeRabbit by either making changes to your PR or leaving a comment explaining why you disagree with the feedback. Since CodeRabbit is an AI, it may occasionally provide incorrect feedback.`;
}

function buildCoreContributorSummary(author: string | undefined) {
  return `## PR triage

Linked issue check skipped${author ? ` for core contributor @${author}` : ''}.`;
}

function buildIssueLinkExcludedSummary(author: string | undefined) {
  return `## PR triage

Linked issue check skipped${author ? ` for excluded profile @${author}` : ''}.`;
}

function setOutput(name: string, value: string) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    console.log(`${name}=${value}`);
    return;
  }

  if (value.includes('\n')) {
    const delimiter = `EOF_${name}_${Date.now()}`;
    appendFileSync(outputPath, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
    return;
  }

  appendFileSync(outputPath, `${name}=${value}\n`);
}

function isIssueLinkExcluded(login: string | undefined) {
  return login ? ISSUE_LINK_EXCLUDED_LOGINS.has(login.toLowerCase()) : false;
}

async function isCoreContributor(login: string | undefined) {
  if (!login) {
    return false;
  }

  const normalizedLogin = login.toLowerCase();
  let membershipCheck = coreContributorCache.get(normalizedLogin);

  if (!membershipCheck) {
    membershipCheck = checkOrgMembership(login);
    coreContributorCache.set(normalizedLogin, membershipCheck);
  }

  return membershipCheck;
}

async function checkOrgMembership(username: string) {
  try {
    await octokit.rest.orgs.checkMembershipForUser({ org: OWNER, username });
    return true;
  } catch (error) {
    if (isOctokitError(error, 404)) {
      return false;
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
