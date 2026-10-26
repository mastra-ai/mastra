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
