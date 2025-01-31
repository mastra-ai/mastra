import { Integration } from '@mastra/core/integration';
import { createTool } from '@mastra/core/tools';
import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';

const step = new Step({
  id: 'test-one',
  execute: async props => {
    console.log(props);
    return {
      message: 'Hello World',
    };
  },
  inputSchema: z.object({
    name: z.string(),
  }),
  outputSchema: z.object({
    message: z.string(),
  }),
});

const workflow = new Workflow({
  name: 'test',
  triggerSchema: z.object({
    name: z.string(),
  }),
});

workflow.then(step);

export class SampleIntegration extends Integration {
  constructor() {
    super();

    this.registerWorkflow('SAMPLE_WORKFLOW', workflow);
  }

  getStaticTools() {
    return {
      SAMPLE_TOOL: createTool({
        id: 'Sample Tool',
        execute: async props => {
          console.log(props);
          return {
            message: 'Hello World',
          };
        },
        description: 'Sample Tool Description',
        inputSchema: z.object({}),
        outputSchema: z.object({
          message: z.string(),
        }),
      }),
    };
  }

  async getTools(_params: void) {
    return {
      SOME_OTHER_TOOL: createTool({
        id: 'Some Other Tool',
        execute: async props => {
          console.log(props);
          return {
            message: 'Hello World',
          };
        },
        description: 'Some Other Tool Description',
        inputSchema: z.object({}),
        outputSchema: z.object({
          message: z.string(),
        }),
      }),
    };
  }
}

