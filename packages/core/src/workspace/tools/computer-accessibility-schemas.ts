import { z } from 'zod/v4';

/** Shape of a snapshot-scoped accessibility ref: `<generation>.<snapshot>.<node>`. */
export const accessibilityRefSchema = z
  .string()
  .max(40)
  .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[0-9]{1,6}$/)
  .describe('Node ref from the most recent accessibility tree read (e.g. "g1.s3.42")');
