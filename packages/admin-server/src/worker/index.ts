/**
 * Background worker implementations for AdminServer.
 *
 * These workers run in the background to process builds and monitor server health:
 *
 * - `BuildWorker` - Processes the build queue, running builds and deploying artifacts
 * - `HealthCheckWorker` - Monitors running servers, checking health and resource usage
 *
 * Both workers integrate with the WebSocket server to broadcast real-time updates.
 *
 * @example
 * ```typescript
 * import { BuildWorker, HealthCheckWorker } from '@mastra/admin-server/worker';
 *
 * // Workers are typically managed by AdminServer, but can be used standalone
 * const buildWorker = new BuildWorker({
 *   admin,
 *   wsServer,
 *   intervalMs: 5000,
 * });
 *
 * const healthWorker = new HealthCheckWorker({
 *   admin,
 *   wsServer,
 *   intervalMs: 30000,
 * });
 *
 * // Start workers
 * buildWorker.start();
 * healthWorker.start();
 *
 * // Stop workers gracefully
 * await buildWorker.stop();
 * await healthWorker.stop();
 * ```
 */

export { BuildWorker } from './build-worker';
export type { BuildWorkerConfig } from './build-worker';

export { HealthCheckWorker } from './health-checker';
export type { HealthCheckWorkerConfig, ServerHealthDetails } from './health-checker';
