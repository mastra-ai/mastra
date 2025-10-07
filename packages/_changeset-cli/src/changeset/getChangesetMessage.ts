import * as p from '@clack/prompts';
import editor from '@inquirer/editor';
import color from 'picocolors';

async function openEditor(template: string): Promise<string> {
  const response = await editor({
    message: '',
    default: template,
    postfix: '.md',
    waitForUseInput: false,
  });

  // Remove comment lines and trim
  const cleanedMessage = response
    .split('\n')
    .filter(line => !line.startsWith('#'))
    .join('\n')
    .trim();

  return cleanedMessage;
}

export type VersionBumps = Record<string, 'major' | 'minor' | 'patch'>;

export async function getChangesetMessage(
  versionBumps: VersionBumps,
  onCancel: (message?: string) => never,
): Promise<string> {
  // Create a template with the version bumps
  const template = `# Please enter your changeset message above this line.
# This message will be used to describe the changes in this release.
#
# Version bumps that will be applied:
${Object.entries(versionBumps)
  .map(([pkg, bump]) => `#   ${pkg}: ${bump}`)
  .join('\n')}
#
# Lines starting with '#' will be ignored.
# An empty message aborts the changeset.
`;

  const shouldWeOpenEditor = await p.confirm({
    message: `Please provide a changeset message\n${color.dim('Press <enter> to launch your preferred editor.')}`,
    initialValue: true,
  });

  if (!shouldWeOpenEditor) {
    return onCancel('Cannot open editor. Aborting...');
  }

  try {
    const message = await openEditor(template);

    if (!message) {
      return onCancel('⚠️  No changeset message provided. Aborting...');
    }

    return message;
  } catch (error: any) {
    if (error.name === 'ExitPromptError') {
      throw new Error('Changeset message editing cancelled by user');
    }

    p.log.error('Error getting changeset message: ' + error.message);
    throw error;
  }
}
