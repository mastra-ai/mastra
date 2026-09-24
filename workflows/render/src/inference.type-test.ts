import { z } from 'zod';
import { init, createMemoryPersistence } from './index.js';

const { createStep, createWorkflow } = init({
  workflowSlug: 'types',
  buildId: 'v1',
  persistence: createMemoryPersistence(),
});
const numberStep = createStep({
  id: 'number',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ label: z.string() }),
  execute: async context => {
    const value: number = context.inputData.value;
    // @ts-expect-error unsupported remote controls are absent from the factory context
    context.suspend({});
    // @ts-expect-error input inference is not any
    const invalid: string = context.inputData.value;
    return { label: String(value) };
  },
});
const workflow = createWorkflow({
  id: 'types',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ label: z.string() }),
})
  .then(numberStep)
  .commit();
const incompatible = createStep({
  id: 'string-only',
  inputSchema: z.string(),
  outputSchema: z.string(),
  execute: async ({ inputData }) => inputData,
});
// @ts-expect-error a string step cannot receive the previous step's object output
workflow.then(incompatible);
async function check() {
  const run = await workflow.createRun();
  // @ts-expect-error schema input requires a number
  await run.startAsync({ inputData: { value: 'wrong' } });
  const result = await run.start({ inputData: { value: 1 } });
  if (result.status === 'success') {
    const label: string = result.result.label;
    // @ts-expect-error output inference is not any
    const invalid: number = result.result.label;
    void label;
    void invalid;
  }
}
void check;
