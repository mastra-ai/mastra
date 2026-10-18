import { z } from 'zod';

import type { caseEventSchema } from '../../domain/events.js';
import { caseIdSchema, eventIdSchema, tenantIdSchema } from '../../domain/identifiers.js';

export const getCaseEventInputSchema = z.object({ tenantId: tenantIdSchema, eventId: eventIdSchema }).strict();
export const listCaseEventsInputSchema = z
  .object({
    tenantId: tenantIdSchema,
    caseId: caseIdSchema,
    afterEventId: eventIdSchema.optional(),
    limit: z.number().int().min(1).max(200).default(100),
  })
  .strict();

export interface CaseEventRepository {
  get(input: z.infer<typeof getCaseEventInputSchema>): Promise<z.infer<typeof caseEventSchema>>;
  list(input: z.input<typeof listCaseEventsInputSchema>): Promise<z.infer<typeof caseEventSchema>[]>;
}
