/**
 * In-process `sandboxId → instanceUrl` registry populated by
 * {@link PlatformSandbox.start} from the `instanceUrl` field workspace-proxy
 * includes on create + get responses, and consumed by
 * {@link PlatformSandbox.executeCommand} on the private-network fast path.
 *
 * The registry lives in the same Node process as the `PlatformSandbox`
 * consumer — for shipyard, that is the Mastra runtime deployed from
 * `mastracode/web`. There is no receiver route and no cross-service dance;
 * the address is just a field copied from a response the runtime already
 * receives.
 *
 * State intentionally does not persist:
 *
 *  - The IPv6 rotates on every sandbox recreate.
 *  - The URL has no meaning after the sandbox is destroyed.
 *  - The live sandbox binding, session context, and lease all die with the
 *    runtime process; the address dying with them is correct.
 *  - The proxy's `environment_sandboxes.instance_url` column is the durable
 *    source of truth — a runtime restart re-populates the registry on the
 *    next `start()` / reattach from the proxy's response.
 */

import type { SandboxAddressRegistry } from './sandbox.js';

/**
 * Concrete in-process {@link SandboxAddressRegistry}. Backed by a `Map`; no
 * eviction policy, no TTL — entries live until an observed transport failure
 * calls `delete`, until the sandbox is explicitly destroyed, or until the
 * process exits.
 */
export class InProcessSandboxAddressRegistry implements SandboxAddressRegistry {
  readonly #map = new Map<string, string>();

  get(sandboxId: string): string | undefined {
    return this.#map.get(sandboxId);
  }

  /**
   * Populate or overwrite the address for a sandbox. Called by
   * {@link PlatformSandbox.start} on every fresh provision and every reattach;
   * overwriting is intentional so a re-provision with a fresh IPv6 heals the
   * map without a branch.
   */
  set(sandboxId: string, instanceUrl: string): void {
    this.#map.set(sandboxId, instanceUrl);
  }

  delete(sandboxId: string): void {
    this.#map.delete(sandboxId);
  }

  /**
   * Test-only introspection. Not part of {@link SandboxAddressRegistry} —
   * production callers must not read the registry as a whole.
   */
  get size(): number {
    return this.#map.size;
  }
}
