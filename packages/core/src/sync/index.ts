import { z } from 'zod';

import { Action, ActionParams } from '../action';

export function createSync<
  TId extends string = string,
  TSchemaIn extends z.ZodSchema = z.ZodSchema,
  TSchemaOut extends z.ZodSchema = z.ZodSchema,
>(opts: ActionParams<TId, TSchemaIn, TSchemaOut>) {
  return new Action(opts);
}
