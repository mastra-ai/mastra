import type {
  Client,
  InitializeRequest,
  ModelId,
  NewSessionRequest,
  RequestPermissionRequest,
  RequestPermissionResponse,
} from '@agentclientprotocol/sdk';
import type { Workspace } from '@mastra/core/workspace';

export type CreateACPToolOptions = {
  /** Unique identifier for the Mastra tool. */
  id: string;
  /** Description shown to the model when it can call this tool. */
  description: string;
  /** ACP agent executable to spawn. */
  command: string;
  /** Arguments passed to the ACP agent executable. */
  args?: string[];
  /** Environment variables to merge with the current process environment. */
  env?: Record<string, string>;
  /** Working directory for the ACP agent process and ACP session. */
  cwd?: string;
  /** ACP session creation options. Defaults to cwd/process.cwd() and no MCP servers. */
  session?: Partial<NewSessionRequest>;
  /** ACP initialization options. Defaults to Mastra client info and protocol version. */
  initialize?: Partial<InitializeRequest>;
  /** ACP authentication method id to invoke after initialization. */
  authMethodId?: string;
  /** Keep the ACP process alive after tool execution. Defaults to true. */
  persistSession?: boolean;
  /**
   * Callback invoked when the ACP agent requests permission.
   * Defaults to auto-selecting the first permission option.
   */
  onPermissionRequest?: (request: RequestPermissionRequest) => Promise<RequestPermissionResponse>;
  /**
   * Customize the ACP client used to answer agent requests. Receives the default
   * client so it can be wrapped or extended, for example with `extMethod` and
   * `extNotification` handlers for agents that use extension methods.
   */
  createClient?: (defaultClient: Client) => Client;
  /** Workspace for the ACP agent process and ACP session. */
  workspace?: Workspace;
  /** Model ID to select after session creation via the ACP `session/set_model` method. */
  model?: ModelId;
};

export type ACPToolInput = {
  task: string;
};

export type ACPToolOutput = {
  output: string;
};
