export type CacheRequest =
  | {
      op: 'get';
      key: string;
    }
  | {
      op: 'set';
      key: string;
      keyPrefix: string;
      value: unknown;
      expiresAt: number | null;
    }
  | {
      op: 'listLength';
      key: string;
    }
  | {
      op: 'listPush';
      key: string;
      keyPrefix: string;
      value: unknown;
      expiresAt: number | null;
    }
  | {
      op: 'listFromTo';
      key: string;
      from: number;
      to: number;
    }
  | {
      op: 'delete';
      key: string;
    }
  | {
      op: 'clear';
      keyPrefix: string;
    }
  | {
      op: 'increment';
      key: string;
      keyPrefix: string;
      expiresAt: number | null;
    };

export type CacheResponse =
  | {
      ok: true;
      result?: unknown;
      hasMore?: boolean;
    }
  | {
      ok: false;
      error: string;
      code?: string;
      details?: Record<string, unknown>;
    };
