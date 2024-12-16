interface Metadata {
  run: {
    status: string;
  };
}

export interface Log {
  logId: string;
  statusCode: number;
  message: string;
  metadata: Metadata;
  createdAt: string;
}
