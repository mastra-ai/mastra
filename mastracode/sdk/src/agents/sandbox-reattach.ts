/**
 * Seam between the core workspace wiring and the web surface's sandbox
 * provisioning. GitHub/cloud-sandbox projects are only reachable through the
 * web tenant server, which owns the sandbox provider factory and its DB-backed
 * bookkeeping. The web package registers its `reattachProjectSandbox`
 * implementation here at startup so `getDynamicWorkspace` can reattach
 * sandboxes without core depending on the web stack.
 */
import type { SandboxExec } from './sandbox-filesystem.js';

/** Minimal sandbox surface the workspace seam needs after reattach. */
export interface ReattachedSandbox extends SandboxExec {
  start(): Promise<void>;
}

export type SandboxReattachFn = (providerSandboxId: string) => Promise<ReattachedSandbox>;

let reattachFn: SandboxReattachFn | undefined;

/** Register the sandbox reattach implementation (called by the web surface at startup). */
export function registerSandboxReattach(fn: SandboxReattachFn): void {
  reattachFn = fn;
}

/** Reattach to an already-provisioned sandbox by provider id. */
export async function reattachProjectSandbox(providerSandboxId: string): Promise<ReattachedSandbox> {
  if (!reattachFn) {
    throw new Error(
      'No sandbox reattach implementation registered. Sandbox-backed workspaces are only available when the web surface has called registerSandboxReattach().',
    );
  }
  return reattachFn(providerSandboxId);
}
