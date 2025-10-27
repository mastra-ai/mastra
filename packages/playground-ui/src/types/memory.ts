export interface MemorySearchResult {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  threadId?: string;
  threadTitle?: string;
  context?: {
    before?: Array<{
      id: string;
      role: string;
      content: string;
      createdAt: string;
    }>;
    after?: Array<{
      id: string;
      role: string;
      content: string;
      createdAt: string;
    }>;
  };
}

export interface MemorySearchResponse {
  results: MemorySearchResult[];
  count: number;
  query: string;
  searchType?: string;
  searchScope?: 'thread' | 'resource';
}

export interface MemorySearchParams {
  lastMessages?: number | false;
  // Add other memory config overrides as needed
}
