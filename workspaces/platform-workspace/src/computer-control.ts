import type {
  ComputerControlEnforcementResult,
  ComputerControlSubscriber,
  MastraComputerControl,
  MastraComputerScope,
} from '@mastra/core/computers';

export interface PlatformComputerIdentity {
  sandboxId: string;
  provider: string;
  providerResourceId: string;
  generation: string;
}

export interface PlatformComputerIdentityResolver {
  resolve(input: {
    identity: unknown;
    scope: MastraComputerScope;
    signal: AbortSignal;
  }): Promise<PlatformComputerIdentity | null>;
}

export interface PlatformComputerControlLease {
  epoch: number;
  fencingToken: string;
  expiresAt: number;
}

export interface PlatformComputerControlLeaseClient {
  acquire(input: {
    identity: PlatformComputerIdentity;
    revision: number;
    mode: 'agent' | 'human';
    signal: AbortSignal;
  }): Promise<PlatformComputerControlLease>;
  renew(input: {
    identity: PlatformComputerIdentity;
    lease: PlatformComputerControlLease;
    revision: number;
    mode: 'agent' | 'human';
    signal: AbortSignal;
  }): Promise<PlatformComputerControlLease>;
  apply(input: {
    identity: PlatformComputerIdentity;
    lease: PlatformComputerControlLease;
    revision: number;
    mode: 'agent' | 'human';
    signal: AbortSignal;
  }): Promise<void>;
  observe(input: {
    identity: PlatformComputerIdentity;
    lease: PlatformComputerControlLease;
    signal: AbortSignal;
  }): Promise<{ revision: number; mode: 'agent' | 'human'; epoch: number; fencingToken: string }>;
}

export interface PlatformComputerControlEnforcementOptions {
  identityResolver: PlatformComputerIdentityResolver;
  leaseClient: PlatformComputerControlLeaseClient;
  minLeaseRemainingMs?: number;
  now?: () => number;
}

export class PlatformComputerControlPermanentError extends Error {}

function validLease(lease: PlatformComputerControlLease): boolean {
  return (
    Number.isSafeInteger(lease.epoch) &&
    lease.epoch >= 0 &&
    typeof lease.fencingToken === 'string' &&
    lease.fencingToken.length > 0 &&
    Number.isFinite(lease.expiresAt)
  );
}

/** Required Platform projection of authoritative core computer control. */
export class PlatformComputerControlSubscriber implements ComputerControlSubscriber {
  readonly id = 'platform-computer-control';
  readonly required = true;
  readonly #options: PlatformComputerControlEnforcementOptions;
  readonly #shutdown = new AbortController();

  constructor(options: PlatformComputerControlEnforcementOptions) {
    this.#options = options;
  }

  close(): void {
    this.#shutdown.abort(new Error('platform computer control subscriber shut down'));
  }

  async enforce(input: {
    computerId: string;
    scope: MastraComputerScope;
    identity: unknown;
    control: MastraComputerControl;
    signal: AbortSignal;
  }): Promise<ComputerControlEnforcementResult> {
    const signal = AbortSignal.any([input.signal, this.#shutdown.signal]);
    try {
      signal.throwIfAborted();
      const identity = await this.#options.identityResolver.resolve({
        identity: input.identity,
        scope: input.scope,
        signal,
      });
      if (!identity) return { status: 'permanent', error: 'platform computer identity could not be verified' };

      const request = {
        identity,
        revision: input.control.revision,
        mode: input.control.holder,
        signal,
      } as const;
      let lease = await this.#options.leaseClient.acquire(request);
      if (!validLease(lease)) return { status: 'permanent', error: 'platform returned an invalid control lease' };

      const now = this.#options.now ?? Date.now;
      const minRemaining = this.#options.minLeaseRemainingMs ?? 5_000;
      if (lease.expiresAt - now() < minRemaining) {
        lease = await this.#options.leaseClient.renew({ ...request, lease });
        if (!validLease(lease) || lease.expiresAt - now() < minRemaining) {
          return { status: 'retryable', error: 'platform computer control lease is expiring' };
        }
      }

      await this.#options.leaseClient.apply({ ...request, lease });
      const observed = await this.#options.leaseClient.observe({ identity, lease, signal });
      if (
        observed.epoch !== lease.epoch ||
        observed.fencingToken !== lease.fencingToken ||
        observed.mode !== input.control.holder ||
        observed.revision < input.control.revision
      ) {
        return { status: 'retryable', error: 'platform computer control projection is not current' };
      }
      return { status: 'enforced', enforcedRevision: observed.revision };
    } catch (error) {
      if (error instanceof PlatformComputerControlPermanentError) {
        return { status: 'permanent', error: error.message };
      }
      return { status: 'retryable', error: String((error as Error)?.message ?? error) };
    }
  }
}
