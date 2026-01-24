export { LocalEdgeRouter } from './router';
export { RouteRegistry } from './registry';
export { PortManager } from './port-manager';
export { HealthChecker } from './health-checker';

export type { LocalEdgeRouterConfig, RoutingStrategy, LocalRoute } from './types';
export type { PortManagerConfig } from './port-manager';
export type { HealthCheckConfig } from './health-checker';

// Re-export core types for convenience
export type { EdgeRouterProvider, RouteConfig, RouteInfo, RouteHealthStatus, RouteStatus } from '@mastra/admin';
