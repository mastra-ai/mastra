import { leadEventSchema, normalizedEventSchema } from '../contracts';
import type { NormalizedEvent } from '../contracts';
import type { IntakeConfig } from '../config/lead-ingestion';

export interface EventInputProvider {
  normalize(payload: unknown, source: IntakeConfig['source'], receivedAt: string): NormalizedEvent;
}

const genericInput: EventInputProvider = {
  normalize(payload, source, receivedAt) {
    const event = leadEventSchema.parse(payload);
    return normalizedEventSchema.parse({
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
    });
  },
};

export const inputProviders = new Map<string, EventInputProvider>([['generic', genericInput]]);
