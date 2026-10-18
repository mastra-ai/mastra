import { z } from 'zod';

import { piiModeSchema } from '../../domain/context.js';
import { providerIdSchema, timestampSchema } from '../../domain/identifiers.js';

export const providerOperationSchema = z.enum([
  'DOCUMENT_EXTRACTION',
  'IDENTITY_VERIFICATION',
  'ADDRESS_VERIFICATION',
  'SANCTIONS_SCREENING',
  'PEP_SCREENING',
  'DOCUMENT_STORAGE',
  'NOTIFICATION',
  'WEBHOOK_PUBLICATION',
  'ACCOUNT_PROVISIONING',
  'POLICY_RESOLUTION',
  'RISK_EVALUATION',
]);

export const piiCategorySchema = z.enum([
  'NONE',
  'IDENTITY',
  'CONTACT',
  'ADDRESS',
  'DOCUMENT_METADATA',
  'DOCUMENT_CONTENT',
  'DOCUMENT_NUMBER',
  'DATE_OF_BIRTH',
  'SCREENING',
  'SECRET',
]);

export const providerCapabilitiesSchema = z
  .object({
    operations: z.array(providerOperationSchema).min(1),
    environments: z.array(z.enum(['test', 'demo-default', 'demo-strict', 'live'])).min(1),
    externalNetwork: z.boolean(),
    idempotent: z.boolean(),
    supportedPiiModes: z.array(piiModeSchema).min(1),
    acceptedPii: z.array(piiCategorySchema),
    documentMimeTypes: z.array(z.string()).default([]),
    jurisdictions: z.array(z.string().length(2)).default([]),
  })
  .strict();

export const providerExecutionMetadataSchema = z
  .object({
    providerId: providerIdSchema,
    providerVersion: z.string().min(1).max(64),
    capabilityRevision: z.string().min(1).max(64),
    attempt: z.number().int().positive(),
    startedAt: timestampSchema,
    completedAt: timestampSchema,
    warnings: z.array(z.string().min(1).max(200)),
  })
  .strict();

const providerErrorBase = {
  providerId: providerIdSchema,
  operation: providerOperationSchema,
  safeMessage: z.string().min(1).max(300),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
};

export const providerMisconfiguredErrorSchema = z
  .object({
    ...providerErrorBase,
    code: z.literal('PROVIDER_MISCONFIGURED'),
    retryable: z.literal(false),
    missingKeys: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const providerUnavailableErrorSchema = z
  .object({
    ...providerErrorBase,
    code: z.literal('PROVIDER_UNAVAILABLE'),
    retryable: z.literal(true),
  })
  .strict();

export const providerRateLimitedErrorSchema = z
  .object({
    ...providerErrorBase,
    code: z.literal('PROVIDER_RATE_LIMITED'),
    retryable: z.literal(true),
    retryAfterMs: z.number().int().positive().optional(),
  })
  .strict();

export const providerRejectedInputErrorSchema = z
  .object({
    ...providerErrorBase,
    code: z.literal('PROVIDER_REJECTED_INPUT'),
    retryable: z.literal(false),
  })
  .strict();

export const providerResultInvalidErrorSchema = z
  .object({
    ...providerErrorBase,
    code: z.literal('PROVIDER_RESULT_INVALID'),
    retryable: z.literal(false),
  })
  .strict();

export const providerTimeoutErrorSchema = z
  .object({
    ...providerErrorBase,
    code: z.literal('PROVIDER_TIMEOUT'),
    retryable: z.literal(true),
  })
  .strict();

export const providerNotImplementedErrorSchema = z
  .object({
    ...providerErrorBase,
    code: z.literal('PROVIDER_NOT_IMPLEMENTED'),
    retryable: z.literal(false),
  })
  .strict();

export const providerErrorSchema = z.discriminatedUnion('code', [
  providerMisconfiguredErrorSchema,
  providerUnavailableErrorSchema,
  providerRateLimitedErrorSchema,
  providerRejectedInputErrorSchema,
  providerResultInvalidErrorSchema,
  providerTimeoutErrorSchema,
  providerNotImplementedErrorSchema,
]);

export type ProviderOperation = z.infer<typeof providerOperationSchema>;
export type PiiCategory = z.infer<typeof piiCategorySchema>;
export type ProviderCapabilities = z.infer<typeof providerCapabilitiesSchema>;
export type ProviderExecutionMetadata = z.infer<typeof providerExecutionMetadataSchema>;
export type ProviderErrorDetails = z.infer<typeof providerErrorSchema>;

export class ProviderError extends Error {
  readonly details: ProviderErrorDetails;

  constructor(details: ProviderErrorDetails) {
    const parsed = providerErrorSchema.parse(details);
    super(parsed.safeMessage);
    this.name = new.target.name;
    this.details = parsed;
  }
}

type ErrorBaseInput = Readonly<{
  providerId: string;
  operation: ProviderOperation;
  safeMessage: string;
  metadata?: Record<string, string | number | boolean | null>;
}>;

const base = (input: ErrorBaseInput) => ({ ...input, metadata: input.metadata ?? {} });

export class ProviderMisconfiguredError extends ProviderError {
  constructor(input: ErrorBaseInput & { missingKeys: string[] }) {
    super({
      ...base(input),
      code: 'PROVIDER_MISCONFIGURED',
      retryable: false,
      missingKeys: input.missingKeys,
    });
  }
}

export class ProviderUnavailableError extends ProviderError {
  constructor(input: ErrorBaseInput) {
    super({ ...base(input), code: 'PROVIDER_UNAVAILABLE', retryable: true });
  }
}

export class ProviderRateLimitedError extends ProviderError {
  constructor(input: ErrorBaseInput & { retryAfterMs?: number }) {
    super({
      ...base(input),
      code: 'PROVIDER_RATE_LIMITED',
      retryable: true,
      ...(input.retryAfterMs === undefined ? {} : { retryAfterMs: input.retryAfterMs }),
    });
  }
}

export class ProviderRejectedInputError extends ProviderError {
  constructor(input: ErrorBaseInput) {
    super({ ...base(input), code: 'PROVIDER_REJECTED_INPUT', retryable: false });
  }
}

export class ProviderResultInvalidError extends ProviderError {
  constructor(input: ErrorBaseInput) {
    super({ ...base(input), code: 'PROVIDER_RESULT_INVALID', retryable: false });
  }
}

export class ProviderTimeoutError extends ProviderError {
  constructor(input: ErrorBaseInput) {
    super({ ...base(input), code: 'PROVIDER_TIMEOUT', retryable: true });
  }
}

export class ProviderNotImplementedError extends ProviderError {
  constructor(input: ErrorBaseInput) {
    super({ ...base(input), code: 'PROVIDER_NOT_IMPLEMENTED', retryable: false });
  }
}
