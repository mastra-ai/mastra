interface Metadata {
  run: {
    status: string;
  };
}

export interface Log {
  message: string;
  metadata: Metadata;
  agentId: string;
  createdAt: string;
}
