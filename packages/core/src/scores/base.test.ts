import { describe, it, expect, beforeEach } from 'vitest';
import {
  AsyncFunctionBasedScorerBuilders,
  FunctionBasedScorerBuilders,
  MixedScorerBuilders,
  PromptBasedScorerBuilders,
} from './base.test-utils';

const createTestData = () => ({
  inputText: 'test input',
  outputText: 'test output',
  get userInput() {
    return [{ role: 'user', content: this.inputText }];
  },
  get agentOutput() {
    return { role: 'assistant', text: this.outputText };
  },
  get scoringInput() {
    return { input: this.userInput, output: this.agentOutput };
  },
});

describe('createScorer', () => {
  let testData: ReturnType<typeof createTestData>;

  beforeEach(() => {
    testData = createTestData();
  });

  describe('Steps as functions scorer', () => {
    it('should create a basic scorer with functions', async () => {
      const scorer = FunctionBasedScorerBuilders.basic;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with reason', async () => {
      const scorer = FunctionBasedScorerBuilders.withReason;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with preprocess and reason', async () => {
      const scorer = FunctionBasedScorerBuilders.withPreprocessAndReason;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with preprocess and analyze', async () => {
      const scorer = FunctionBasedScorerBuilders.withPreprocessAndAnalyze;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with preprocess only', async () => {
      const scorer = FunctionBasedScorerBuilders.withPreprocess;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with preprocess, analyze, and reason', async () => {
      const scorer = FunctionBasedScorerBuilders.withPreprocessAndAnalyzeAndReason;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with analyze only', async () => {
      const scorer = FunctionBasedScorerBuilders.withAnalyze;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('should create a scorer with analyze and reason', async () => {
      const scorer = FunctionBasedScorerBuilders.withAnalyzeAndReason;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });
  });

  describe('Steps as prompt objects scorer', () => {
    it('with analyze prompt object', async () => {
      const scorer = PromptBasedScorerBuilders.withAnalyze;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with preprocess and analyze prompt object', async () => {
      const scorer = PromptBasedScorerBuilders.withPreprocessAndAnalyze;

      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with analyze and reason prompt object', async () => {
      const scorer = PromptBasedScorerBuilders.withAnalyzeAndReason;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(typeof result.reason).toBe('string');
      expect(result).toMatchSnapshot();
    });

    it('with generate score as prompt object', async () => {
      const scorer = PromptBasedScorerBuilders.withGenerateScoreAsPromptObject;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with all steps', async () => {
      const scorer = PromptBasedScorerBuilders.withAllSteps;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });
  });

  describe('Mixed scorer', () => {
    it('with preprocess function and analyze prompt object', async () => {
      const scorer = MixedScorerBuilders.withPreprocessFunctionAnalyzePrompt;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with preprocess prompt and analyze function', async () => {
      const scorer = MixedScorerBuilders.withPreprocessPromptAnalyzeFunction;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with reason function and analyze prompt', async () => {
      const scorer = MixedScorerBuilders.withReasonFunctionAnalyzePrompt;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with reason prompt and analyze function', async () => {
      const scorer = MixedScorerBuilders.withReasonPromptAnalyzeFunction;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });
  });

  describe('Async scorer', () => {
    it('with basic', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.basic;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with preprocess', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withPreprocess;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with preprocess function and analyze as prompt object', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withPreprocessFunctionAndAnalyzePromptObject;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with preprocess prompt object and analyze function', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withPreprocessPromptObjectAndAnalyzeFunction;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with async createPrompt in preprocess', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withAsyncCreatePromptInPreprocess;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with async createPrompt in analyze', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withAsyncCreatePromptInAnalyze;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with async createPrompt in generateScore', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withAsyncCreatePromptInGenerateScore;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });

    it('with async createPrompt in generateReason', async () => {
      const scorer = AsyncFunctionBasedScorerBuilders.withAsyncCreatePromptInGenerateReason;
      const { runId, ...result } = await scorer.run(testData.scoringInput);

      expect(runId).toBeDefined();
      expect(result).toMatchSnapshot();
    });
  });

  describe('AI Tracing', () => {
    const sampleAgentRunSpanType = {
      traceId: 'c182deec99361334dfb9ee093974264c',
      spanId: '239754a98fb27925',
      parentSpanId: null,
      name: "agent run: 'Chef Agent'",
      scope: null, // Mastra package info {"core-version": "0.1.0"}
      spanType: 'agent_run', // WORKFLOW_RUN, WORKFLOW_STEP, AGENT_RUN, AGENT_STEP, TOOL_RUN, TOOL_STEP, etc.
      attributes: {
        agentId: 'Chef Agent',
        instructions:
          '\n    YOU MUST USE THE TOOL cooking-tool\n    You are Michel, a practical and experienced home chef who helps people cook great meals with whatever\n    ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes.\n    You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.\n    ',
        availableTools: [],
      },
      metadata: { runId: 'chefAgent', resourceId: 'chefAgent', threadId: '4592b750-5db6-4247-89a3-f9b556e28dce' },
      links: null,
      input: { messages: [{ role: 'user', content: 'what is the weather in seattle' }] },
      output: {
        text: "The weather in Seattle is sunny with a temperature of 19°C (66°F). The humidity is at 50%, and there's a light wind blowing at 10 mph. It sounds like a lovely day! \n\nIf you're planning to enjoy your tuna salad sandwich outside, it should be a great time for it! Let me know if you need anything else.",
        files: [],
      },
      error: null,
      startedAt: new Date('2025-09-12T17:33:45.849Z'), // When the span started
      endedAt: new Date('2025-09-12T17:33:48.542Z'), // When the span ended
      createdAt: new Date('2025-09-12T17:33:50.863Z'), // The time the database record was created
      updatedAt: new Date('2025-09-12T17:33:50.864Z'), // The time the database record was last updated
      isEvent: false,
    };

    const sampleLLMGenerationSpanType = {
      traceId: 'c182deec99361334dfb9ee093974264c',
      spanId: '2c6253051ab471f1',
      parentSpanId: '239754a98fb27925',
      name: "llm: 'gpt-4o-mini'",
      scope: null, // Mastra package info {"core-version": "0.1.0"}
      spanType: 'llm_generation', // WORKFLOW_RUN, WORKFLOW_STEP, AGENT_RUN, AGENT_STEP, TOOL_RUN, TOOL_STEP, etc.
      attributes: {
        model: 'gpt-4o-mini',
        provider: 'openai.chat',
        parameters: { maxOutputTokens: '[REDACTED]' },
        streaming: true,
        finishReason: 'stop',
        usage: { promptTokens: '[REDACTED]', completionTokens: '[REDACTED]', totalTokens: '[REDACTED]' },
      },
      metadata: { runId: 'chefAgent', threadId: '4592b750-5db6-4247-89a3-f9b556e28dce', resourceId: 'chefAgent' },
      links: null,
      input: {
        messages: [
          {
            role: 'system',
            content:
              '\n    YOU MUST USE THE TOOL cooking-tool\n    You are Michel, a practical and experienced home chef who helps people cook great meals with whatever\n    ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes.\n    You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.\n    ',
          },
          { role: 'user', content: [{ type: 'text', text: 'hey' }] },
          {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: "Hello! How can I assist you in the kitchen today? Do you have any ingredients in mind or a specific dish you'd like to make?",
              },
            ],
          },
          { role: 'user', content: [{ type: 'text', text: 'yes I would like to make a tuna salad sandwhich' }] },
          {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: "Great choice! Tuna salad sandwiches are delicious and easy to make. What ingredients do you have on hand? For example, do you have canned tuna, mayonnaise, bread, and any vegetables like lettuce, tomatoes, or onions? Let me know what you have, and I'll help you put it all together!",
              },
            ],
          },
          { role: 'user', content: [{ type: 'text', text: 'I have tuna. olive oil, egg, salt, bread' }] },
          {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'Perfect! You can make a simple and tasty tuna salad sandwich with those ingredients. Here’s a quick recipe for you:\n\n### Ingredients:\n- Canned tuna\n- Olive oil\n- Egg (you can hard-boil it)\n- Salt\n- Bread\n\n### Instructions:\n\n1. **Hard-Boil the Egg:**\n   - Place the egg in a pot and cover it with water. Bring it to a boil, then reduce the heat and let it simmer for about 9-12 minutes. Once done, cool it under cold running water, then peel and chop it.\n\n2. **Prepare the Tuna Salad:**\n   - In a bowl, combine the canned tuna (drained) with a drizzle of olive oil and a pinch of salt. \n   - Add the chopped hard-boiled egg to the bowl and mix everything together until well combined.\n\n3. **Assemble the Sandwich:**\n   - Take your bread and spread the tuna salad mixture on one slice. You can add another slice on top to make it a sandwich.\n\n4. **Optional: Toast the Bread:**\n   - If you like, you can toast the bread in a pan with a little olive oil for extra flavor and crunch.\n\n5. **Serve:**\n   - Cut the sandwich in half and enjoy!\n\nFeel free to customize it with any additional ingredients you might have, like lettuce or tomatoes. Enjoy your meal! If you have any questions or need further assistance, just let me know!',
              },
            ],
          },
          { role: 'user', content: [{ type: 'text', text: 'can you use the recipe maker tool' }] },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_BmBI99fBcZex6X5XoNq7HSig',
                toolName: 'myWorkflow',
                args: { ingredient: 'tuna' },
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_BmBI99fBcZex6X5XoNq7HSig',
                toolName: 'myWorkflow',
                result: {
                  result: { status: 'success', result: { result: 'suh' }, traceId: '6f16985ee3d50f37b8df7f042975fd07' },
                  runId: 'e23de6c8-888c-410c-9568-88835ba48836',
                },
              },
            ],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: "It seems there was an issue with the recipe maker tool. However, I can still help you with the tuna salad sandwich recipe! \n\nHere's a recap of the steps:\n\n### Tuna Salad Sandwich Recipe\n\n#### Ingredients:\n- Canned tuna\n- Olive oil\n- 1 hard-boiled egg\n- Salt\n- Bread\n\n#### Instructions:\n1. **Hard-Boil the Egg:**\n   - Boil the egg for 9-12 minutes, then cool and chop it.\n\n2. **Make the Tuna Salad:**\n   - In a bowl, mix drained tuna with olive oil and salt. Add the chopped egg and combine.\n\n3. **Assemble the Sandwich:**\n   - Spread the tuna salad on a slice of bread and top with another slice.\n\n4. **Optional Toasting:**\n   - Toast the sandwich in a pan with olive oil for extra crunch.\n\n5. **Serve and Enjoy!**\n\nIf you have any other questions or need more help, feel free to ask!",
              },
            ],
          },
          { role: 'user', content: [{ type: 'text', text: 'what is the weather in seattle' }] },
        ],
      },
      output: {
        text: "The weather in Seattle is sunny with a temperature of 19°C (66°F). The humidity is at 50%, and there's a light wind blowing at 10 mph. It sounds like a lovely day! \n\nIf you're planning to enjoy your tuna salad sandwich outside, it should be a great time for it! Let me know if you need anything else.",
        reasoning: [],
        files: [],
        sources: [],
        warnings: [],
      },
      error: null,
      startedAt: new Date('2025-09-12T17:33:45.869Z'), // When the span started
      endedAt: new Date('2025-09-12T17:33:48.543Z'), // When the span ended
      createdAt: new Date('2025-09-12T17:33:50.863Z'), // The time the database record was created
      updatedAt: new Date('2025-09-12T17:33:50.864Z'), // The time the database record was last updated
      isEvent: false,
    };

    const sampleToolCallSpanType = {
      traceId: 'c182deec99361334dfb9ee093974264c',
      spanId: '13cde9c86fa99e37',
      parentSpanId: '239754a98fb27925',
      name: "tool: 'weatherInfo'",
      scope: null, // Mastra package info {"core-version": "0.1.0"}
      spanType: 'tool_call', // WORKFLOW_RUN, WORKFLOW_STEP, AGENT_RUN, AGENT_STEP, TOOL_RUN, TOOL_STEP, etc.
      attributes: {
        toolId: 'weatherInfo',
        toolDescription: 'Fetches the current weather information for a given city',
        toolType: 'tool',
      },
      metadata: null,
      links: null,
      input: { city: 'Seattle' },
      output: {
        city: 'Seattle',
        weather: 'sunny',
        temperature_celsius: 19,
        temperature_fahrenheit: 66,
        humidity: 50,
        wind: '10 mph',
      },
      error: null,
      startedAt: new Date('2025-09-12T17:33:46.613Z'), // When the span started
      endedAt: new Date('2025-09-12T17:33:46.617Z'), // When the span ended
      createdAt: new Date('2025-09-12T17:33:50.863Z'), // The time the database record was created
      updatedAt: new Date('2025-09-12T17:33:50.864Z'), // The time the database record was last updated
      isEvent: false,
    };

    const WorkflowRunSpanType = {
      traceId: '6182b62e81cba47bbe79e9377eb72cbe',
      spanId: '8eff56460ee3e82c',
      parentSpanId: null,
      name: "workflow run: 'recipe-maker'",
      scope: null, // Mastra package info {"core-version": "0.1.0"}
      spanType: 'workflow_run', // WORKFLOW_RUN, WORKFLOW_STEP, AGENT_RUN, AGENT_STEP, TOOL_RUN, TOOL_STEP, etc.
      attributes: { workflowId: 'recipe-maker' },
      metadata: {},
      links: null,
      input: { ingredient: 'avocado' },
      output: { result: 'suh' },
      error: null,
      startedAt: new Date('2025-09-12T17:33:46.613Z'), // When the span started
      endedAt: new Date('2025-09-12T17:33:46.617Z'), // When the span ended
      createdAt: new Date('2025-09-12T17:33:50.863Z'), // The time the database record was created
      updatedAt: new Date('2025-09-12T17:33:50.864Z'), // The time the database record was last updated
      isEvent: false,
    };

    const WorkflowStepSpanTypeFirstStep = {
      traceId: '6182b62e81cba47bbe79e9377eb72cbe',
      spanId: 'f7bb90126160558b',
      parentSpanId: '8eff56460ee3e82c',
      name: "workflow step: 'my-step'",
      scope: null, // Mastra package info {"core-version": "0.1.0"}
      spanType: 'workflow_step', // WORKFLOW_RUN, WORKFLOW_STEP, AGENT_RUN, AGENT_STEP, TOOL_RUN, TOOL_STEP, etc.
      attributes: { stepId: 'my-step', status: 'success' },
      metadata: null,
      links: null,
      input: { ingredient: 'avocado' },
      output: { result: 'avocado' },
      error: null,
      startedAt: new Date('2025-09-12T17:59:06.398Z'), // When the span started
      endedAt: new Date('2025-09-12T17:59:09.409Z'), // When the span ended
      createdAt: new Date('2025-09-12T17:59:11.399Z'), // The time the database record was created
      updatedAt: new Date('2025-09-12T17:59:11.401Z'), // The time the database record was last updated
      isEvent: false,
    };

    const WorkflowStepSpanTypeSecondStep = {
      traceId: '6182b62e81cba47bbe79e9377eb72cbe',
      spanId: '016a0a243072c6e3',
      parentSpanId: '8eff56460ee3e82c',
      name: "workflow step: 'my-step-2'",
      scope: null, // Mastra package info {"core-version": "0.1.0"}
      spanType: 'workflow_step', // WORKFLOW_RUN, WORKFLOW_STEP, AGENT_RUN, AGENT_STEP, TOOL_RUN, TOOL_STEP, etc.
      attributes: { stepId: 'my-step-2', status: 'success' },
      metadata: null,
      links: null,
      input: { ingredient: 'avocado' },
      output: { result: 'suh' },
      error: null,
      startedAt: new Date('2025-09-12T17:59:06.398Z'), // When the span started
      endedAt: new Date('2025-09-12T17:59:11.401Z'), // When the span ended
      createdAt: new Date('2025-09-12T17:59:11.399Z'), // The time the database record was created
      updatedAt: new Date('2025-09-12T17:59:11.401Z'), // The time the database record was last updated
      isEvent: false,
    };
  });
});
