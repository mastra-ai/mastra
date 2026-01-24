// Main runner
export { LocalProcessRunner } from './runner';

// Types
export type {
  LocalProcessRunnerConfig,
  TrackedProcess,
  BuildContext,
  PackageManager,
  LogCollector,
} from './types';

// Components (for advanced use cases)
export { PortAllocator } from './port/allocator';
export { HealthChecker, type HealthCheckConfig } from './health/checker';
export { ProcessManager } from './process/manager';
export { ProjectBuilder, type BuilderConfig } from './build/builder';
export { SubdomainGenerator } from './subdomain/generator';
export { LogCollector as LogCollectorImpl } from './logs/collector';
export { RingBuffer, type LogEntry } from './logs/ring-buffer';

// Utilities
export { detectPackageManager, getInstallArgs, getBuildArgs, hasBuildScript } from './build/package-manager';
export { spawnCommand, runCommand, type SpawnOptions } from './process/spawner';
export { getProcessResourceUsage, cleanupResourceMonitor, type ResourceUsage } from './process/resource-monitor';
