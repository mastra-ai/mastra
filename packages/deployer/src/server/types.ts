export interface ApiError extends Error {
  message: string;
  status?: number;
}

export type ServerBundleOptions = {
  playground?: boolean;
  swaggerUI?: boolean;
  apiReqLogs?: boolean;
  openapi?: boolean;
};
