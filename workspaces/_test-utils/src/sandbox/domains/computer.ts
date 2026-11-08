import { SandboxComputers } from '@mastra/core/computers';
import { WORKSPACE_TOOLS, Workspace, createWorkspaceTools, supportsComputer } from '@mastra/core/workspace';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { expect } from 'vitest';

/** Shared borrowed-computer conformance exercised by real provider adapters around their SDK fakes. */
export async function assertComputerConformance(createSandbox: () => WorkspaceSandbox): Promise<void> {
  const sandbox = createSandbox();
  expect(supportsComputer(sandbox)).toBe(true);

  const workspace = new Workspace({ sandbox });
  const tools = await createWorkspaceTools(workspace);
  expect(Object.keys(tools).filter(id => id.startsWith('mastra_workspace_computer_')).sort()).toEqual(
    Object.values(WORKSPACE_TOOLS.COMPUTER).sort(),
  );

  const computers = new SandboxComputers({ workspace, secret: 'conformance-secret' });
  const context = { agent: { resourceId: 'resource', threadId: 'thread' } } as any;
  const listed = await (computers.tools().mastra_workspace_computer_list as any).execute({}, context);
  expect(listed.computers).toHaveLength(1);
  const id = listed.computers[0].id;
  await expect((computers.tools().mastra_workspace_computer_attach as any).execute({ id }, context)).resolves.toMatchObject({
    computer: { id, status: 'attached' },
  });
  await expect((computers.tools().mastra_workspace_computer_release as any).execute({}, context)).resolves.toMatchObject({
    computer: { id, status: 'released' },
  });
}
