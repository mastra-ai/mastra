import type { PepScreeningProvider, SanctionsScreeningProvider } from '../../contracts/providers/screening.js';
import {
  ProviderNotImplementedError,
  type ProviderCapabilities,
  type ProviderOperation,
} from '../../contracts/shared/provider.js';

abstract class CustomerScreeningProvider {
  abstract readonly id: string;
  readonly version = 'todo';
  abstract readonly operation: ProviderOperation;
  abstract readonly capabilities: ProviderCapabilities;
  protected notImplemented(): ProviderNotImplementedError {
    // TODO: Call the licensed matching operation, not a generic text-search endpoint.
    // TODO: Return ranked ScreeningResult candidates with permitted evidence and distinct screening kind.
    // TODO: Map rate limits, timeouts, invalid responses, rejection, and unavailability without returning clear.
    // TODO: Minimize screening PII, honor the deadline, and preserve the request idempotency key.
    return new ProviderNotImplementedError({
      providerId: this.id,
      operation: this.operation,
      safeMessage: 'Customer screening is not implemented',
    });
  }
}

export class CustomerSanctionsScreeningProvider
  extends CustomerScreeningProvider
  implements SanctionsScreeningProvider
{
  readonly id = 'customer-sanctions-screening';
  readonly operation = 'SANCTIONS_SCREENING' as const;
  readonly capabilities: ProviderCapabilities = {
    operations: [this.operation],
    environments: ['live'],
    externalNetwork: true,
    idempotent: true,
    supportedPiiModes: ['demo-default', 'demo-strict'],
    acceptedPii: ['IDENTITY', 'DATE_OF_BIRTH', 'SCREENING'],
    documentMimeTypes: [],
    jurisdictions: ['US'],
  };
  screen(
    input: Parameters<SanctionsScreeningProvider['screen']>[0],
    context: Parameters<SanctionsScreeningProvider['screen']>[1],
  ): ReturnType<SanctionsScreeningProvider['screen']> {
    void input;
    void context;
    return Promise.reject(this.notImplemented());
  }
}

export class CustomerPepScreeningProvider extends CustomerScreeningProvider implements PepScreeningProvider {
  readonly id = 'customer-pep-screening';
  readonly operation = 'PEP_SCREENING' as const;
  readonly capabilities: ProviderCapabilities = {
    operations: [this.operation],
    environments: ['live'],
    externalNetwork: true,
    idempotent: true,
    supportedPiiModes: ['demo-default', 'demo-strict'],
    acceptedPii: ['IDENTITY', 'DATE_OF_BIRTH', 'SCREENING'],
    documentMimeTypes: [],
    jurisdictions: ['US'],
  };
  screen(
    input: Parameters<PepScreeningProvider['screen']>[0],
    context: Parameters<PepScreeningProvider['screen']>[1],
  ): ReturnType<PepScreeningProvider['screen']> {
    void input;
    void context;
    return Promise.reject(this.notImplemented());
  }
}
