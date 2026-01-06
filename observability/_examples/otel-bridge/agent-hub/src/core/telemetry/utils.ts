import {Exception} from '@opentelemetry/api';

export function asException(error: unknown): Exception {
  if (error instanceof Error) {
    return error;
  }

  /* v8 ignore next 15 */
  if (
    typeof error === 'object' &&
    error &&
    'message' in error &&
    'name' in error &&
    typeof error.message === 'string' &&
    typeof error.name === 'string'
  ) {
    return {
      message: error.message,
      name: error.name,
    };
  }
  return new Error(String(error));
}
