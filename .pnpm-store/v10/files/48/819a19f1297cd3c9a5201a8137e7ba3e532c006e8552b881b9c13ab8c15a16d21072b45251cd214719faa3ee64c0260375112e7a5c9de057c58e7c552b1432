import { InngestFunction } from "../InngestFunction.js";
import { RegisterOptions } from "../../types.js";
import { Inngest } from "../Inngest.js";

//#region src/components/connect/types.d.ts
declare const DEFAULT_SHUTDOWN_SIGNALS: string[];
interface ConnectApp {
  client: Inngest.Like;
  functions?: Array<InngestFunction.Like>;
}
interface ConnectHandlerOptions extends RegisterOptions {
  apps: ConnectApp[];
  /**
   * InstanceId represents a stable identifier to be used for identifying connected SDKs.
   * This can be a hostname or other identifier that remains stable across restarts.
   *
   * If nil, this defaults to the current machine's hostname.
   */
  instanceId?: string;
  maxConcurrency?: number;
  /**
   * By default, connections will be gracefully shut down when the current
   * process receives a SIGINT or SIGTERM signal. Set this to an empty array to disable this behavior.
   */
  handleShutdownSignals?: string[];
  rewriteGatewayEndpoint?: (endpoint: string) => string;
}
interface WorkerConnection {
  connectionId: string;
  closed: Promise<void>;
  close: () => Promise<void>;
  state: ConnectionState;
}
declare enum ConnectionState {
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  RECONNECTING = "RECONNECTING",
  CLOSING = "CLOSING",
  CLOSED = "CLOSED",
}
//#endregion
export { ConnectApp, ConnectHandlerOptions, ConnectionState, DEFAULT_SHUTDOWN_SIGNALS, WorkerConnection };
//# sourceMappingURL=types.d.ts.map