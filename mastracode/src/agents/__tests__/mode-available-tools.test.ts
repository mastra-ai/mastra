import { describe, expect, it } from 'vitest';

import { MC_TOOLS } from '../../tool-names.js';
import { buildMode } from '../modes/build.js';
import { fastMode } from '../modes/explore.js';
import { planMode } from '../modes/plan.js';

describe('mode availableTools configuration', () => {
  describe('plan mode', () => {
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
