/**
 * Wires the core workspace sandbox seam to the factory's session sandboxes.
 * Core's `getDynamicWorkspace` reattaches project sandboxes through
 * `@mastra/code-sdk/agents/sandbox-reattach`. Sandbox identity is the session
 * id, so the seam resolves through the per-process session memo — it never
 * constructs or provisions (passive callers must not create VMs).
 */
import { registerSandboxReattach as registerOnCore } from '@mastra/code-sdk/agents/sandbox-reattach';
import { peekSessionSandbox } from './session-sandbox.js';

export function registerSandboxReattach(): void {
  registerOnCore(async sandboxId => {
    const entry = peekSessionSandbox(sandboxId);
    if (!entry) {
      throw new Error(`No session sandbox '${sandboxId}' is active in this process`);
    }
    return entry.sandbox as never;
  });
}
