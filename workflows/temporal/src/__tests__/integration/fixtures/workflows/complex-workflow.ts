import { z } from 'zod';
import { createWorkflow } from '../temporal';
import { innerWorkflow } from './inner-workflow';
import { step1, step2, step3, step4 } from './steps';

export const complexWorkflow = createWorkflow({
  id: 'complex-workflow',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ result: z.string() }),
})
  .then(step1)
  .then(innerWorkflow)
  .parallel([step2, step3])
  .sleep(1000)
  .then(step4)
  .commit();
