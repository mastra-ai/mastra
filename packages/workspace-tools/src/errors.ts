import { WorkspaceError } from '@mastra/core/workspace';

export class WorkspaceNotAvailableError extends WorkspaceError {
  constructor() {
    super('Workspace not available. Ensure the agent has a workspace configured.', 'NO_WORKSPACE');
    this.name = 'WorkspaceNotAvailableError';
  }
}
