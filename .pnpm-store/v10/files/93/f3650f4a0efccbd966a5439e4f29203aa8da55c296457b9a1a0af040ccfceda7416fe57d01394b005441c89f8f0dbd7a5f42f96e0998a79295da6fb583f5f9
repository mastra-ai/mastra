import { DeepgramError } from "../errors";

export type VoidResponse = SuccessResponse | ErrorResponse;

interface SuccessResponse {
  error: null;
}

interface ErrorResponse {
  error: DeepgramError;
}
