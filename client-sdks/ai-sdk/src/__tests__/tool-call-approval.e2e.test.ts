import { getLLMTestMode } from '@internal/llm-recorder';
import { createGatewayMock, setupDummyApiKeys } from '@internal/test-utils';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { handleChatStream } from '../chat-route';
import { toAISdkStream } from '../convert-streams';
import type { V6UIMessage } from '../public-types';

const MODE = getLLMTestMode();
setupDummyApiKeys(MODE, ['openai']);

const mock = createGatewayMock();
beforeAll(() => mock.start());
afterAll(() => mock.saveAndStop());

async function collectChunks(stream: ReadableStream) {
  const chunks: any[] = [];
  for await (const chunk of stream as any) chunks.push(chunk);
  return chunks;
}

type ApprovalRequest = {
  approvalId: string;
  toolCallId: string;
  input: { value: string };
};

function approvalMessage(request: ApprovalRequest, approved?: boolean): V6UIMessage {
  const part =
    approved === undefined
      ? {
          type: 'tool-recordValue' as const,
          toolCallId: request.toolCallId,
          state: 'approval-requested' as const,
          input: request.input,
          approval: { id: request.approvalId },
        }
      : {
          type: 'tool-recordValue' as const,
          toolCallId: request.toolCallId,
          state: 'approval-responded' as const,
          input: request.input,
          output: undefined,
          approval: { id: request.approvalId, approved },
        };

  return {
    id: `message-${request.toolCallId}`,
    role: 'assistant',
    parts: [part],
  };
}

describe('v6 whole-request tool approval extraction (e2e)', { timeout: 180_000 }, () => {
  it('resumes a new exact target while safely skipping a resolved response from history', async () => {
    const executedValues: string[] = [];
    const recordValue = createTool({
      id: 'recordValue',
      description: 'Record the exact value provided by the user. Call this tool exactly once per request.',
      inputSchema: z.object({ value: z.string() }),
      requireApproval: true,
      execute: async ({ value }) => {
        executedValues.push(value);
        return { recorded: value };
      },
    });
    const agent = new Agent({
      id: 'approval-extraction-e2e',
      name: 'Approval Extraction E2E',
      instructions:
        'When asked to record a value, call recordValue exactly once with that exact value. After the tool succeeds, confirm completion without calling another tool.',
      model: 'openai/gpt-5.4-mini',
      tools: { recordValue },
    });
    const mastra = new Mastra({
      agents: { approvalExtractionE2e: agent },
      storage: new InMemoryStore(),
      logger: false,
    });
    const registeredAgent = mastra.getAgent('approvalExtractionE2e');

    const requestApproval = async (value: string): Promise<ApprovalRequest> => {
      const result = await registeredAgent.stream(`Record the value ${value}.`, {
        maxSteps: 3,
        modelSettings: { maxRetries: 0 },
      });
      const chunks = await collectChunks(
        toAISdkStream(result, {
          from: 'agent',
          version: 'v6',
        }),
      );
      const approval = chunks.find(chunk => chunk.type === 'tool-approval-request');
      const input = chunks.find(
        chunk => chunk.type === 'tool-input-available' && chunk.toolCallId === approval?.toolCallId,
      )?.input;

      expect(approval).toBeDefined();
      expect(input).toEqual({ value });
      return { approvalId: approval.approvalId, toolCallId: approval.toolCallId, input };
    };

    const approvalA = await requestApproval('VALUE_A');
    const approvalB = await requestApproval('VALUE_B');

    const firstResponse = await handleChatStream({
      mastra,
      agentId: agent.id,
      version: 'v6',
      params: {
        messages: [approvalMessage(approvalA, true), approvalMessage(approvalB)],
      },
    });
    const firstChunks = await collectChunks(firstResponse);

    expect(executedValues).toEqual(['VALUE_A']);
    expect(firstChunks[0]?.type).toBe('start');
    expect(firstChunks.filter(chunk => chunk.type === 'start')).toHaveLength(1);
    expect(firstChunks.filter(chunk => chunk.type === 'finish')).toHaveLength(1);
    expect(firstChunks.find(chunk => chunk.type === 'error')).toBeUndefined();

    const secondResponse = await handleChatStream({
      mastra,
      agentId: agent.id,
      version: 'v6',
      params: {
        messages: [approvalMessage(approvalA, true), approvalMessage(approvalB, true)],
      },
    });
    const secondChunks = await collectChunks(secondResponse);

    expect(executedValues).toEqual(['VALUE_A', 'VALUE_B']);
    expect(secondChunks[0]?.type).toBe('start');
    expect(secondChunks.filter(chunk => chunk.type === 'start')).toHaveLength(1);
    expect(secondChunks.filter(chunk => chunk.type === 'finish')).toHaveLength(1);
    expect(secondChunks.find(chunk => chunk.type === 'error')).toBeUndefined();
  });
});
