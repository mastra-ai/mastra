import { expect, it } from 'vitest';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { createRecordingModel, textOnlyTape } from '../parity';

// #25074: providers accepting assistant-first history must not see an invented user turn.
// Capture the provider boundary before SDK-specific serialization so identities can
// cover native and gateway routing without credentials or an external API.
describeForAllEngines('AIMock loop scenario: provider-specific first user turn', engine => {
  const getMock = useLoopScenarioAimock();
  it.each([
    { provider: 'openai', modelId: 'gpt-5', needsUser: false },
    { provider: 'anthropic', modelId: 'claude-sonnet-4-6', needsUser: false },
    { provider: 'google.generative-ai', modelId: 'gemini-2.5-pro', needsUser: true },
    { provider: 'vertex', modelId: 'gemini-2.5-pro', needsUser: true },
    { provider: 'amazon-bedrock', modelId: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0', needsUser: true },
    { provider: 'gateway', modelId: 'google/gemini-2.5-pro', needsUser: true },
    { provider: 'gateway', modelId: 'amazon-bedrock/us.anthropic.claude-sonnet-4-5-20250929-v1:0', needsUser: true },
    { provider: 'gateway', modelId: 'openai/gpt-5', needsUser: false },
  ])('$provider/$modelId inserts an initial user turn only when required', async ({ provider, modelId, needsUser }) => {
    const { model, requests } = createRecordingModel({ tapes: [textOnlyTape('Finished the draft.')] });
    const identifiedModel = {
      specificationVersion: model.specificationVersion,
      provider,
      modelId,
      supportedUrls: model.supportedUrls,
      doStream: model.doStream.bind(model),
      doGenerate: model.doGenerate.bind(model),
    };
    const { output } = await runLoopScenario({
      llm: getMock(),
      engine,
      model: identifiedModel,
      fixtures: () => {},
      prompt: [{ role: 'assistant', content: 'A draft to continue' }],
    });
    expect(await output.text).toBe('Finished the draft.');
    expect(requests).toHaveLength(1);
    const conversation = requests[0]!.prompt.filter(m => m.role !== 'system');
    expect(conversation[0]!.role).toBe(needsUser ? 'user' : 'assistant');
    expect(conversation.filter(m => m.role === 'user')).toHaveLength(needsUser ? 1 : 0);
    expect(JSON.stringify(conversation)).toContain('A draft to continue');
  });
});
