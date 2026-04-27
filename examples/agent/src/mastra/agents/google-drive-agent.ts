import { Agent } from '@mastra/core/agent';
import { GoogleDriveFilesystem, Workspace } from '@mastra/core/workspace';

/**
 * Example agent backed by a Google Drive workspace.
 *
 * Required environment variables:
 * - GOOGLE_DRIVE_FOLDER_ID — ID of the folder that acts as the workspace root
 *
 * Auth options:
 * - Service account: Set GOOGLE_SERVICE_ACCOUNT_KEY and GOOGLE_SERVICE_ACCOUNT_EMAIL.
 *   Share the target folder with the service account email.
 * - OAuth access token: Set GOOGLE_DRIVE_ACCESS_TOKEN with the `drive` scope.
 *   When present, this takes priority over the service account variables.
 */
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID ?? 'replace-with-folder-id';
const accessToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
const serviceAccount = accessToken
  ? undefined
  : {
      privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY!,
      clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
    };

const workspace = new Workspace({
  filesystem: new GoogleDriveFilesystem({
    folderId,
    ...(accessToken ? { accessToken } : { serviceAccount }),
  }),
});

export const googleDriveAgent = new Agent({
  workspace,
  id: 'google-drive-agent',
  name: 'Google Drive Agent',
  description:
    'An assistant that reads and writes files inside a Google Drive folder. Handy for managing notes, drafts, and other plain-text assets stored in Drive.',
  instructions: {
    content: `
      You are an assistant with access to a single Google Drive folder through the workspace filesystem.
      Use POSIX-style paths (for example /notes/todo.txt) relative to the folder root.
      Prefer reading before overwriting files, and create directories with mkdir when needed.
    `,
    role: 'system',
  },
  model: 'openai/gpt-5.4',
});
