// Re-export all API types
export * from './api';

// Legacy type aliases for backward compatibility with existing components
// These can be removed once all components are updated to use the new types

export interface EnvVar {
  key: string;
  value?: string;
  isSecret: boolean;
}

export interface LegacyMetrics {
  totalRequests: number;
  successRate: number;
  avgLatency: number;
  p99Latency: number;
}

export interface LegacyLogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
}

export interface LegacyTrace {
  id: string;
  name: string;
  duration: number;
  status: 'ok' | 'error';
  timestamp: string;
}
