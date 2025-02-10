import { z } from 'zod';

import { IExecutionContext } from '../action';
import { Agent } from '../agent';
import { MastraMemory } from '../memory';
import { MastraVector } from '../vector';

export type StripUndefined<T> = T extends undefined ? never : T;
export interface MastraExecutionContext<TSchemaIn extends z.ZodSchema = any>
  extends IExecutionContext<z.infer<TSchemaIn>, any> {
  runId?: string;
  agents?: Record<string, Agent>;
  vectors?: Record<string, MastraVector>;
  memory?: MastraMemory;
}
