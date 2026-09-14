import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';

import { saveWorkflowTool } from '../save-workflow.js';

export function createWorkflowBuilderAgentStub(mastra: Mastra, definition: unknown) {
  return {
    stream: async () => {
      const saved = await (saveWorkflowTool as any).execute(definition, {
        mastra,
        requestContext: new RequestContext(),
      });

      return {
        fullStream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'tool-call', payload: { toolName: 'save-workflow', args: definition } });
            controller.enqueue({ type: 'tool-result', payload: { toolName: 'save-workflow', result: saved } });
            controller.close();
          },
        }),
        text: Promise.resolve(`Built ${saved.id}.`),
      };
    },
  };
}
