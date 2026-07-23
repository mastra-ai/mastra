import { WORKSPACE_TOOLS } from '@mastra/core/workspace';
import { describe, expect, it } from 'vitest';
import { MASTRACODE_WORKSPACE_TOOLS } from '../tool-availability.js';

const BACKGROUND_ELIGIBLE_WORKSPACE_TOOLS = [
  WORKSPACE_TOOLS.FILESYSTEM.READ_FILE,
  WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES,
  WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT,
  WORKSPACE_TOOLS.FILESYSTEM.GREP,
  WORKSPACE_TOOLS.LSP.LSP_INSPECT,
] as const;

const FOREGROUND_ONLY_WORKSPACE_TOOLS = [
  WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE,
  WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE,
  WORKSPACE_TOOLS.FILESYSTEM.DELETE,
  WORKSPACE_TOOLS.FILESYSTEM.MKDIR,
  WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT,
  WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND,
  WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT,
  WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS,
] as const;

describe('MastraCode workspace tool background policy', () => {
  it('allows native background execution only for side-effect-free workspace reads', () => {
    for (const toolName of BACKGROUND_ELIGIBLE_WORKSPACE_TOOLS) {
      expect(MASTRACODE_WORKSPACE_TOOLS[toolName]?.background).toEqual({ enabled: true });
    }
  });

  it('keeps mutating, process, and stateful workspace tools foreground-only', () => {
    for (const toolName of FOREGROUND_ONLY_WORKSPACE_TOOLS) {
      expect(MASTRACODE_WORKSPACE_TOOLS[toolName]?.background).toBeUndefined();
    }
  });
});
