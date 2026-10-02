import type {
  DocumentExtractionInput,
  DocumentExtractionResult,
  MultimodalDocumentExtractionProvider,
} from '../../contracts/providers/document-extraction.js';
import {
  documentExtractionInputSchema,
  documentExtractionResultSchema,
} from '../../contracts/providers/document-extraction.js';
import type { ProviderExecutionContext } from '../../contracts/shared/execution-context.js';
import {
  ProviderRejectedInputError,
  ProviderResultInvalidError,
  type ProviderCapabilities,
} from '../../contracts/shared/provider.js';
import type { Clock } from '../../contracts/technical/primitives.js';
import { fixtureDigests, getFixtureScenarioByDigest } from '../../fixtures/provider-scenarios.js';
import { SystemClock } from './deterministic-primitives.js';
import { providerTimestamp } from './provider-time.js';
import { executeProviderOperation, parseProviderBoundary, parseProviderResult } from './provider-validation.js';

export class FixtureDocumentExtractionProvider implements MultimodalDocumentExtractionProvider {
  readonly id = 'fixture';
  readonly capabilities = Object.freeze({
    operations: ['DOCUMENT_EXTRACTION'],
    environments: ['test', 'demo-default', 'demo-strict'],
    externalNetwork: false,
    idempotent: true,
    supportedPiiModes: ['demo-default', 'demo-strict'],
    acceptedPii: ['DOCUMENT_CONTENT', 'DOCUMENT_METADATA'],
    documentMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    jurisdictions: ['US'],
  } satisfies ProviderCapabilities);

  constructor(private readonly clock: Clock = new SystemClock()) {}

  async extract(input: DocumentExtractionInput, context: ProviderExecutionContext): Promise<DocumentExtractionResult> {
    const identity = {
      providerId: this.id,
      operation: 'DOCUMENT_EXTRACTION' as const,
    };
    return executeProviderOperation(identity, () => {
      const boundary = parseProviderBoundary(documentExtractionInputSchema, input, context, identity);
      const startedAt = providerTimestamp(this.clock, boundary.context, this.id, 'DOCUMENT_EXTRACTION');
      if (boundary.input.document.digest === fixtureDigests.invalid) {
        throw new ProviderResultInvalidError({
          ...identity,
          safeMessage: 'The fixture result is invalid',
        });
      }
      const scenario = getFixtureScenarioByDigest(boundary.input.document.digest);
      if (scenario === undefined) {
        throw new ProviderRejectedInputError({
          ...identity,
          safeMessage: 'The document is not a registered synthetic fixture',
        });
      }
      const completedAt = providerTimestamp(this.clock, boundary.context, this.id, 'DOCUMENT_EXTRACTION');
      return parseProviderResult(
        documentExtractionResultSchema,
        {
          provider: {
            providerId: this.id,
            providerVersion: '1.0.0',
            capabilityRevision: '1',
            attempt: boundary.context.attempt,
            startedAt,
            completedAt,
            warnings: [],
          },
          documentType: boundary.input.documentTypeHint ?? scenario.documentType,
          issuingCountry: 'US',
          fields: scenario.extraction.fields,
          quality: scenario.extraction.quality,
          missingFields: scenario.extraction.missingFields,
          warnings: scenario.extraction.warnings,
        },
        identity,
      );
    });
  }
}
