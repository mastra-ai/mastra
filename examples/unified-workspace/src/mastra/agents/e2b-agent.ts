import { LocalFilesystem, Workspace } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { E2BSandbox } from '@mastra/e2b';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { S3Filesystem } from '@mastra/s3';

export const cloudWorkspace = new Workspace({
  id: 'cloud-workspace',
  name: 'Cloud Workspace',
  sandbox: new E2BSandbox({
    id: 'yay-testing-1234',
  }),
  mounts: {
    '/local': new LocalFilesystem({ basePath: '/Users/caleb/mastra/examples/unified-workspace/agent-files' }),
    '/bucket-1': new S3Filesystem({
      displayName: 'Cloudflare R2',
      bucket: 'agent-test-bucket',
      description: 'agent-test-bucket',
      region: process.env.S3_REGION ?? 'auto',
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      endpoint: process.env.S3_ENDPOINT,
    }),
    '/bucket-2': new S3Filesystem({
      displayName: 'Cloudflare R2',
      bucket: 'agent-test-bucket-2',
      description: 'agent-test-bucket-2',
      region: process.env.S3_REGION ?? 'auto',
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      endpoint: process.env.S3_ENDPOINT,
    }),
  },
  skillsPaths: ['/local/skills', '/bucket-1/skills', '/bucket-2/skills'],
  bm25: true,
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
  instructions: `You are a helpful coding assistant with access to an E2B cloud sandbox.`,
  model: 'anthropic/claude-opus-4-5',
  memory: new Memory({
    storage: new LibSQLStore({
      id: 'e2b-agent-memory-storage',
      url: 'file:./e2b-agent.db',
    }),
  }),
  workspace: cloudWorkspace,
});
