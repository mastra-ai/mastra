import { LocalFilesystem, Workspace } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { E2BSandbox } from '@mastra/e2b';
import { S3Filesystem } from '@mastra/s3';

export const cloudWorkspace = new Workspace({
  id: 'cloud-workspace',
  name: 'Cloud Workspace',
  sandbox: new E2BSandbox({
    id: 'yay-testing-123',
    timeout: 30_000, // 30 seconds
  }),
  // ?? sandbox logs?
  mounts: {
    '/local': new LocalFilesystem({ basePath: '/Users/caleb/mastra/examples/unified-workspace/agent-files' }),
    '/data': new S3Filesystem({
      displayName: 'Cloudflare R2',
      bucket: process.env.S3_BUCKET!,
      region: process.env.S3_REGION ?? 'us-east-1',
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      endpoint: process.env.S3_ENDPOINT,
    }),
  },
  // TODO: better error messages (not just exit code) for execute_code and execute_command tools

  skillsPaths: ['/local/skills', '/data/skills'],
  bm25: true,
  autoInit: true,
  safety: {
    requireReadBeforeWrite: false,
    requireSandboxApproval: 'none',
  },
});

/**
 * E2B Agent - uses E2B cloud sandbox for code execution.
 *
 * Requires E2B_API_KEY environment variable.
 */
export const e2bAgent = new Agent({
  id: 'e2b-agent',
  name: 'E2B Agent',
  description: 'An agent that executes code in E2B cloud sandboxes.',
  instructions: `You are a helpful coding assistant with access to an E2B cloud sandbox.

You can:
- Execute Python and Node.js code in an isolated cloud environment
- Run shell commands
- Read and write files

When asked to run code, use the workspace_execute_code tool.
Always show the output to the user.`,
  model: 'openai/gpt-5.1',
  workspace: cloudWorkspace,
});
