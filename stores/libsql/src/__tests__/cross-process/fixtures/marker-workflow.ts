/**
 * Evented workflow for the helper's worker-routing self-test.
 *
 * Both processes register this same workflow; whoever actually executes the
 * step appends its own pid to `logPath`. That makes "which process ran the
 * step" observable across the process boundary.
 */
import { appendFileSync } from 'node:fs';

import { createStep, createWorkflow } from '@mastra/core/workflows/evented';

const emptyObjectSchema = { type: 'object', properties: {}, additionalProperties: false } as const;

export function createMarkerWorkflow({
  id,
  logPath,
  onExecute,
}: {
  id: string;
  logPath: string;
  onExecute?: () => void;
}) {
  const step = createStep({
    id: 'marker',
    inputSchema: emptyObjectSchema,
    outputSchema: emptyObjectSchema,
    execute: async () => {
      appendFileSync(logPath, `${process.pid}\n`);
      onExecute?.();
      return {};
    },
  });

  return createWorkflow({ id, inputSchema: emptyObjectSchema, outputSchema: emptyObjectSchema }).then(step).commit();
}
