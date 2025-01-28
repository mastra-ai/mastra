import { JSONSchema7 } from 'json-schema';
import { ZodSchema } from 'zod';

import { CoreMessage, OutputType } from '../llm/types';
import { ToolAction } from '../tools';

export type ToolsetsInput = Record<string, Record<string, ToolAction<any, any, any, any>>>;

export type ToolsInput = Record<string, ToolAction<any, any, any, any>>;

export interface AgentGenerateOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> {
  toolsets?: ToolsetsInput;
  resourceid?: string;
  context?: CoreMessage[];
  threadId?: string;
  runId?: string;
  onStepFinish?: (step: string) => void;
  maxSteps?: number;
  output?: OutputType | Z;
  temperature?: number;
}

export interface AgentStreamOptions<Z extends ZodSchema | JSONSchema7 | undefined = undefined> {
  toolsets?: ToolsetsInput;
  resourceid?: string;
  context?: CoreMessage[];
  threadId?: string;
  runId?: string;
  onFinish?: (result: string) => Promise<void> | void;
  onStepFinish?: (step: string) => void;
  maxSteps?: number;
  output?: OutputType | Z;
  temperature?: number;
}
