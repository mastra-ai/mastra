import { describe, expect, it } from 'vitest';

import { factoryDispatchFailureMetadata } from './dispatch-errors.js';

describe('Factory dispatch failure policy', () => {
  it('does not offer Retry for deterministic workspace failures', () => {
    expect(factoryDispatchFailureMetadata('repository_git_missing').canRetry).toBe(false);
    expect(factoryDispatchFailureMetadata('repository_egress_blocked').canRetry).toBe(false);
    expect(factoryDispatchFailureMetadata('repository_cli_missing').canRetry).toBe(false);
    expect(factoryDispatchFailureMetadata('unsupported_provider_item').canRetry).toBe(false);
  });

  it('offers Retry for repeatable transport and repository operations', () => {
    expect(factoryDispatchFailureMetadata('notification_delivery_failed').canRetry).toBe(true);
    expect(factoryDispatchFailureMetadata('repository_clone_failed').canRetry).toBe(true);
    expect(factoryDispatchFailureMetadata('repository_pull_failed').canRetry).toBe(true);
    expect(factoryDispatchFailureMetadata('source_control_missing').canRetry).toBe(true);
    expect(factoryDispatchFailureMetadata('session_unavailable').canRetry).toBe(true);
    expect(factoryDispatchFailureMetadata('unknown').canRetry).toBe(true);
    expect(factoryDispatchFailureMetadata(null).canRetry).toBe(true);
  });
});
