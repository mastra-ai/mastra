/**
 * AgentFS filesystem provider descriptor for MastraEditor.
 *
 * @example
 * ```typescript
 * import { agentfsFilesystemProvider } from '@mastra/agentfs';
 *
 * const editor = new MastraEditor({
 *   filesystems: [agentfsFilesystemProvider],
 * });
 * ```
 */
import type { FilesystemProvider } from '@mastra/core/editor';
import { AgentFSFilesystem } from './filesystem';
import type { AgentFSFilesystemOptions } from './filesystem';

export const agentfsFilesystemProvider: FilesystemProvider<AgentFSFilesystemOptions> = {
  id: 'agentfs',
  name: 'AgentFS',
  description: 'Turso/SQLite-backed filesystem via AgentFS',
  configSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'Agent ID — creates database at .agentfs/<agentId>.db' },
      path: { type: 'string', description: 'Explicit database file path (alternative to agentId)' },
      readOnly: { type: 'boolean', description: 'Mount as read-only', default: false },
    },
  },
  createFilesystem: config => new AgentFSFilesystem(config),
};
