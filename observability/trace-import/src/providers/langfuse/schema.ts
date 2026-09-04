import { z } from 'zod';

const nullableString = z.string().nullable().optional();
const nullableNumber = z.number().finite().nullable().optional();
const nullableBoolean = z.boolean().nullable().optional();
const nullableRecord = z.record(z.string(), z.unknown()).nullable().optional();

/**
 * Langfuse Observations API v2. Optional fields depend on the requested field groups.
 * `type` intentionally remains an open string so a newly added provider type can
 * be retained and conservatively mapped instead of making the whole import fail.
 */
export const langfuseObservationSchema = z.object({
  id: z.string().min(1),
  traceId: nullableString,
  startTime: z.string(),
  endTime: nullableString,
  projectId: z.string().min(1),
  parentObservationId: nullableString,
  type: z.string().min(1),
  name: nullableString,
  level: nullableString,
  statusMessage: nullableString,
  version: nullableString,
  environment: nullableString,
  bookmarked: nullableBoolean,
  public: nullableBoolean,
  userId: nullableString,
  sessionId: nullableString,
  isRootObservation: nullableBoolean,
  completionStartTime: nullableString,
  createdAt: nullableString,
  updatedAt: nullableString,
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  metadata: z.unknown().optional(),
  model: nullableString,
  /** Compatibility fallback for older/self-hosted response shapes. Current V2 uses `model`. */
  providedModelName: nullableString,
  internalModelId: nullableString,
  modelId: nullableString,
  modelParameters: z.unknown().optional(),
  usageDetails: nullableRecord,
  inputUsage: nullableNumber,
  outputUsage: nullableNumber,
  totalUsage: nullableNumber,
  costDetails: nullableRecord,
  inputCost: nullableNumber,
  outputCost: nullableNumber,
  totalCost: nullableNumber,
  inputPrice: nullableString,
  outputPrice: nullableString,
  totalPrice: nullableString,
  usagePricingTierId: nullableString,
  usagePricingTierName: nullableString,
  promptId: nullableString,
  promptName: nullableString,
  promptVersion: z.union([z.string(), z.number()]).nullable().optional(),
  latency: nullableNumber,
  timeToFirstToken: nullableNumber,
  tags: z.array(z.string()).nullable().optional(),
  release: nullableString,
  traceName: nullableString,
  mastraImportDerivedEndTime: z.boolean().optional(),
  mastraImportDerivedEndTimeSourceObservationId: nullableString,
});

export const langfuseObservationsPageSchema = z.object({
  data: z.array(langfuseObservationSchema),
  meta: z.object({
    cursor: z.string().min(1).nullable().optional(),
  }),
});

export type LangfuseObservation = z.infer<typeof langfuseObservationSchema>;
export type LangfuseObservationsPage = z.infer<typeof langfuseObservationsPageSchema>;
