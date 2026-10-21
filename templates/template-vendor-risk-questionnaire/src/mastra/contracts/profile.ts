import { z } from 'zod';
import { evidenceScopeSchema } from './evidence-snapshot.ts';
import { executionPolicySchema } from './execution-policy.ts';
import { isAbsolute } from 'node:path';
const localPath = z.string().min(1).max(2000).refine(isAbsolute, 'An absolute local path is required.');
export const evidenceProfileSchema = z
  .object({
    schemaVersion: z.literal(1),
    evidenceRoot: localPath,
    manifestPath: localPath,
    scope: evidenceScopeSchema,
    policy: executionPolicySchema,
  })
  .strict();
