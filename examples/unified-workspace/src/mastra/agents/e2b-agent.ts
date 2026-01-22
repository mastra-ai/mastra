import { Workspace } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { E2BSandbox } from '@mastra/e2b';
import { S3Filesystem } from '@mastra/s3';

/**
 * E2B Cloud Sandbox workspace with S3 filesystem mounting.
 *
 * Required environment variables:
 * - E2B_API_KEY: E2B API key for cloud sandbox
 * - S3_BUCKET: S3 bucket name (or R2 bucket)
 * - S3_REGION: AWS region (use 'auto' for Cloudflare R2)
 * - S3_ACCESS_KEY_ID: AWS/R2 access key ID
 * - S3_SECRET_ACCESS_KEY: AWS/R2 secret access key
 * - S3_ENDPOINT: (optional) Custom endpoint for R2/MinIO
 *
 * This workspace uses:
 * - S3Filesystem for file storage (cloud storage)
 * - E2BSandbox for code execution (cloud sandbox)
 *
 * Mounting behavior:
 * - `mounts` specifies which filesystems to mount and where
 * - S3 is mountable into E2B via s3fs-fuse, providing a unified view
 * - Code running in the sandbox can access S3 files at /workspace
 * - The first mount becomes the primary filesystem for workspace operations
 */

export const e2bWorkspace = new Workspace({
  id: 'e2b-workspace',
  name: 'E2B Cloud Workspace',
  sandbox: new E2BSandbox({
    timeout: 120000, // 2 minutes
  }),
  mounts: {
    '/home/user/s3': new S3Filesystem({
      bucket: process.env.S3_BUCKET!,
      region: process.env.S3_REGION ?? 'us-east-1',
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      endpoint: process.env.S3_ENDPOINT,
    }),
  },
  bm25: true,
  autoInit: true,
  safety: {
    requireReadBeforeWrite: false,
    requireSandboxApproval: 'none',
  },
  skillsPaths: ['/home/user/s3/skills'],
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
  workspace: e2bWorkspace,
});
