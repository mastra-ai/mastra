export { LocalEdgeRouter } from './router';
export { RouteRegistry } from './registry';
export { PortManager } from './port-manager';
export { HealthChecker } from './health-checker';

// Optional feature exports
export { ProxyServer } from './proxy';
export { HostsManager } from './hosts';
export { TLSManager } from './tls';

export type { LocalEdgeRouterConfig, RoutingStrategy, LocalRoute } from './types';
export type { PortManagerConfig } from './port-manager';
export type { HealthCheckConfig } from './health-checker';

// Optional feature types
export type { ProxyServerConfig, ProxyTarget } from './proxy';
export type { HostsManagerConfig, HostsEntry, HostsOperationResult } from './hosts';
export type { TLSManagerConfig, CertificatePair, CertGenerationResult } from './tls';

// Re-export core types for convenience
export type { EdgeRouterProvider, RouteConfig, RouteInfo, RouteHealthStatus, RouteStatus } from '@mastra/admin';
