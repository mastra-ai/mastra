import { Octokit } from 'octokit';
import { MastraClient } from '@mastra/client-js';

const GITHUB_PERSONAL_ACCESS_TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
const OWNER = process.env.OWNER;
const REPO = process.env.REPO;
const ISSUE_NUMBER = process.env.ISSUE_NUMBER;
const MASTRA_BASE_URL = process.env.MASTRA_BASE_URL;

async function main() {
  if (!GITHUB_PERSONAL_ACCESS_TOKEN || !OWNER || !REPO || !ISSUE_NUMBER) {
    console.error('Missing environment variables');
    process.exit(1);
  }

  const octokit = new Octokit({
    auth: GITHUB_PERSONAL_ACCESS_TOKEN,
  });

  const mastraClient = new MastraClient({
    baseUrl: MASTRA_BASE_URL || 'http://localhost:4111',
  });

  const agent = mastraClient.getAgent('triageAgent');
  // Context build

  const issue = await octokit.rest.issues.get({
    owner: OWNER,
    repo: REPO,
    issue_number: Number(ISSUE_NUMBER),
  });

  // Fetch the title and body of the issue
  const response = await agent.generate({
    messages: `
            Issue Title: ${issue.data.title}
            Issue Body: ${issue.data.body}
        `,
    output: {
      type: 'object',
      properties: {
        assignee: { type: 'string' },
        reason: { type: 'string' },
        product_area: { type: 'string' },
        github_username: { type: 'string' },
      },
    },
  });

  const result = response.object as { assignee: string; reason: string; product_area: string; github_username: string };

  // Label the issue
  await octokit.rest.issues.addLabels({
    owner: OWNER,
    repo: REPO,
    issue_number: Number(ISSUE_NUMBER),
    labels: [result.product_area],
  });

  await octokit.rest.issues.addAssignees({
    owner: OWNER,
    repo: REPO,
    issue_number: Number(ISSUE_NUMBER),
    assignees: [result.github_username],
  });

  console.log(`Assigned ${result.github_username} to issue #${ISSUE_NUMBER}`);

  await octokit.rest.issues.createComment({
    owner: OWNER,
    repo: REPO,
    issue_number: Number(ISSUE_NUMBER),
    body: `Thank you for reporting this issue! We have assigned it to @${result.github_username} and will look into it as soon as possible.`,
  });

  console.log(`Commented on issue #${ISSUE_NUMBER}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
