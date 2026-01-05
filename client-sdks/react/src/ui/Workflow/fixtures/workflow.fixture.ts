import { GetWorkflowResponse } from '@mastra/client-js';

export const workflowFixture: GetWorkflowResponse = {
  name: 'complex-workflow',
  steps: {
    'add-letter': {
      id: 'add-letter',
      description: 'Adds a letter to the input text',
      inputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
    },
    'add-letter-b': {
      id: 'add-letter-b',
      description: 'Adds B letter to the input text',
      inputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
    },
    'add-letter-c': {
      id: 'add-letter-c',
      description: 'Adds C letter to the input text',
      inputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
    },
    'short-text': {
      id: 'short-text',
      description: 'Step for short text (used in conditional branching)',
      inputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
    },
    'long-text': {
      id: 'long-text',
      description: 'Step for long text (used in conditional branching)',
      inputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
    },
    'nested-text-processor': {
      id: 'nested-text-processor',
      description: 'Nested workflow that processes text',
      inputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      component: 'WORKFLOW',
    },
    'add-letter-with-count': {
      id: 'add-letter-with-count',
      description: 'Adds a letter and tracks iteration count',
      inputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"},"iterationCount":{"type":"number"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"},"iterationCount":{"type":"number"}},"required":["text","iterationCount"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
    },
    'suspend-resume': {
      id: 'suspend-resume',
      description: 'Suspend/resume step - requires user input',
      inputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"},"iterationCount":{"type":"number"}},"required":["text","iterationCount"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      resumeSchema:
        '{"json":{"type":"object","properties":{"userInput":{"type":"string"}},"required":["userInput"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      suspendSchema:
        '{"json":{"type":"object","properties":{"reason":{"type":"string"}},"required":["reason"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
    },
    'final-step': {
      id: 'final-step',
      description: 'Final step',
      inputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
    },
  },
  allSteps: {
    'add-letter': {
      id: 'add-letter',
      description: 'Adds a letter to the input text',
      inputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      isWorkflow: false,
    },
    'add-letter-b': {
      id: 'add-letter-b',
      description: 'Adds B letter to the input text',
      inputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      isWorkflow: false,
    },
    'add-letter-c': {
      id: 'add-letter-c',
      description: 'Adds C letter to the input text',
      inputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      isWorkflow: false,
    },
    'short-text': {
      id: 'short-text',
      description: 'Step for short text (used in conditional branching)',
      inputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      isWorkflow: false,
    },
    'long-text': {
      id: 'long-text',
      description: 'Step for long text (used in conditional branching)',
      inputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      isWorkflow: false,
    },
    'nested-text-processor': {
      id: 'nested-text-processor',
      description: 'Nested workflow that processes text',
      inputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      isWorkflow: true,
      component: 'WORKFLOW',
    },
    'nested-text-processor.add-letter-clone-nested': {
      id: 'add-letter-clone-nested',
      description: 'Adds a letter to the input text',
      inputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      isWorkflow: false,
    },
    'nested-text-processor.add-letter-b-clone-nested': {
      id: 'add-letter-b-clone-nested',
      description: 'Adds B letter to the input text',
      inputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      isWorkflow: false,
    },
    'add-letter-with-count': {
      id: 'add-letter-with-count',
      description: 'Adds a letter and tracks iteration count',
      inputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"},"iterationCount":{"type":"number"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"},"iterationCount":{"type":"number"}},"required":["text","iterationCount"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      isWorkflow: false,
    },
    'suspend-resume': {
      id: 'suspend-resume',
      description: 'Suspend/resume step - requires user input',
      inputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"},"iterationCount":{"type":"number"}},"required":["text","iterationCount"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      resumeSchema:
        '{"json":{"type":"object","properties":{"userInput":{"type":"string"}},"required":["userInput"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      suspendSchema:
        '{"json":{"type":"object","properties":{"reason":{"type":"string"}},"required":["reason"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      isWorkflow: false,
    },
    'final-step': {
      id: 'final-step',
      description: 'Final step',
      inputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      isWorkflow: false,
    },
  },
  stepGraph: [
    {
      type: 'step',
      step: {
        id: 'add-letter',
        description: 'Adds a letter to the input text',
      },
    },
    {
      type: 'parallel',
      steps: [
        {
          type: 'step',
          step: {
            id: 'add-letter-b',
            description: 'Adds B letter to the input text',
          },
        },
        {
          type: 'step',
          step: {
            id: 'add-letter-c',
            description: 'Adds C letter to the input text',
          },
        },
      ],
    },
    {
      type: 'step',
      step: {
        id: 'mapping_988af47f-b9cc-4570-8d35-7c855d54cb68',
        mapConfig:
          'async ({ inputData }) => {\n  const { "add-letter-b": stepB, "add-letter-c": stepC } = inputData;\n  return { text: stepB.text + stepC.text };\n}',
      },
    },
    {
      type: 'conditional',
      steps: [
        {
          type: 'step',
          step: {
            id: 'short-text',
            description: 'Step for short text (used in conditional branching)',
          },
        },
        {
          type: 'step',
          step: {
            id: 'long-text',
            description: 'Step for long text (used in conditional branching)',
          },
        },
      ],
      serializedConditions: [
        {
          id: 'short-text-condition',
          fn: 'async ({ inputData: { text } }) => text.length <= 10',
        },
        {
          id: 'long-text-condition',
          fn: 'async ({ inputData: { text } }) => text.length > 10',
        },
      ],
    },
    {
      type: 'step',
      step: {
        id: 'mapping_80096365-dd95-43c6-8e03-c57065d9d93e',
        mapConfig:
          'async ({ inputData }) => {\n  const result = inputData["short-text"] || inputData["long-text"];\n  return { text: result.text };\n}',
      },
    },
    {
      type: 'step',
      step: {
        id: 'nested-text-processor',
        description: 'Nested workflow that processes text',
        component: 'WORKFLOW',
        serializedStepFlow: [
          {
            type: 'step',
            step: {
              id: 'add-letter-clone-nested',
              description: 'Adds a letter to the input text',
            },
          },
          {
            type: 'step',
            step: {
              id: 'add-letter-b-clone-nested',
              description: 'Adds B letter to the input text',
            },
          },
        ],
      },
    },
    {
      type: 'loop',
      step: {
        id: 'add-letter-with-count',
        description: 'Adds a letter and tracks iteration count',
      },
      serializedCondition: {
        id: 'add-letter-with-count-condition',
        fn: 'async ({ inputData: { text } }) => text.length >= 20',
      },
      loopType: 'dountil',
    },
    {
      type: 'step',
      step: {
        id: 'suspend-resume',
        description: 'Suspend/resume step - requires user input',
      },
    },
    {
      type: 'step',
      step: {
        id: 'final-step',
        description: 'Final step',
      },
    },
  ],
  inputSchema:
    '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
  outputSchema:
    '{"json":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
};
