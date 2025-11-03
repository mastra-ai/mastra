export type PaginationParams = {
  perPage?: number;
  page?: number;
  duration?: number;
};

export type PaginationResult = {
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
};
