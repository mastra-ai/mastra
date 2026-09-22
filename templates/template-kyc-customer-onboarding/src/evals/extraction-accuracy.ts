import { z } from 'zod';

import type { MultimodalDocumentExtractionProvider } from '../contracts/providers/document-extraction.js';
import { demoDefaultPolicy } from '../config/policies/demo-default.js';
import { executionContextSchema } from '../domain/context.js';
import { fixtureScenarioIds, getFixtureScenario } from '../fixtures/provider-scenarios.js';

const fieldNames = [
  'fullName',
  'dateOfBirth',
  'documentNumber',
  'expirationDate',
  'nationality',
  'residentialAddress',
] as const;

export const extractionEvalResultSchema = z
  .object({
    evalId: z.literal('extraction-accuracy-v1'),
    dataset: z.literal('synthetic-fixtures-v1'),
    scenarios: z.number().int().positive(),
    schemaValidity: z.number().min(0).max(1),
    documentTypeAccuracy: z.number().min(0).max(1),
    qualityAccuracy: z.number().min(0).max(1),
    normalizedExactMatch: z.number().min(0).max(1),
    fieldPresenceMacroF1: z.number().min(0).max(1),
    branchAccuracy: z.number().min(0).max(1),
    passed: z.boolean(),
  })
  .strict();

const execution = executionContextSchema.parse({
  tenantId: 'eval',
  jurisdiction: 'US',
  piiMode: 'demo-default',
  policy: {
    id: demoDefaultPolicy.id,
    version: demoDefaultPolicy.version,
    checksum: demoDefaultPolicy.checksum,
  },
  locale: 'en-US',
  correlationId: 'extraction-eval-v1',
  actor: { type: 'system', id: 'fixture-eval', roles: [] },
});

export const runFixtureExtractionEval = async (provider: MultimodalDocumentExtractionProvider) => {
  let validSchemas = 0;
  let matchingDocumentTypes = 0;
  let matchingQualities = 0;
  let exactValues = 0;
  let expectedValues = 0;
  const fieldPresenceCounts: Record<
    (typeof fieldNames)[number],
    { truePositive: number; falsePositive: number; falseNegative: number }
  > = {
    fullName: { truePositive: 0, falsePositive: 0, falseNegative: 0 },
    dateOfBirth: { truePositive: 0, falsePositive: 0, falseNegative: 0 },
    documentNumber: { truePositive: 0, falsePositive: 0, falseNegative: 0 },
    expirationDate: { truePositive: 0, falsePositive: 0, falseNegative: 0 },
    nationality: { truePositive: 0, falsePositive: 0, falseNegative: 0 },
    residentialAddress: { truePositive: 0, falsePositive: 0, falseNegative: 0 },
  };
  let matchingBranches = 0;

  for (const scenarioId of fixtureScenarioIds) {
    const scenario = getFixtureScenario(scenarioId);
    const result = await provider.extract(
      {
        caseId: `eval-case-${scenarioId}`,
        documentId: `eval-document-${scenarioId}`,
        documentTypeHint: scenario.documentType,
        document: {
          storageKey: `synthetic/${scenarioId}.pdf`,
          digest: scenario.digest,
          mimeType: scenario.mimeType,
          sizeBytes: scenario.bytes.byteLength,
        },
        jurisdiction: 'US',
        schemaVersion: '1.0.0',
      },
      {
        execution,
        deadlineAt: '2026-08-21T12:01:00.000Z',
        attempt: 1,
        idempotencyKey: `eval-${scenarioId}-v1`,
      },
    );
    validSchemas += 1;
    if (result.documentType === scenario.documentType) matchingDocumentTypes += 1;
    if (result.quality === scenario.extraction.quality) matchingQualities += 1;
    const expectedRoute =
      scenario.extraction.quality === 'UNREADABLE' || scenario.extraction.missingFields.length > 0
        ? 'MISSING_INFORMATION'
        : 'READY_FOR_CHECKS';
    const actualRoute =
      result.quality === 'UNREADABLE' || result.missingFields.length > 0 ? 'MISSING_INFORMATION' : 'READY_FOR_CHECKS';
    if (actualRoute === expectedRoute) matchingBranches += 1;

    for (const fieldName of fieldNames) {
      const expected = scenario.extraction.fields[fieldName].normalizedValue;
      const actual = result.fields[fieldName].normalizedValue;
      const presence = fieldPresenceCounts[fieldName];
      if (expected !== null) {
        expectedValues += 1;
        if (actual === expected) exactValues += 1;
      }
      if (expected !== null && actual !== null) presence.truePositive += 1;
      if (expected === null && actual !== null) presence.falsePositive += 1;
      if (expected !== null && actual === null) presence.falseNegative += 1;
    }
  }

  const count = fixtureScenarioIds.length;
  const macroF1 =
    fieldNames.reduce((sum, fieldName) => {
      const { truePositive, falsePositive, falseNegative } = fieldPresenceCounts[fieldName];
      const denominator = 2 * truePositive + falsePositive + falseNegative;
      return sum + (denominator === 0 ? 1 : (2 * truePositive) / denominator);
    }, 0) / fieldNames.length;
  const metrics = {
    schemaValidity: validSchemas / count,
    documentTypeAccuracy: matchingDocumentTypes / count,
    qualityAccuracy: matchingQualities / count,
    normalizedExactMatch: exactValues / Math.max(1, expectedValues),
    fieldPresenceMacroF1: macroF1,
    branchAccuracy: matchingBranches / count,
  };
  return extractionEvalResultSchema.parse({
    evalId: 'extraction-accuracy-v1',
    dataset: 'synthetic-fixtures-v1',
    scenarios: count,
    ...metrics,
    passed: Object.values(metrics).every(metric => metric === 1),
  });
};
