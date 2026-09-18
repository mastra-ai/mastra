import { createHash } from 'node:crypto';

import { Agent } from '@mastra/core/agent';
import { z } from 'zod';

import {
  documentExtractionInputSchema,
  documentExtractionResultSchema,
  type DocumentExtractionInput,
  type DocumentExtractionResult,
  type MultimodalDocumentExtractionProvider,
} from '../../contracts/providers/document-extraction.js';
import type { DocumentStorage } from '../../contracts/providers/document-storage.js';
import type { ProviderExecutionContext } from '../../contracts/shared/execution-context.js';
import {
  ProviderError,
  ProviderMisconfiguredError,
  ProviderRateLimitedError,
  ProviderRejectedInputError,
  ProviderResultInvalidError,
  ProviderTimeoutError,
  ProviderUnavailableError,
  type ProviderCapabilities,
} from '../../contracts/shared/provider.js';
import type { Clock } from '../../contracts/technical/primitives.js';
import { loadDocumentExtractionPrompt } from '../../config/prompts/load-document-extraction-prompt.js';
import { extractedIdentitySchema } from '../../domain/documents.js';
import { SystemClock } from '../local/deterministic-primitives.js';
import { parseProviderBoundary } from '../local/provider-validation.js';

export type OpenAiExtractionPricing = Readonly<{
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  version: string;
}>;

const defaultPricing: OpenAiExtractionPricing = Object.freeze({
  inputUsdPerMillion: 0.2,
  outputUsdPerMillion: 1.2,
  version: 'openai-gpt-5.6-luna-2026-08-22',
});
const unpricedUsageVersion = 'unpriced-openai-extraction-v1';

const extractionWireSchema = z
  .object({
    documentType: z.enum(['PASSPORT', 'DRIVERS_LICENSE', 'STATE_ID', 'PROOF_OF_ADDRESS', 'UNKNOWN']),
    issuingCountry: z.string().length(2).nullable(),
    fields: extractedIdentitySchema,
    quality: z.enum(['READABLE', 'LOW_QUALITY', 'UNREADABLE']),
    missingFields: z.array(
      z.enum(['fullName', 'dateOfBirth', 'documentNumber', 'expirationDate', 'nationality', 'residentialAddress']),
    ),
    warnings: z.array(z.string().min(1).max(200)),
  })
  .strict();

type ExtractionWireResult = z.infer<typeof extractionWireSchema>;
type GenerateResult = Readonly<{
  object: unknown;
  totalUsage: Readonly<{
    inputTokens: number | undefined;
    outputTokens: number | undefined;
  }>;
}>;
type StructuredGenerator = (
  messages: Parameters<Agent['generate']>[0],
  options: Readonly<{ abortSignal: AbortSignal }>,
) => Promise<GenerateResult>;

const createGenerator = (modelId: string): StructuredGenerator => {
  const prompt = loadDocumentExtractionPrompt();
  const agent = new Agent({
    id: 'openai-document-extraction-agent',
    name: 'OpenAI Document Extraction Agent',
    instructions: `${prompt.system}\n${prompt.instructions}`,
    model: modelId,
    maxRetries: 0,
  });
  return async (messages, options) => {
    const result = await agent.generate<ExtractionWireResult>(messages, {
      structuredOutput: { schema: extractionWireSchema },
      abortSignal: options.abortSignal,
      maxSteps: 1,
      modelSettings: { maxOutputTokens: 1_200 },
      tracingOptions: { hideInput: true, hideOutput: true },
    });
    if (result.error !== undefined) throw result.error;
    return { object: result.object, totalUsage: result.totalUsage };
  };
};

const safeStatus = (error: unknown): number | undefined => {
  let current: unknown = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== 'object' || current === null) return undefined;
    const record = current as Record<PropertyKey, unknown>;
    for (const key of ['status', 'statusCode']) {
      const value = record[key];
      if (typeof value === 'number') return value;
    }
    const details = record.details;
    if (typeof details === 'object' && details !== null) {
      const status = (details as Record<PropertyKey, unknown>).status;
      if (typeof status === 'number') return status;
    }
    current = record.cause;
  }
  return undefined;
};

const estimatedCost = (inputUnits: number, outputUnits: number, pricing: OpenAiExtractionPricing): number =>
  Number(
    ((inputUnits * pricing.inputUsdPerMillion + outputUnits * pricing.outputUsdPerMillion) / 1_000_000).toFixed(8),
  );

export class OpenAiMultimodalDocumentExtractionProvider implements MultimodalDocumentExtractionProvider {
  readonly id = 'openai-multimodal';
  readonly capabilities = openAiMultimodalCapabilities;

  readonly #generate: StructuredGenerator;

