/**
 * Wires the core workspace sandbox seam to the factory's sandbox fleet.
 * Core's `getDynamicWorkspace` reattaches project sandboxes through
 * `@mastra/code-sdk/agents/sandbox-reattach`, but only the factory owns the
 * fleet — so `MastraFactory.prepare()` registers the implementation here once
 * the fleet is constructed.
 */
import { registerSandboxReattach as registerOnCore } from '@mastra/code-sdk/agents/sandbox-reattach';
import type { SandboxFleet } from './fleet.js';

export function registerSandboxReattach(fleet: SandboxFleet): void {
  registerOnCore(providerSandboxId => fleet.reattachSandbox(providerSandboxId));
}
