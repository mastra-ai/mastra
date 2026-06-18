import { appendFileSync } from 'node:fs';
import { Octokit } from 'octokit';

const OWNER = requireEnv('OWNER');
const REPO = requireEnv('REPO');
const GITHUB_TOKEN = requireEnv('GITHUB_TOKEN');
const PHASE = process.env.PHASE ?? 'label';
const PR_NUMBER = Number(process.env.PR_NUMBER ?? '0');

const TEST_LABELS = [
  { name: 'tests: green ✅', color: '0e8a16', description: 'Changed tests failed against base as expected' },
  { name: 'tests: failing ❌', color: 'b60205', description: 'Changed tests passed against base' },
  { name: 'tests: no tests added', color: 'cccccc', description: 'PR does not change test files' },
];

const octokit = new Octokit({ auth: GITHUB_TOKEN });

type PullFile = {
  filename: string;
  status: string;
};

async function main() {
  if (!Number.isInteger(PR_NUMBER) || PR_NUMBER < 1) {
    throw new Error('PR_NUMBER must be a positive integer');
  }

  if (PHASE !== 'label') {
    throw new Error(`Unknown PHASE "${PHASE}". Expected "label".`);
  }

  await label();
}

async function label() {
  const result = process.env.TEST_RESULT;
  if (!result) {
    throw new Error('TEST_RESULT is required in label phase');
  }

  await ensureTestLabels();

  const files = await listPullFiles();
  const testFiles = getChangedTestFiles(files);
  if (testFiles.length === 0) {
    await replaceTestLabel('tests: no tests added');
    setOutput('summary', buildNoTestsSummary());
    return;
  }

  if (result === 'skipped') {
    setOutput('summary', '## Changed test gate\n\nChanged Test Gate was skipped; leaving test labels unchanged.');
    return;
  }

  const failedAgainstBase = result === 'success';
  await replaceTestLabel(failedAgainstBase ? 'tests: green ✅' : 'tests: failing ❌');
  setOutput('summary', buildCompletedTestsSummary(failedAgainstBase));
}

async function listPullFiles(): Promise<PullFile[]> {
  return octokit.paginate(octokit.rest.pulls.listFiles, {
    owner: OWNER,
    repo: REPO,
    pull_number: PR_NUMBER,
    per_page: 100,
  });
}

function getChangedTestFiles(files: PullFile[]) {
  return files
    .filter(file => file.status !== 'removed')
    .map(file => file.filename)
    .filter(isTestFile)
    .sort();
}

function isTestFile(filename: string) {
  return (
    /(^|\/)(test|tests|__tests__)\//.test(filename) ||
    /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filename) ||
    /\.test-d\.ts$/.test(filename)
  );
}

function buildNoTestsSummary() {
  return `## Changed test gate

No changed test files were detected.

Applied label: \`tests: no tests added\``;
}

function buildCompletedTestsSummary(failedAgainstBase: boolean) {
  return `## Changed test gate

Changed test files ${failedAgainstBase ? 'failed against the base branch as expected' : 'passed against the base branch'}.

Applied label: \`${failedAgainstBase ? 'tests: green ✅' : 'tests: failing ❌'}\``;
}

async function ensureTestLabels() {
  await Promise.all(TEST_LABELS.map(label => ensureLabel(label.name, label.color, label.description)));
}

async function ensureLabel(name: string, color: string, description: string) {
  try {
    await octokit.rest.issues.createLabel({ owner: OWNER, repo: REPO, name, color, description });
    console.log(`Created label ${name}`);
  } catch (error) {
    if (isOctokitError(error, 422)) {
      await octokit.rest.issues.updateLabel({ owner: OWNER, repo: REPO, name, color, description });
      console.log(`Updated label ${name}`);
      return;
    }

    throw error;
  }
}

async function replaceTestLabel(nextLabel: string) {
  const { data: issue } = await octokit.rest.issues.get({ owner: OWNER, repo: REPO, issue_number: PR_NUMBER });
  const labels = issue.labels
    .map(label => (typeof label === 'string' ? label : label.name))
    .filter((name): name is string => Boolean(name));

  await Promise.all(
    labels.filter(label => label.startsWith('tests:') && label !== nextLabel).map(removeLabelIfPresent),
  );

  if (!labels.includes(nextLabel)) {
    await octokit.rest.issues.addLabels({ owner: OWNER, repo: REPO, issue_number: PR_NUMBER, labels: [nextLabel] });
  }
}

async function removeLabelIfPresent(label: string) {
  try {
    await octokit.rest.issues.removeLabel({ owner: OWNER, repo: REPO, issue_number: PR_NUMBER, name: label });
  } catch (error) {
    if (!isOctokitError(error, 404)) {
      throw error;
    }
  }
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