  constructor(
    private readonly storage: DocumentStorage,
    private readonly modelId: string,
    private readonly clock: Clock = new SystemClock(),
    generator?: StructuredGenerator,
    private readonly pricing: OpenAiExtractionPricing = defaultPricing,
  ) {
    this.#generate = generator ?? createGenerator(modelId);
  }

  async extract(input: DocumentExtractionInput, context: ProviderExecutionContext): Promise<DocumentExtractionResult> {
    const identity = { providerId: this.id, operation: 'DOCUMENT_EXTRACTION' as const };
    const boundary = parseProviderBoundary(documentExtractionInputSchema, input, context, identity);
    const startedAt = this.clock.now();
    const deadlineAt = new Date(boundary.context.deadlineAt).getTime();
    const remainingMs = deadlineAt - startedAt.getTime();
    if (remainingMs <= 0) {
      throw new ProviderTimeoutError({
        ...identity,
        safeMessage: 'The document extraction provider timed out',
      });
    }

    const stored = await this.storage.open({
      tenantId: boundary.context.execution.tenantId,
      reference: boundary.input.document,
    });
    const digest = createHash('sha256').update(stored.bytes).digest('hex');
    if (digest !== boundary.input.document.digest || stored.bytes.byteLength !== boundary.input.document.sizeBytes) {
      throw new ProviderRejectedInputError({
        ...identity,
        safeMessage: 'The stored document does not match its opaque reference',
      });
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), remainingMs);
    try {
      const documentPart =
        boundary.input.document.mimeType === 'application/pdf'
          ? {
              type: 'file' as const,
              data: stored.bytes,
              mediaType: boundary.input.document.mimeType,
              filename: 'synthetic-document.pdf',
            }
          : {
              type: 'image' as const,
              image: stored.bytes,
              mediaType: boundary.input.document.mimeType,
            };
      const generated = await this.#generate(
        [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Jurisdiction: ${boundary.input.jurisdiction}. Document type hint: ${boundary.input.documentTypeHint ?? 'UNKNOWN'}. Extract only visible fields.`,
              },
              documentPart,
            ],
          },
        ],
        { abortSignal: abortController.signal },
      );
      const parsed = extractionWireSchema.safeParse(generated.object);
      if (!parsed.success) {
        throw new ProviderResultInvalidError({
          ...identity,
          safeMessage: 'The document extraction provider returned an invalid result',
        });
      }
      const observedInputUnits = generated.totalUsage.inputTokens;
      const observedOutputUnits = generated.totalUsage.outputTokens;
      const inputUnits = Math.max(0, observedInputUnits ?? 0);
      const outputUnits = Math.max(0, observedOutputUnits ?? 0);
      const usageIsComplete = observedInputUnits !== undefined && observedOutputUnits !== undefined;
      return documentExtractionResultSchema.parse({
        provider: {
          providerId: this.id,
          providerVersion: '1.0.0',
          capabilityRevision: '1',
          attempt: boundary.context.attempt,
          startedAt: startedAt.toISOString(),
          completedAt: this.clock.now().toISOString(),
          warnings: [],
        },
        ...parsed.data,
        usage: {
          inputUnits,
          outputUnits,
          estimatedCostUsd: usageIsComplete ? estimatedCost(inputUnits, outputUnits, this.pricing) : 0,
          priceVersion: usageIsComplete ? this.pricing.version : unpricedUsageVersion,
        },
      });
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (abortController.signal.aborted) {
        throw new ProviderTimeoutError({
          ...identity,
          safeMessage: 'The document extraction provider timed out',
        });
      }
      const status = safeStatus(error);
      if (status === 429) {
        throw new ProviderRateLimitedError({
          ...identity,
          safeMessage: 'The document extraction provider rate limit was reached',
        });
      }
      if (status === 401 || status === 403) {
        throw new ProviderMisconfiguredError({
          ...identity,
          safeMessage: 'The document extraction provider credentials were rejected',
          missingKeys: ['OPENAI_API_KEY'],
        });
      }
      if (status !== undefined && status >= 400 && status < 500) {
        throw new ProviderRejectedInputError({
          ...identity,
          safeMessage: 'The document extraction provider rejected the document',
        });
      }
      throw new ProviderUnavailableError({
        ...identity,
        safeMessage: 'The document extraction provider is unavailable',
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const openAiMultimodalCapabilities = Object.freeze({
  operations: ['DOCUMENT_EXTRACTION'],
  environments: ['demo-default', 'demo-strict'],
  externalNetwork: true,
  idempotent: true,
  supportedPiiModes: ['demo-default', 'demo-strict'],
  acceptedPii: ['DOCUMENT_CONTENT', 'DOCUMENT_METADATA'],
  documentMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  jurisdictions: ['US'],
} satisfies ProviderCapabilities);
