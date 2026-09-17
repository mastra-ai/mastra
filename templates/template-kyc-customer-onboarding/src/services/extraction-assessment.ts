import { z } from 'zod';

import { documentExtractionResultSchema } from '../contracts/providers/document-extraction.js';
import { extractionQualityPolicySchema } from '../config/policies/extraction-quality.js';

const extractableFieldSchema = z.enum([
  'fullName',
  'dateOfBirth',
  'documentNumber',
  'expirationDate',
  'nationality',
  'residentialAddress',
]);

export const extractionAssessmentSchema = z
  .object({
    route: z.enum(['READY_FOR_CHECKS', 'MISSING_INFORMATION']),
    quality: documentExtractionResultSchema.shape.quality,
    missingFields: z.array(extractableFieldSchema),
    lowConfidenceFields: z.array(extractableFieldSchema),
    warnings: z.array(z.string().min(1).max(200)),
  })
  .strict();

export const assessExtraction = (
  result: z.infer<typeof documentExtractionResultSchema>,
  requiredFields: readonly string[],
  policy: z.infer<typeof extractionQualityPolicySchema>,
): z.infer<typeof extractionAssessmentSchema> => {
  const parsedResult = documentExtractionResultSchema.parse(result);
  const parsedPolicy = extractionQualityPolicySchema.parse(policy);
  const supportedRequiredFields = requiredFields.flatMap(field => {
    const parsed = extractableFieldSchema.safeParse(field);
    return parsed.success ? [parsed.data] : [];
  });
  const missingFields = supportedRequiredFields.filter(field => parsedResult.fields[field].normalizedValue === null);
  const lowConfidenceFields = supportedRequiredFields.filter(field => {
    const value = parsedResult.fields[field];
    return (
      value.normalizedValue !== null &&
      (value.confidence === null || value.confidence < parsedPolicy.minimumFieldConfidence)
    );
  });
  const allMissing = [
    ...new Set([...missingFields, ...(parsedPolicy.enforceMinimumFieldConfidence ? lowConfidenceFields : [])]),
  ];
  const warnings = [...parsedResult.warnings, ...lowConfidenceFields.map(field => `FIELD_UNCERTAIN:${field}`)];
  return extractionAssessmentSchema.parse({
    route: parsedResult.quality === 'UNREADABLE' || allMissing.length > 0 ? 'MISSING_INFORMATION' : 'READY_FOR_CHECKS',
    quality: parsedResult.quality,
    missingFields: allMissing,
    lowConfidenceFields,
    warnings,
  });
};
