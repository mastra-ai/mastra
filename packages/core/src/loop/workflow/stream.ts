import z from 'zod';
import type { ChunkType } from '../../stream/types';
import { createWorkflow } from '../../workflows';
import { getRootSpan } from '../telemetry';
import type { LoopRun } from '../types';
import { llmIterationOutputSchema } from './schema';

export function workflowLoopStream({ telemetry_settings, model, toolChoice }: LoopRun) {
  return new ReadableStream<ChunkType>({
    start: async _controller => {
      let stepCount = 1;

      const { rootSpan } = getRootSpan({
        operationId: `mastra.stream.model.aisdk`,
        model,
        telemetry_settings,
      });

      rootSpan.setAttributes({
        ...(telemetry_settings?.recordInputs !== false
          ? {
              'stream.prompt.toolChoice': toolChoice ? JSON.stringify(toolChoice) : 'auto',
            }
          : {}),
      });

      const mainWorkflow = createWorkflow({
        id: 'agentic-loop',
        inputSchema: llmIterationOutputSchema,
        outputSchema: z.any(),
      });

      console.log({
        mainWorkflow,
        stepCount,
      });
    },
  });
}
