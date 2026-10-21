import type { IntakeConfig } from './config/lead-ingestion';
import { snapshotConfiguration } from './config/qualification';
import type { QualificationConfig } from './config/qualification';
import { normalizedEventSchema } from './contracts';
import { DeliveryConflictError } from './persistence/lead-event-store';
import type { LeadEventStore } from './persistence/lead-event-store';
import type { EventInputProvider } from './providers/input';

/** All drivers bind trusted source, destination and captured policy at this admission boundary. */
export class LeadIntake {
  constructor(
    private readonly store: LeadEventStore,
    private readonly config: IntakeConfig,
    private readonly qualification: QualificationConfig,
  ) {}
  async receive(provider: EventInputProvider, payload: unknown, receivedAt = new Date().toISOString()) {
    const source = provider.source;
    if (!source || source.inputProviderId !== provider.id) throw new DeliveryConflictError('Unconfigured input source');
    const result = await provider.normalize(payload, source, receivedAt);
    if (!result || !('event' in result)) return result?.runId;
    const event = normalizedEventSchema.parse(result.event);
    if (
      event.sourceId !== source.id ||
      event.receivedAt !== receivedAt ||
      event.destination.providerId !== source.destinationProviderId
    )
      throw new DeliveryConflictError('Unconfigured event source or destination');
    return (
      await this.store.accept(
        event,
        this.config.limits.maxPendingRuns,
        snapshotConfiguration(this.qualification, event.receivedAt),
        result.expected,
      )
    ).runId;
  }
}
