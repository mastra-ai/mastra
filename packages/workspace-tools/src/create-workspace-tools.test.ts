import { describe, it, expect } from 'vitest';
import { WORKSPACE_TOOLS } from '@mastra/core/workspace';

import { createWorkspaceTools } from './create-workspace-tools';

describe('createWorkspaceTools', () => {
  it('should return all tools when no options provided', () => {
    const tools = createWorkspaceTools();

    expect(Object.keys(tools)).toHaveLength(10);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.DELETE);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.MKDIR);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.SEARCH.SEARCH);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.SEARCH.INDEX);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
  });

  it('should filter tools with include', () => {
    const tools = createWorkspaceTools({
      include: [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE, WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE],
    });

    expect(Object.keys(tools)).toHaveLength(2);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);
  });

  it('should filter tools with exclude', () => {
    const tools = createWorkspaceTools({
      exclude: [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND],
    });

    expect(Object.keys(tools)).toHaveLength(9);
    expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
  });

  it('should apply exclude after include', () => {
    const tools = createWorkspaceTools({
      include: [
        WORKSPACE_TOOLS.FILESYSTEM.READ_FILE,
        WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE,
        WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE,
      ],
      exclude: [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE],
    });

    expect(Object.keys(tools)).toHaveLength(2);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
    expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);
    expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE);
  });

  it('should return tools with execute functions', () => {
    const tools = createWorkspaceTools();

    for (const tool of Object.values(tools)) {
      expect(typeof tool.execute).toBe('function');
    }
  });
});
