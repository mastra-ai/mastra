import type { IMastraLogger } from '@mastra/core/logger';
import { fetchWithRetry } from '@mastra/core/utils';

const AUTH_FAILURE_STATUSES = new Set([401, 403]);
const AUTH_COOLDOWN_BASE_MS = 60_000;
// Target cap before jitter; positive jitter can exceed this to avoid synchronized retry probes.
const AUTH_COOLDOWN_MAX_MS = 15 * 60_000;
const AUTH_COOLDOWN_JITTER_RATIO = 0.1;

export class AuthFailureError extends Error {
  readonly status: number;

  constructor(status: number, cause?: unknown) {
    super(`Request failed with authentication status: ${status}`, { cause });
    this.name = 'AuthFailureError';
    this.status = status;
  }
}

export function isAuthFailureError(error: unknown): error is AuthFailureError {
  return error instanceof AuthFailureError;
}

function isAuthFailureStatus(status: number): boolean {
  return AUTH_FAILURE_STATUSES.has(status);
}

export async function fetchWithAuthFailureHandling(
  url: string,
  options: RequestInit,
  maxRetries: number,
): Promise<void> {
  let authFailureStatus: number | undefined;

  try {
    await fetchWithRetry(url, options, maxRetries, {
      shouldRetryResponse: response => {
        if (isAuthFailureStatus(response.status)) {
          authFailureStatus = response.status;
          return false;
        }

        return true;
      },
    });
  } catch (error) {
    if (authFailureStatus !== undefined) {
      throw new AuthFailureError(authFailureStatus, error);
    }

    throw error;
  }
}

export class AuthFailureCooldown {
  private failureCount = 0;
  private cooldownUntilMs = 0;
  private droppedEventsDuringCooldown = 0;

  constructor(
    private readonly exporterName: string,
    private readonly getLogger: () => IMastraLogger,
  ) {}

  private shouldDropEvents(): boolean {
    return Date.now() < this.cooldownUntilMs;
  }

  dropEventIfCoolingDown(): boolean {
    return this.dropEventsIfCoolingDown(1);
  }

  dropEventsIfCoolingDown(count: number): boolean {
    if (!this.shouldDropEvents()) {
      return false;
    }

    this.droppedEventsDuringCooldown += count;
    return true;
  }

  reset(): number {
    const droppedEventsDuringCooldown = this.droppedEventsDuringCooldown;

    this.failureCount = 0;
    this.cooldownUntilMs = 0;
    this.droppedEventsDuringCooldown = 0;

    return droppedEventsDuringCooldown;
  }

  recordFailure(args: { status: number; failedSignals: string[]; droppedBatchSize: number }): void {
    this.failureCount++;
    const droppedEventsDuringCooldown = this.droppedEventsDuringCooldown;
    this.droppedEventsDuringCooldown = 0;

    const targetCooldownMs = Math.min(AUTH_COOLDOWN_BASE_MS * Math.pow(2, this.failureCount - 1), AUTH_COOLDOWN_MAX_MS);
    const jitterMs = Math.floor(targetCooldownMs * AUTH_COOLDOWN_JITTER_RATIO * (Math.random() - 0.5) * 2);
    const cooldownMs = Math.max(AUTH_COOLDOWN_BASE_MS, targetCooldownMs + jitterMs);
    const cooldownSeconds = Math.ceil(cooldownMs / 1000);

    this.cooldownUntilMs = Date.now() + cooldownMs;

    this.getLogger().warn(
      `${this.exporterName} received an authentication failure; pausing uploads for ${cooldownSeconds}s`,
      {
        status: args.status,
        failedSignals: args.failedSignals,
        droppedBatchSize: args.droppedBatchSize,
        droppedEventsDuringCooldown,
        authFailureCount: this.failureCount,
        cooldownMs,
      },
    );
  }
}
