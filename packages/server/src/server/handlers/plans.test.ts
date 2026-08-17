import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { submitPlanTool } from '@mastra/core/tools';
import { LocalFilesystem, Workspace } from '@mastra/core/workspace';
import { afterEach, describe, expect, it } from 'vitest';
import { HTTPException } from '../http-exception';
import { READ_AGENT_PLAN_ROUTE } from './plans';
import { createTestServerContext } from './test-utils';

const tempDirectories: string[] = [];

async function createPlanAgent({ withSubmitPlan = true }: { withSubmitPlan?: boolean } = {}) {
  const basePath = await mkdtemp(join(tmpdir(), 'mastra-agent-plan-'));
  tempDirectories.push(basePath);

  const filesystem = new LocalFilesystem({ basePath });
  const workspace = new Workspace({ id: 'plan-workspace', filesystem });
  const agent = new Agent({
    id: 'plan-agent',
    name: 'Plan agent',
    instructions: 'Submit plans for review.',
    model: 'openai/gpt-4o-mini',
    tools: withSubmitPlan ? { userDefinedAlias: submitPlanTool } : {},
    workspace,
  });
  const mastra = new Mastra({ logger: false, agents: { planAgent: agent } });

  return { filesystem, mastra };
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe('READ_AGENT_PLAN_ROUTE', () => {
  describe('when the agent exposes the core submit_plan tool under a user-defined alias', () => {
    it('returns the requested plan markdown', async () => {
      const { filesystem, mastra } = await createPlanAgent();
      const path = '.mastracode/plans/add-dark-mode.md';
      await filesystem.writeFile(path, '# Add dark mode\n\nUse semantic tokens.', { recursive: true });

      const result = await READ_AGENT_PLAN_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        agentId: 'plan-agent',
        path,
      });

      expect(result).toEqual({ path, content: '# Add dark mode\n\nUse semantic tokens.' });
    });
  });

  describe('when the agent does not expose the core submit_plan tool id', () => {
    it('does not expose plan content', async () => {
      const { filesystem, mastra } = await createPlanAgent({ withSubmitPlan: false });
      const path = '.mastracode/plans/private.md';
      await filesystem.writeFile(path, '# Private', { recursive: true });

      await expect(
        READ_AGENT_PLAN_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          agentId: 'plan-agent',
          path,
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Plan capability not found' }));
    });
  });

  describe('when the requested path is outside the plans directory', () => {
    it.each([
      '../secrets.md',
      '.mastracode/plans/../secrets.md',
      '.mastracode/plans/plan.txt',
      '/.mastracode/plans/absolute.md',
      '.mastracode\\plans\\windows.md',
    ])('rejects %s', async path => {
      const { mastra } = await createPlanAgent();

      await expect(
        READ_AGENT_PLAN_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          agentId: 'plan-agent',
          path,
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Invalid plan path' }));
    });
  });

  describe('when the submitted plan is larger than 512 KiB', () => {
    it('returns the complete plan markdown', async () => {
      const { filesystem, mastra } = await createPlanAgent();
      const path = '.mastracode/plans/large.md';
      const content = 'x'.repeat(512 * 1024 + 1);
      await filesystem.writeFile(path, content, { recursive: true });

      const result = await READ_AGENT_PLAN_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        agentId: 'plan-agent',
        path,
      });

      expect(result).toEqual({ path, content });
    });
  });
});
