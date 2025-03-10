import type { CoreMessage, LanguageModelV1, TelemetrySettings } from 'ai';
import type { Agent } from '../agent';
import type { NetworkState } from './state';

/**
 * Configuration for creating a Network
 */
export interface NetworkConfig<TAgents extends Agent[] = Agent[]> {
  /**
   * Name of the network
   */
  name: string;

  /**
   * Array of agents that can be used in the network
   */
  agents: TAgents;

  /**
   * Language model to use for routing decisions
   */
  routingModel: LanguageModelV1;

  /**
   * Optional maximum number of steps to prevent infinite loops
   * @default 10
   */
  maxSteps?: number;

  /**
   * Optional initial state to initialize the network with
   */
  initialState?: NetworkState;

  /**
   * Instructions for the router
   */
  instructions?: string;
}

/**
 * Network run options
 * @deprecated Use NetworkOptions instead
 */
export interface NetworkRunOptions {
  /**
   * Input prompt or message to start the network with
   */
  input: string | CoreMessage[];

  /**
   * Optional run ID for tracking
   */
  runId?: string;

  resourceId?: string;

  /**
   * Optional thread ID for memory/conversation context
   */
  threadId?: string;

  /**
   * Optional initial state to override the default state
   */
  initialState?: NetworkState;
}

/**
 * Network options for generate method
 */
export interface NetworkOptions {
  /**
   * Optional run ID for tracking
   */
  runId?: string;

  /**
   * Optional resource ID for tracking
   */
  resourceId?: string;

  /**
   * Optional thread ID for memory/conversation context
   */
  threadId?: string;

  /**
   * Optional initial state to override the default state
   */
  initialState?: NetworkState;

  /**
   * Optional maximum number of steps to prevent infinite loops
   * @default 10
   */
  maxSteps?: number;
}

/**
 * Network options for stream method
 */
export interface NetworkStreamOptions extends NetworkOptions {
  /**
   * Optional callback function that is called when a step is starting
   */
  onStepStart?: (agent: Agent, step: number) => void;

  /**
   * Optional callback function that is called when a step is finished
   */
  onStepFinish?: (result: NetworkStepResult) => void;

  /**
   * Optional telemetry settings
   */
  telemetry?: TelemetrySettings;
}

/**
 * Router state passed to router functions
 */
export interface RouterState {
  /**
   * Current state object containing all data
   */
  state: NetworkState;

  /**
   * Last agent execution result
   */
  lastResult?: any;

  /**
   * Number of agent calls made so far
   */
  callCount: number;

  /**
   * Input that started the network execution
   */
  input: string | CoreMessage[];
}

/**
 * Router function type definition
 */
export type RouterFunction<TAgents extends Agent[] = Agent[]> = (
  routerState: RouterState,
) => Promise<Agent | undefined> | Agent | undefined;

/**
 * Network step result
 */
export interface NetworkStepResult {
  /**
   * Agent that was executed
   */
  agent: string;

  /**
   * Input that was passed to the agent
   */
  input: any;

  /**
   * Output from the agent
   */
  output: any;

  /**
   * Timestamp of the step
   */
  timestamp: number;

  /**
   * Current step number
   */
  step: number;

  /**
   * Current state of the network
   */
  state: NetworkState;
}

/**
 * Network execution result
 */
export interface NetworkResult {
  /**
   * Final state of the network
   */
  state: NetworkState;

  /**
   * Output from the last agent that ran
   */
  output: any;

  /**
   * Number of steps executed
   */
  steps: number;

  /**
   * Execution history
   */
  history: {
    agent: string;
    input: any;
    output: any;
    timestamp: number;
  }[];
}

/**
 * Network stream result type
 */
export interface NetworkStreamResult {
  /**
   * Stream of text chunks from the network execution
   */
  textStream: ReadableStream<string>;

  /**
   * Promise that resolves to the final text result
   */
  text: Promise<string>;
}

/**
 * Available hook types for network events
 */
export enum NetworkHookType {
  BEFORE_NETWORK_RUN = 'beforeNetworkRun',
  AFTER_NETWORK_RUN = 'afterNetworkRun',
  ON_NETWORK_ERROR = 'onNetworkError',
  BEFORE_AGENT_CALL = 'beforeAgentCall',
  AFTER_AGENT_CALL = 'afterAgentCall',
  ON_AGENT_ERROR = 'onAgentError',
}
