import z from 'zod';

// ============================================================================
// Path Parameter Schemas
// ============================================================================

export const processorProviderIdPathParams = z.object({
  providerId: z.string().describe('Unique identifier for the processor provider'),
});

// ============================================================================
// Response Schemas
// ============================================================================

const processorPhaseSchema = z.enum([
  'processInput',
  'processInputStep',
  'processOutputStream',
  'processOutputResult',
  'processOutputStep',
]);

export const getProcessorProvidersResponseSchema = z.object({
  providers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      availablePhases: z.array(processorPhaseSchema),
    }),
  ),
});

export const getProcessorProviderResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  availablePhases: z.array(processorPhaseSchema),
  configSchema: z.record(z.string(), z.unknown()),
});
