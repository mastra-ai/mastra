import { Octokit } from 'octokit';
import { MCPClient } from '@mastra/mcp';
import { MastraClient } from '@mastra/client-js';

const GITHUB_PERSONAL_ACCESS_TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
const OWNER = process.env.OWNER;
const REPO = process.env.REPO;
const ISSUE_NUMBER = process.env.ISSUE_NUMBER;
const MASTRA_BASE_URL = process.env.MASTRA_BASE_URL;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_TEAM_ID = process.env.SLACK_TEAM_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

const mappings = {
  abhiaiyer91: 'U06CK1L4Y94',
  mfrachet: 'U08HBDP3U1J',
  NikAiyer: 'U085YNHJM7Y',
  TheIsrael1: 'U06KH67LQC8',
  YujohnNattrass: 'U08C10D1ETH',
  wardpeet: 'U086EV0DN8H',
  'rase-': 'U088098FP88',
  DanielSLew: 'U08N8GGQKA6',
  PaulieScanlon: 'U08SDV7MY05',
  adeniyii: 'U06EFPQUZ1B',
  rphansen91: 'U071Q1HAHEW',
  adeleke5140: 'U06D49JDUL9',
  TylerBarnes: 'U085QSC8S2K',
};

async function main() {
  if (!GITHUB_PERSONAL_ACCESS_TOKEN || !OWNER || !REPO || !ISSUE_NUMBER) {
    console.error('Missing environment variables');
    process.exit(1);
  }

  if (!SLACK_BOT_TOKEN || !SLACK_TEAM_ID || !CHANNEL_ID) {
    console.error('Missing slack environment variables');
    process.exit(1);
  }

  const mcpClient = new MCPClient({
    servers: {
      slack: {
        command: 'npx',
        args: ['@modelcontextprotocol/server-slack'],
        env: {
          SLACK_BOT_TOKEN: SLACK_BOT_TOKEN,
          SLACK_TEAM_ID: SLACK_TEAM_ID,
          SLACK_CHANNEL_IDS: CHANNEL_ID,
        },
      },
    },
  });

  const tools = await mcpClient.getTools();

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
      required: ['assignee', 'reason', 'product_area', 'github_username'],
    },
  });

  if (!response.object || typeof response.object !== 'object') {
    throw new Error('Invalid response format from AI agent');
  }

  const result = response.object as { assignee: string; reason: string; product_area: string; github_username: string };

  // Label the issue
  await octokit.rest.issues.addLabels({
    owner: OWNER,
    repo: REPO,
    issue_number: Number(ISSUE_NUMBER),
    labels: [result.product_area, 'status: needs triage'],
  });

  const userName = result.github_username.startsWith('@') ? result.github_username.slice(1) : result.github_username;

  await octokit.rest.issues.addAssignees({
    owner: OWNER,
    repo: REPO,
    issue_number: Number(ISSUE_NUMBER),
    assignees: [userName],
  });

  console.log(`Assigned ${result.github_username} to issue #${ISSUE_NUMBER}`);

  await octokit.rest.issues.createComment({
    owner: OWNER,
    repo: REPO,
    issue_number: Number(ISSUE_NUMBER),
    body: `Thank you for reporting this issue! We have assigned it to @${userName} and will look into it as soon as possible.`,
  });

  console.log(`Commented on issue #${ISSUE_NUMBER}`);

  await tools['slack_slack_post_message'].execute({
    context: {
      channel_id: CHANNEL_ID,
      text: `
                New issue assigned to <@${mappings[userName]}>
                * Title: ${issue.data.title}
                * Link: https://github.com/${OWNER}/${REPO}/issues/${ISSUE_NUMBER}
            `,
    },
  });
}

main()
  .then(() => {
    console.log('Issue triaged successfully');
    process.exit(0);
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
