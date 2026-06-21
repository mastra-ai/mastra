import { stepCountIs } from '@internal/ai-sdk-v5';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, expect, it } from 'vitest';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Dynamic model resolution scenario.
 *
 * Tests that the agent can use a function as its model configuration that
 * resolves based on requestContext, allowing dynamic model selection per request.
 *
 * This is similar to dynamic instructions but for the model itself.
 */
describe('AIMock scenario: dynamic model resolution', () => {
  const getMock = useLoopScenarioAimock();

  it('should resolve model from function based on requestContext', async () => {
    const mock = getMock();

    // Create a dynamic model function that selects model based on requestContext
    const dynamicModel = ({ requestContext }: { requestContext: any }) => {
      const useSmartModel = requestContext?.get?.('useSmartModel');
      const openai = createOpenAI({
        apiKey: 'test-key',
        baseURL: `${mock.url}/v1`,
      });

      // Return different model IDs based on context
      return openai(useSmartModel ? 'gpt-4o' : 'gpt-4o-mini');
    };

    // Mock responses for both models
    mock.on(
      { endpoint: 'chat', model: 'gpt-4o-mini', hasToolResult: false },
      { content: '4' },
    );

    mock.on(
      { endpoint: 'chat', model: 'gpt-4o', hasToolResult: false },
      { content: 'The answer is 4.' },
    );

    // Test with fast model (default)
    const fastResult = await runLoopScenario({
      llm: mock,
      prompt: 'What is 2+2?',
      model: dynamicModel,
      stopWhen: stepCountIs(1),
      fixtures: () => {
        // Fixtures are already set up above
      },
    });

    const fastText = await fastResult.output.text;
    expect(fastText).toBe('4');

    // Verify the request used the fast model
    const fastRequest = fastResult.requests[0];
    expect(fastRequest?.body?.model).toBe('gpt-4o-mini');

    // Clear requests for next test
    mock.clearRequests();

    // Test with smart model (via requestContext)
    const { RequestContext } = await import('../../../../request-context');
    const requestContext = new RequestContext();
    requestContext.set('useSmartModel', true);

    const smartResult = await runLoopScenario({
      llm: mock,
      prompt: 'What is 2+2?',
      model: dynamicModel,
      requestContext,
      stopWhen: stepCountIs(1),
      fixtures: () => {
        // Fixtures are already set up above
      },
    });

    const smartText = await smartResult.output.text;
    expect(smartText).toBe('The answer is 4.');

    // Verify the request used the smart model
    const smartRequest = smartResult.requests[0];
    expect(smartRequest?.body?.model).toBe('gpt-4o');
  });
});
