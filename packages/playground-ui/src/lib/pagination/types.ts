export type PaginationParams = {
  limit?: number;
  offset?: number;
  duration?: number;
};

export type PaginationResult = {
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};
