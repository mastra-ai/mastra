import { z } from 'zod';
import { FilterOperators } from './types';
import {
  transformFilterValueArray,
  transformFilterValueBoolean,
} from './utils';

type ValueOf<T> = Required<T>[keyof T];

export const filterQuerySchema = z.object<
  Record<ValueOf<typeof FilterOperators>, any>
>({
  is: z.array(z.string()).or(z.string()).optional(),
  eq: z.array(z.string()).or(z.string()).optional(),
  not_eq: z.array(z.string()).or(z.string()).optional(),
  contains: z.array(z.string()).or(z.string()).optional(),
  not_contains: z.array(z.string()).or(z.string()).optional(),
  gt: z.array(z.string()).or(z.string()).optional(),
  gte: z.array(z.string()).or(z.string()).optional(),
  lt: z.array(z.string()).or(z.string()).optional(),
  lte: z.array(z.string()).or(z.string()).optional(),
  in: z.array(z.string()).or(z.string()).optional(),
  not_in: z.array(z.string()).or(z.string()).optional(),
  op: z.enum(['or', 'and']).optional().default('or'),
  set: z.string().optional().transform(transformFilterValueBoolean),
  not_set: z.string().optional().transform(transformFilterValueBoolean),
});

export const sortQuerySchema = z.string().transform(transformFilterValueArray);
