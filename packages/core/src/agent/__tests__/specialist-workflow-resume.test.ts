import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { createStep, createWorkflow } from '../../workflows';
import { Agent } from '../agent';

const usage = { inputTokens: 5, outputTokens: 10, totalTokens: 15 };

function makeToolCallingModel(toolName: string, input: unknown, finalText: string, idPrefix: string) {
  let callCount = 0;

  return new MockLanguageModelV2({
    doGenerate: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls' as const,
          usage,
          text: '',
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: `${idPrefix}-tool-call`,
              toolName,
              input: JSON.stringify(input),
            },
          ],
          warnings: [],
        };
      }

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage,
        text: finalText,
        content: [{ type: 'text' as const, text: finalText }],
        warnings: [],
      };
    },
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `${idPrefix}-0`, modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: `${idPrefix}-tool-call`,
              toolName,
              input: JSON.stringify(input),
            },
            { type: 'finish', finishReason: 'tool-calls', usage },
          ]),
        };
      }

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `${idPrefix}-1`, modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: `${idPrefix}-text` },
          { type: 'text-delta', id: `${idPrefix}-text`, delta: finalText },
          { type: 'text-end', id: `${idPrefix}-text` },
          { type: 'finish', finishReason: 'stop', usage },
        ]),
      };
    },
  });
}

describe.each(['generate', 'stream'] as const)('Supervisor Pattern - specialist workflow suspend/resume (%s)', mode => {
  it('resumes the specialist workflow from the suspended step', async () => {
    let stepExecuteCount = 0;
    let receivedResumeData: unknown;

    const approvalStep = createStep({
      id: `approval-step-${mode}`,
      inputSchema: z.object({ request: z.string() }),
      suspendSchema: z.object({ message: z.string() }),
      resumeSchema: z.object({ approved: z.boolean(), reason: z.string() }),
      outputSchema: z.object({ request: z.string(), approved: z.boolean(), reason: z.string() }),
      execute: async ({ inputData, suspend, resumeData }) => {
        stepExecuteCount++;
        if (!resumeData) {
          return await suspend({ message: `Please approve: ${inputData.request}` });
        }

        receivedResumeData = resumeData;
        return { request: inputData.request, approved: resumeData.approved, reason: resumeData.reason };
      },
    });

    const approvalWorkflow = createWorkflow({
      id: `approval-workflow-${mode}`,
      inputSchema: z.object({ request: z.string() }),
      outputSchema: z.object({ request: z.string(), approved: z.boolean(), reason: z.string() }),
    })
      .then(approvalStep)
      .commit();

    const specialist = new Agent({
      id: `approval-specialist-${mode}`,
      name: `Approval Specialist ${mode}`,
      description: 'Handles approval workflows.',
      instructions: 'Use the approval workflow.',
      model: makeToolCallingModel(
        `workflow-approvalWorkflow`,
        { inputData: { request: 'deploy to production' } },
        'Approval granted.',
        `specialist-${mode}`,
      ),
      workflows: { approvalWorkflow },
      memory: new MockMemory(),
    });

    const supervisor = new Agent({
      id: `workflow-suspend-supervisor-${mode}`,
      name: `Workflow Suspend Supervisor ${mode}`,
      instructions: 'Delegate approval requests.',
      model: makeToolCallingModel(
        'agent-approvalSpecialist',
        { prompt: 'Please approve deploy to production' },
        'Deployment approved.',
        `supervisor-${mode}`,
      ),
      agents: { approvalSpecialist: specialist },
      memory: new MockMemory(),
    });

    new Mastra({ agents: { supervisor }, storage: new InMemoryStore() });

    const resumeData = { approved: true, reason: 'Looks good' };

    if (mode === 'generate') {
      const result = await supervisor.generate('Approve deploy to production', { maxSteps: 5 });
      expect(result.finishReason).toBe('suspended');
      expect(stepExecuteCount).toBe(1);

      const resumed = await supervisor.resumeGenerate(resumeData, { runId: result.runId! });
      expect(resumed.finishReason).toBe('stop');
    } else {
      const result = await supervisor.stream('Approve deploy to production', { maxSteps: 5 });
      let suspendPayload: unknown;
      for await (const chunk of result.fullStream) {
        if (chunk.type === 'tool-call-suspended') {
          suspendPayload = chunk.payload.suspendPayload;
        }
      }
      expect(suspendPayload).toEqual({ message: 'Please approve: deploy to production' });
      expect(stepExecuteCount).toBe(1);

      const resumed = await supervisor.resumeStream(resumeData, { runId: result.runId });
      for await (const _chunk of resumed.fullStream) {
        // consume the resumed stream
      }
    }

    expect(stepExecuteCount).toBe(2);
    expect(receivedResumeData).toEqual(resumeData);
  }, 30000);
});
