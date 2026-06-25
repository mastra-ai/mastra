import { WORKSPACE_TOOLS } from '@mastra/core/workspace';
import { describe, expect, it } from 'vitest';

import { MC_TOOLS } from '../../tool-names.js';
import { getCurrentPlanRelativePath } from '../../utils/plans.js';
import { buildMode } from '../modes/build.js';
import { fastMode } from '../modes/explore.js';
import { planMode } from '../modes/plan.js';
import {
  EXPLORE_MODE_AVAILABLE_TOOLS,
  guardPlanModePlanFileWrites,
  PLAN_MODE_AVAILABLE_TOOLS,
} from '../tool-availability.js';

describe('mode availableTools configuration', () => {
  describe('plan mode', () => {
    it('uses the shared plan availableTools allowlist', () => {
      expect(planMode.availableTools).toEqual([...PLAN_MODE_AVAILABLE_TOOLS]);
    });

    it('declares a unified availableTools allowlist', () => {
      expect(planMode.availableTools).toBeDefined();
      expect(Array.isArray(planMode.availableTools)).toBe(true);
      expect(planMode.availableTools!.length).toBeGreaterThan(0);
    });

    it('includes read-only exploration tools by exposed name', () => {
      const tools = planMode.availableTools!;
      expect(tools).toContain(MC_TOOLS.VIEW);
      expect(tools).toContain(MC_TOOLS.FIND_FILES);
      expect(tools).toContain(MC_TOOLS.SEARCH_CONTENT);
      expect(tools).toContain(MC_TOOLS.FILE_STAT);
      expect(tools).toContain(MC_TOOLS.LSP_INSPECT);
    });

    it('includes plan delivery tools', () => {
      const tools = planMode.availableTools!;
      expect(tools).toContain('submit_plan');
      expect(tools).toContain('ask_user');
    });

    it('includes plan file editing tools', () => {
      const tools = planMode.availableTools!;
      expect(tools).toContain(MC_TOOLS.WRITE_FILE);
      expect(tools).toContain(MC_TOOLS.STRING_REPLACE_LSP);
    });

    it('allows plan-mode writes to only the thread-scoped current-plan.md', () => {
      const projectPath = '/tmp/mastracode-plan-guard';
      const threadId = 'thread-plan-guard';
      const planPath = getCurrentPlanRelativePath(threadId);
      // Mirror the real HarnessRequestContext shape: session.modeId is a string
      // property and threadId lives at the top level (see harness/types.ts).
      const context = {
        requestContext: {
          harness: {
            threadId,
            session: {
              modeId: 'plan',
              state: { get: () => ({ projectPath }) },
            },
          },
        },
      };

      expect(
        guardPlanModePlanFileWrites({
          toolName: MC_TOOLS.WRITE_FILE,
          workspaceToolName: WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE,
          input: { path: planPath },
          context,
        }),
      ).toBeUndefined();

      expect(
        guardPlanModePlanFileWrites({
          toolName: MC_TOOLS.STRING_REPLACE_LSP,
          workspaceToolName: WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE,
          input: { path: `${projectPath}/${planPath}` },
          context,
        }),
      ).toBeUndefined();

      expect(
        guardPlanModePlanFileWrites({
          toolName: MC_TOOLS.WRITE_FILE,
          workspaceToolName: WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE,
          input: { path: 'src/index.ts' },
          context,
        }),
      ).toMatchObject({
        proceed: false,
        output: 'Plan mode can only edit the thread-scoped current-plan.md file. Refusing to edit src/index.ts.',
      });
    });

    it('rejects plan-mode writes to the non-thread-scoped current-plan.md', () => {
      const projectPath = '/tmp/mastracode-plan-guard';
      const threadId = 'thread-plan-guard';
      const context = {
        requestContext: {
          harness: {
            threadId,
            session: {
              modeId: 'plan',
              state: { get: () => ({ projectPath }) },
            },
          },
        },
      };

      expect(
        guardPlanModePlanFileWrites({
          toolName: MC_TOOLS.WRITE_FILE,
          workspaceToolName: WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE,
          input: { path: '.mastracode/plans/current-plan.md' },
          context,
        }),
      ).toMatchObject({
        proceed: false,
        output:
          'Plan mode can only edit the thread-scoped current-plan.md file. Refusing to edit .mastracode/plans/current-plan.md.',
      });
    });

    it('does not restrict file writes outside plan mode', () => {
      expect(
        guardPlanModePlanFileWrites({
          toolName: MC_TOOLS.WRITE_FILE,
          workspaceToolName: WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE,
          input: { path: 'src/index.ts' },
          context: {
            requestContext: {
              harness: {
                threadId: 'thread-plan-guard',
                session: {
                  modeId: 'build',
                  state: { get: () => ({ projectPath: '/tmp/mastracode-plan-guard' }) },
                },
              },
            },
          },
        }),
      ).toBeUndefined();
    });

    it('excludes mutating and execution tools', () => {
      const tools = planMode.availableTools!;
      expect(tools).not.toContain(MC_TOOLS.DELETE_FILE);
      expect(tools).not.toContain(MC_TOOLS.MKDIR);
      expect(tools).not.toContain(MC_TOOLS.AST_SMART_EDIT);
      expect(tools).not.toContain(MC_TOOLS.EXECUTE_COMMAND);
      expect(tools).not.toContain(MC_TOOLS.GET_PROCESS_OUTPUT);
      expect(tools).not.toContain(MC_TOOLS.KILL_PROCESS);
    });
  });

  describe('explore (fast) mode', () => {
    it('uses the shared explore availableTools allowlist', () => {
      expect(fastMode.availableTools).toEqual([...EXPLORE_MODE_AVAILABLE_TOOLS]);
    });

    it('declares a unified availableTools allowlist', () => {
      expect(fastMode.availableTools).toBeDefined();
      expect(Array.isArray(fastMode.availableTools)).toBe(true);
      expect(fastMode.availableTools!.length).toBeGreaterThan(0);
    });

    it('includes only read-only tools', () => {
      const tools = fastMode.availableTools!;
      expect(tools).toContain(MC_TOOLS.VIEW);
      expect(tools).toContain(MC_TOOLS.FIND_FILES);
      expect(tools).toContain(MC_TOOLS.SEARCH_CONTENT);
      expect(tools).toContain(MC_TOOLS.FILE_STAT);
      expect(tools).toContain(MC_TOOLS.LSP_INSPECT);
    });

    it('excludes all write and execution tools', () => {
      const tools = fastMode.availableTools!;
      expect(tools).not.toContain(MC_TOOLS.WRITE_FILE);
      expect(tools).not.toContain(MC_TOOLS.STRING_REPLACE_LSP);
      expect(tools).not.toContain(MC_TOOLS.DELETE_FILE);
      expect(tools).not.toContain(MC_TOOLS.MKDIR);
      expect(tools).not.toContain(MC_TOOLS.AST_SMART_EDIT);
      expect(tools).not.toContain(MC_TOOLS.EXECUTE_COMMAND);
    });
  });

  describe('build mode', () => {
    it('leaves availableTools unset for full access', () => {
      expect(buildMode.availableTools).toBeUndefined();
    });
  });
});
