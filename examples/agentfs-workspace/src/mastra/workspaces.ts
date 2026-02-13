import { Workspace } from '@mastra/core/workspace';
import { AgentFSFilesystem } from '@mastra/agentfs';

/**
 * AgentFS workspace — files are stored in a Turso/SQLite database.
 *
 * Unlike LocalFilesystem (files on disk) or S3Filesystem (files in a bucket),
 * AgentFS stores everything in a SQLite database at `.agentfs/<agentId>.db`.
 * Files persist across sessions and survive process restarts.
 */
export const agentfsWorkspace = new Workspace({
  id: 'agentfs-workspace',
  name: 'AgentFS Workspace',
  filesystem: new AgentFSFilesystem({
    agentId: 'example-agent',
    displayName: 'Agent Storage',
  }),
});

/**
 * Read-only AgentFS workspace — blocks all write operations.
 */
export const readonlyWorkspace = new Workspace({
  id: 'readonly-agentfs-workspace',
  name: 'Readonly AgentFS Workspace',
  filesystem: new AgentFSFilesystem({
    agentId: 'example-agent',
    readOnly: true,
    displayName: 'Agent Storage (readonly)',
  }),
});
