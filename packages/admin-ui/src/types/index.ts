export interface Team {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  userId: string;
  teamId: string;
  role: 'owner' | 'admin' | 'member';
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Deployment {
  id: string;
  name: string;
  slug: string;
  projectId: string;
  status: 'pending' | 'running' | 'stopped' | 'failed';
  publicUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Build {
  id: string;
  number: number;
  deploymentId: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
}

export interface EnvVar {
  key: string;
  value?: string;
  isSecret: boolean;
}

export interface Trace {
  id: string;
  name: string;
  duration: number;
  status: 'ok' | 'error';
  timestamp: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
}

export interface Metrics {
  totalRequests: number;
  successRate: number;
  avgLatency: number;
  p99Latency: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}
