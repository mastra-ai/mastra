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
      '/workspace': new LocalFilesystem({
        basePath: './workspace',
      }),
      '/.agents': new LocalFilesystem({
        basePath: './.agents',
      }),
    },
    sandbox: new E2BSandbox({
      id: 'developer-e2b-sandbox',
    }),
    // Test: relative ./workspace path with /workspace mount (colleague's repro case)
    skills: ['./workspace/api-design/SKILL.md'],
    tools: {
      [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: {
        enabled: true,
        requireApproval: true,
      },
    },
  }),
});
