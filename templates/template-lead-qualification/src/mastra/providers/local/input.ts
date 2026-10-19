import type { IntakeConfig } from '../../config/lead-ingestion';
import { leadEventSchema, normalizedEventSchema } from '../../contracts';
import type { EventInputProvider } from '../input';

/** JSON intake separates submitted context from trusted source and destination bindings. */
export class LocalInputProvider implements EventInputProvider {
  readonly id = 'generic';
  readonly transport = 'json';
  readonly source;
  constructor(source: IntakeConfig['source']) {
    this.source = source;
  }
  async normalize(payload: unknown, source: IntakeConfig['source'], receivedAt: string) {
    const event = leadEventSchema.parse(payload);
    return {
      event: normalizedEventSchema.parse({
        version: event.version,
        type: event.type,
        eventId: event.eventId,
        sourceId: source.id,
        receivedAt,
        occurredAt: event.occurredAt,
        supersedesAssessmentId: event.supersedesAssessmentId,
        lead: event.lead,
        destination: {
          providerId: source.destinationProviderId,
          reference: event.destinationReference ?? event.lead.reference,
        },
      }),
    };
  }
}
