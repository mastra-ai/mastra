import { Agent } from '@mastra/core/agent';
import { fastembed } from '@mastra/fastembed';
import { LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { LocalFilesystem, Workspace, WORKSPACE_TOOLS } from '@mastra/core/workspace';
import { E2BSandbox } from '@mastra/e2b';
import { GCSFilesystem } from '@mastra/gcs';
import { S3Filesystem } from '@mastra/s3';

/**
 * Developer agent - inherits globalWorkspace from Mastra instance.
 *
 * Workspace: Inherits from Mastra (no agent-specific workspace)
 * Safety: None
 */
export const developerAgent = new Agent({
  id: 'developer-agent',
  name: 'Developer Agent',
  description: 'An agent that helps with code reviews and API design.',
  instructions: `You are a helpful developer assistant.`,
  model: 'anthropic/claude-opus-4-5',
  memory: new Memory({
    vector: new LibSQLVector({
      id: 'developer-agent-vector',
      url: 'file:./mastra.db',
    }),
    embedder: fastembed,
    options: {
      lastMessages: 10,
      semanticRecall: {
        topK: 5,
        messageRange: 2,
        scope: 'thread', // Search within the current thread only
      },
    },
  }),

  workspace: new Workspace({
    name: 'Cloud Workspace',
    id: 'cloud-workspace',
    mounts: {
      '/local': new LocalFilesystem({
        basePath: './workspace',
      }),
      '/.agents': new LocalFilesystem({
        basePath: './.agents',
      }),
      // S3 mount — only if S3_BUCKET is configured
      ...(process.env.S3_BUCKET && {
        '/r2': new S3Filesystem({
          bucket: process.env.S3_BUCKET,
          region: 'auto',
          accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
          endpoint: process.env.S3_ENDPOINT as string,
        }),
      }),
      // GCS mount — only if GCS_BUCKET is configured
      ...(process.env.GCS_BUCKET && {
        '/gcs': new GCSFilesystem({
          bucket: process.env.GCS_BUCKET,
          credentials: process.env.GCS_SERVICE_ACCOUNT_KEY
            ? JSON.parse(process.env.GCS_SERVICE_ACCOUNT_KEY)
            : undefined,
        }),
      }),
    },
    sandbox: new E2BSandbox({
      id: 'developer-e2b-sandbox',
    }),
    skills: ['/.agents/skills', '/local/skills', '/r2/skills'],
    tools: {
      [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: {
        enabled: true,
        requireApproval: true,
      },
    },
  }),
});
