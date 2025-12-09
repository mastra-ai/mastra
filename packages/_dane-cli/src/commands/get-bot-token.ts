import * as clack from '@clack/prompts';
import { createAppAuth } from '@octokit/auth-app';
import { defineCommand } from 'citty';

export async function getBotToken(privateKey: string): Promise<string> {
  const auth = createAppAuth({
    appId: '1148567',
    privateKey,
    installationId: '61225574',
  });

  const { token } = await auth({ type: 'installation' });

  return token;
}

export const getBotTokenCommand = defineCommand({
  meta: {
    name: 'get-bot-token',
    description: 'Get a GitHub App installation token',
  },
  async run() {
    clack.intro('Generate Dane Bot Token');

    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
    if (!privateKey) {
      clack.log.error('GITHUB_APP_PRIVATE_KEY environment variable is required');
      clack.outro('Failed to get token');
      process.exit(1);
    }

    const spinner = clack.spinner();
    spinner.start('Fetching installation token...');

    try {
      const token = await getBotToken(privateKey);
      spinner.stop('Token fetched successfully');
      clack.log.success(`Token: ${token}`);
      clack.outro('Done');
    } catch (error) {
      spinner.stop('Failed to fetch token');
      clack.log.error(error instanceof Error ? error.message : String(error));
      clack.outro('Failed to get token');
      process.exit(1);
    }
  },
});
