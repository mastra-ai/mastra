export interface ApiError extends Error {
  message: string;
  status?: number;
}

export type ServerBundleOptions = {
  playground?: boolean;
  isDev?: boolean;
  tools: Record<string, any>;
};
