import z from 'zod';
import { ruleGroupSchema } from './rule-group';
import {
  listVersionsQuerySchema,
  compareVersionsQuerySchema,
  createVersionBodySchema,
  activateVersionResponseSchema,
  deleteVersionResponseSchema,
  versionDiffEntrySchema,
  createListVersionsResponseSchema,
  createCompareVersionsResponseSchema,
} from './version-common';

// Re-export shared schemas under domain-specific names
export const listPromptBlockVersionsQuerySchema = listVersionsQuerySchema;
export const comparePromptBlockVersionsQuerySchema = compareVersionsQuerySchema;
export const createPromptBlockVersionBodySchema = createVersionBodySchema;

// ============================================================================
// Path Parameter Schemas
// ============================================================================

export const promptBlockVersionPathParams = z.object({
  promptBlockId: z.string().describe('Unique identifier for the stored prompt block'),
});

export const promptBlockVersionIdPathParams = z.object({
  promptBlockId: z.string().describe('Unique identifier for the stored prompt block'),
  versionId: z.string().describe('Unique identifier for the version (UUID)'),
});

// ============================================================================
// Response Schemas
// ============================================================================

export const promptBlockVersionSchema = z.object({
  id: z.string().describe('Unique identifier for the version (UUID)'),
  blockId: z.string().describe('ID of the prompt block this version belongs to'),
  versionNumber: z.number().describe('Sequential version number (1, 2, 3, ...)'),
  // Snapshot config fields
  name: z.string().describe('Display name of the prompt block'),
  description: z.string().optional().describe('Purpose description'),
  content: z.string().describe('Template content with {{variable}} interpolation'),
  rules: ruleGroupSchema.optional().describe('Rules for conditional inclusion'),
  requestContextSchema: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('JSON Schema defining available variables for {{variableName}} interpolation and conditions'),
  // Version metadata
  changedFields: z.array(z.string()).optional().describe('Array of field names that changed from the previous version'),
  changeMessage: z.string().optional().describe('Optional message describing the changes'),
  createdAt: z.coerce.date().describe('When this version was created'),
});

export const listPromptBlockVersionsResponseSchema = createListVersionsResponseSchema(promptBlockVersionSchema);

export const getPromptBlockVersionResponseSchema = promptBlockVersionSchema;

export const createPromptBlockVersionResponseSchema = promptBlockVersionSchema.partial().merge(
  z.object({
    id: z.string(),
    blockId: z.string(),
    versionNumber: z.number(),
    createdAt: z.coerce.date(),
  }),
);

export const activatePromptBlockVersionResponseSchema = activateVersionResponseSchema;

export const restorePromptBlockVersionResponseSchema = promptBlockVersionSchema;

export const deletePromptBlockVersionResponseSchema = deleteVersionResponseSchema;

export const comparePromptBlockVersionsResponseSchema = createCompareVersionsResponseSchema(promptBlockVersionSchema);

export { versionDiffEntrySchema };
