import * as p from '@clack/prompts';
import editor from '@inquirer/editor';
import color from 'picocolors';
import type { VersionBumps } from '../types.js';

async function openEditor(template: string): Promise<string> {
  try {
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
  } catch (error) {
    throw new Error('Failed to open editor', { cause: error });
  }
}

function createChangesetTemplate(versionBumps: VersionBumps): string {
  const bumpLines = Object.entries(versionBumps)
    .map(([pkg, bump]) => `#   ${pkg}: ${bump}`)
    .join('\n');

  return `# Please enter your changeset message above this line.
# This message will be used to describe the changes in this release.
#
# Version bumps that will be applied:
${bumpLines}
#
# Lines starting with '#' will be ignored.
# An empty message aborts the changeset.
`;
}

export async function getChangesetMessage(
  versionBumps: VersionBumps,
  onCancel: (message?: string) => never,
): Promise<string> {
  const template = createChangesetTemplate(versionBumps);

  const shouldOpenEditor = await p.confirm({
    message: `Please provide a changeset message\n${color.dim('Press <enter> to launch your preferred editor.')}`,
    initialValue: true,
  });

  if (!shouldOpenEditor) {
    return onCancel('Cannot open editor. Aborting...');
  }

  try {
    const message = await openEditor(template);

    if (!message) {
      return onCancel('⚠️  No changeset message provided. Aborting...');
    }

    return message;
  } catch (error) {
    p.log.error('Error getting changeset message: ' + (error as Error)?.message);

    throw new Error('Error getting changeset message', { cause: error });
  }
}
