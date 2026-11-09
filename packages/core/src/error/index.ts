export {
  ErrorCategory,
  ErrorDomain,
  MastraBaseError,
  MastraError,
  MastraNonRetryableError,
  getErrorFromUnknown,
  safeParseErrorObject,
} from '@internal/core/error';
export type { IErrorDefinition, MastraErrorJSON, SerializableError, SerializedError } from '@internal/core/error';
export { toPersistedErrorIdentity } from '../loop/shared/record-terminal-error-message';
export {
  classifyProviderError,
  PROVIDER_CALL_ERROR_NAME,
  providerErrorReason,
  providerModelId,
  providerRequestId,
} from './provider-error';
export type { ProviderFailureKind } from './provider-error';
