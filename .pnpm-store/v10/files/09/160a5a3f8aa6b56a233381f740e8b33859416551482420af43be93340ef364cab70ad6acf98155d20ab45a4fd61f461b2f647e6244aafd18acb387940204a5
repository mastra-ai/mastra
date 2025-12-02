import { DeepgramError } from "../errors";

export type DeepgramResponse<T> = SuccessResponse<T> | ErrorResponse;

interface SuccessResponse<T> {
  result: T;
  error: null;
}

interface ErrorResponse {
  result: null;
  error: DeepgramError;
}
