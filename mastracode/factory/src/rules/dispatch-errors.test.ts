import { describe, expect, it } from 'vitest';

import { dispatcherRedelivers, factoryDispatchFailureMetadata } from './dispatch-errors.js';

describe('Factory dispatch failure policy', () => {
  it('does not offer Retry for deterministic workspace failures', () => {
    expect(factoryDispatchFailureMetadata('repository_git_missing').canRetry).toBe(false);
    expect(factoryDispatchFailureMetadata('repository_egress_blocked').canRetry).toBe(false);
    expect(factoryDispatchFailureMetadata('repository_cli_missing').canRetry).toBe(false);
    expect(factoryDispatchFailureMetadata('unsupported_provider_item').canRetry).toBe(false);
    // Rows written before a pause stopped counting as a failure: retrying one kicks a run nobody asked for.
    expect(factoryDispatchFailureMetadata('plan_awaiting_approval').canRetry).toBe(false);
    expect(factoryDispatchFailureMetadata('run_awaiting_input').canRetry).toBe(false);
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

  it('leaves a configuration failure to the person who can fix it', () => {
    expect(factoryDispatchFailureMetadata('run_configuration_invalid').canRetry).toBe(true);
    expect(dispatcherRedelivers('run_configuration_invalid')).toBe(false);
    expect(dispatcherRedelivers('repository_clone_failed')).toBe(true);
    expect(dispatcherRedelivers('repository_git_missing')).toBe(false);
  });
});
