/**
 * Wires the core workspace sandbox seam to this package's sandbox
 * provisioning. Core's `getDynamicWorkspace` reattaches GitHub project
 * sandboxes through `@mastra/code-sdk/agents/sandbox-reattach`, but only
 * the web surface knows the sandbox provider factory — so the implementation
 * is registered here at web-surface load time.
 */
import { registerSandboxReattach as registerOnCore } from '@mastra/code-sdk/agents/sandbox-reattach';
import { reattachSandbox } from './sandbox/fleet.js';

export function registerSandboxReattach(): void {
  registerOnCore(reattachSandbox);
}
