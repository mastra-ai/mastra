export interface ApiError extends Error {
  message: string;
  status?: number;
}
