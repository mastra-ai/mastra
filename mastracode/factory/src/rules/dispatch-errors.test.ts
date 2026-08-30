import { describe, expect, it } from 'vitest';

import { factoryDispatchFailureMetadata } from './dispatch-errors.js';

describe('Factory dispatch failure policy', () => {
  it('does not offer Retry for deterministic workspace failures', () => {
    expect(factoryDispatchFailureMetadata('repository_git_missing').retryable).toBe(false);
    expect(factoryDispatchFailureMetadata('repository_egress_blocked').retryable).toBe(false);
    expect(factoryDispatchFailureMetadata('repository_cli_missing').retryable).toBe(false);
    expect(factoryDispatchFailureMetadata('unsupported_provider_item').retryable).toBe(false);
  });

  it('offers Retry for repeatable transport and repository operations', () => {
    expect(factoryDispatchFailureMetadata('notification_delivery_failed').retryable).toBe(true);
    expect(factoryDispatchFailureMetadata('repository_clone_failed').retryable).toBe(true);
    expect(factoryDispatchFailureMetadata('repository_pull_failed').retryable).toBe(true);
    expect(factoryDispatchFailureMetadata('source_control_missing').retryable).toBe(true);
    expect(factoryDispatchFailureMetadata('session_unavailable').retryable).toBe(true);
    expect(factoryDispatchFailureMetadata('unknown').retryable).toBe(true);
    expect(factoryDispatchFailureMetadata(null).retryable).toBe(true);
  });
});
