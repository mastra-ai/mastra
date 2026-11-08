import type { ToolAction, ToolExecutionContext } from '../tools/index.js';
import type { SandboxComputer } from '../workspace/index.js';
import type { ComputerSandbox } from './computers.js';

/** @experimental Runtime access supplied to an optional Computer hands extension. */
export interface ComputerHandsSession {
  computerId: string;
  sandbox: ComputerSandbox;
  computer: SandboxComputer;
  resourceId: string;
  threadId: string;
  state: Map<string, unknown>;
  runInput<T>(fn: () => Promise<T>): Promise<T>;
  port(port: number): Promise<{ url: string; headers: Record<string, string> } | null>;
  signal(kind: string, summary: string, attributes?: Record<string, string>): Promise<void>;
}

/** @experimental Narrow host surface for optional Computer hands implementations. */
export interface ComputerHandsHost {
  run<T>(context: ToolExecutionContext, fn: (session: ComputerHandsSession) => Promise<T>): Promise<T | string>;
  act<T>(context: ToolExecutionContext, fn: (computer: SandboxComputer) => Promise<T>): Promise<T | string>;
}

/** @experimental Adds provider-independent tools without owning Computer lifecycle or control state. */
export interface ComputerHandsExtension {
  tools(host: ComputerHandsHost): Record<string, ToolAction<any, any, any, any>>;
  release?(computerId: string, threadId: string): void;
  destroy?(computerId: string): void;
}
