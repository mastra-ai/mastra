export { getX402StationClient, type X402StationClient, type X402StationClientOptions } from './client.js';
export { createX402StationPreflightTool } from './preflight.js';
export { createX402StationForensicsTool } from './forensics.js';
export { createX402StationCatalogDecoysTool } from './decoys.js';
export {
  createX402StationWatchSubscribeTool,
  createX402StationWatchStatusTool,
  createX402StationWatchUnsubscribeTool,
} from './watch.js';
export { createX402StationTools } from './tools.js';

export {
  SignalSchema,
  PreflightInputSchema,
  ForensicsInputSchema,
  CatalogDecoysInputSchema,
  WatchSubscribeInputSchema,
  WatchSecretInputSchema,
  type PreflightInput,
  type ForensicsInput,
  type CatalogDecoysInput,
  type WatchSubscribeInput,
  type WatchSecretInput,
} from './schemas.js';

export type {
  Signal,
  PaymentReceipt,
  EndpointMetadata,
  PreflightResponse,
  ForensicsResponse,
  ForensicsHourBucket,
  CatalogDecoysResponse,
  CatalogDecoyEntry,
  WatchSubscribeResponse,
  WatchStatusResponse,
  WatchUnsubscribeResponse,
  WatchAlertSnapshot,
  PaidResponse,
} from './types.js';
