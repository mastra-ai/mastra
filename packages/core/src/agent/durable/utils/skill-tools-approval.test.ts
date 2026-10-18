/**
 * Skill tools (`skill`, `skill_read`, `skill_search`) must never require approval,
 * even under a global `requireToolApproval` (issue #27248). `listSkillTools` marks
 * them approval-exempt; both the durable and non-durable resolvers honor the mark.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { resolveToolApprovalVerdict } from '../../../loop/workflows/agentic-execution/tool-approval-verdict';
import { CoreToolBuilder } from '../../../tools/tool-builder/builder';
import { isApprovalExempt, markApprovalExempt } from '../../../tools/toolchecks';
import { toolRequiresApproval } from './resolve-runtime';

function buildTool({ exempt }: { exempt: boolean }) {
  const tool = new CoreToolBuilder({
    originalTool: {
      id: 'skill',
      description: 'skill',
      inputSchema: z.object({ name: z.string() }),
      execute: async () => 'ok',
    } as any,
    options: { name: 'skill', requireApproval: false } as any,
  }).build();
  if (exempt) markApprovalExempt(tool);
  return tool;
}

const verdict = (tool: unknown, requireToolApproval: any) =>
  resolveToolApprovalVerdict({
    tool,
    requireToolApproval,
    context: { toolName: 'skill', args: { name: 'x' } } as any,
  });

describe('approval-exempt (skill) tools', () => {
  it('durable resolver ignores a global boolean and function requireToolApproval', async () => {
    const tool = buildTool({ exempt: true });
    await expect(toolRequiresApproval(tool, true, { name: 'x' })).resolves.toBe(false);
    await expect(toolRequiresApproval(tool, () => true, { name: 'x' })).resolves.toBe(false);
  });

  it('non-durable resolver ignores a global boolean and function requireToolApproval', async () => {
    const tool = buildTool({ exempt: true });
    await expect(verdict(tool, true)).resolves.toBe(false);
    await expect(verdict(tool, () => true)).resolves.toBe(false);
  });

  it('does not flag the tool as approval-capable (keeps concurrency/eager execution unchanged)', () => {
    const tool = buildTool({ exempt: true }) as any;
    expect(tool.requireApproval).toBe(false);
    expect(tool.needsApprovalFn).toBeUndefined();
    expect(Object.keys(tool)).not.toContain('approvalExempt');
  });

  it('keeps the exemption when wrapped by a spread (e.g. tool hooks)', async () => {
    const tool = buildTool({ exempt: true });
    const wrapped = { ...tool };
    if (isApprovalExempt(tool)) markApprovalExempt(wrapped);
    await expect(verdict(wrapped, true)).resolves.toBe(false);
    await expect(verdict({ ...tool }, true)).resolves.toBe(true);
  });

  it('non-exempt tools with requireApproval: false are still gated by the global flag', async () => {
    const tool = buildTool({ exempt: false });
    await expect(toolRequiresApproval(tool, true, {})).resolves.toBe(true);
    await expect(verdict(tool, true)).resolves.toBe(true);
  });
});
