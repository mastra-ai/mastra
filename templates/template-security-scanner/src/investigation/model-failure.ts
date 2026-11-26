import { z } from 'zod';
import { MastraError } from '@mastra/core/error';

const sdkBrands = {
  AI_TypeValidationError: 'MODEL_OUTPUT_INVALID',
  AI_JSONParseError: 'MODEL_OUTPUT_INVALID',
  AI_InvalidResponseDataError: 'MODEL_OUTPUT_INVALID',
  AI_NoObjectGeneratedError: 'MODEL_OUTPUT_INVALID',
  AI_APICallError: 'MODEL_PROVIDER_FAILED',
} as const;
/** Finite safe model-failure classification; unknown errors remain unknown. */
export type ModelFailureCode =
  | 'MODEL_OUTPUT_INVALID'
  | 'MODEL_PROVIDER_FAILED'
  | 'MODEL_TIMEOUT'
  | 'MODEL_FAILURE_UNKNOWN';

// Only fixed SDK brands, official Mastra error IDs and native types classify a failure. Never inspect messages,
// arbitrary names, stacks, response bodies or error serializations.
/** Map provider or parsing failures to bounded operational codes without retaining raw model errors. */
export function classifyModelFailure(error: unknown): {
  code: ModelFailureCode;
  sdkClass: string;
  httpStatus: number | null;
} {
  const seen = new Set<unknown>();
  let current = error;
  for (let depth = 0; depth < 4 && current instanceof Error && !seen.has(current); depth++) {
    seen.add(current);
    if (current instanceof MastraError && current.id === 'STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED')
      return { code: 'MODEL_OUTPUT_INVALID', sdkClass: 'MastraError', httpStatus: null };
    if (current instanceof z.ZodError) return { code: 'MODEL_OUTPUT_INVALID', sdkClass: 'ZodError', httpStatus: null };
    if (current instanceof DOMException && current.name === 'TimeoutError')
      return { code: 'MODEL_TIMEOUT', sdkClass: 'TimeoutError', httpStatus: null };
    for (const [name, code] of Object.entries(sdkBrands)) {
      if (Object.getOwnPropertyDescriptor(current, Symbol.for(`vercel.ai.error.${name}`))?.value === true) {
        const status = Object.getOwnPropertyDescriptor(current, 'statusCode')?.value;
        return {
          code,
          sdkClass: name,
          httpStatus: Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
        };
      }
    }
    current = Object.getOwnPropertyDescriptor(current, 'cause')?.value;
  }
  return { code: 'MODEL_FAILURE_UNKNOWN', sdkClass: 'UNKNOWN', httpStatus: null };
}
