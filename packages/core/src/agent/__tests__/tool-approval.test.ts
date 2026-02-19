import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import z from 'zod';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory';
import { SkillsProcessor } from '../../processors/processors/skills';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import type { Workspace } from '../../workspace';
import type { Skill, SkillMetadata, WorkspaceSkills } from '../../workspace/skills';
import { Agent } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

const mockStorage = new InMemoryStore();

export function toolApprovalAndSuspensionTests(version: 'v1' | 'v2') {
  const mockFindUser = vi.fn().mockImplementation(async data => {
    const list = [
      { name: 'Dero Israel', email: 'dero@mail.com' },
      { name: 'Ife Dayo', email: 'dayo@mail.com' },
      { name: 'Tao Feeq', email: 'feeq@mail.com' },
      { name: 'Joe', email: 'joe@mail.com' },
    ];

    const userInfo = list?.find(({ name }) => name === (data as { name: string }).name);
    if (!userInfo) return { message: 'User not found' };
    return userInfo;
  });

  describe('tool approval and suspension', () => {
    describe.skipIf(version === 'v1')('requireToolApproval (mock-based)', () => {
      it('should call findUserTool with requireToolApproval on tool and resume via stream when autoResumeSuspendedTools is true', async () => {
        const findUserTool = createTool({
          id: 'Find user tool',
          description: 'This is a test tool that returns the name and email',
          inputSchema: z.object({
            name: z.string(),
          }),
          requireApproval: true,
          execute: async input => {
            return mockFindUser(input) as Promise<Record<string, any>>;
          },
        });

        // Create a mock model that handles tool calls
        let callCount = 0;
        const mockModel = new MockLanguageModelV2({
          doStream: async () => {
            callCount++;
            if (callCount === 1) {
              // First call: return tool call for findUserTool
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                warnings: [],
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-1',
                    toolName: 'findUserTool',
                    input: '{"name":"Dero Israel"}',
                    providerExecuted: false,
                  },
                  {
                    type: 'finish',
                    finishReason: 'tool-calls',
                    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  },
                ]),
              };
            } else if (callCount === 2) {
              // Second call: return tool call for findUserTool with resumeData: { approved: true }
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                warnings: [],
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-2',
                    toolName: 'findUserTool',
                    input: '{"name":"Dero Israel", "resumeData": { "approved": true }}',
                    providerExecuted: false,
                  },
                  {
                    type: 'finish',
                    finishReason: 'tool-calls',
                    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  },
                ]),
              };
            } else {
              // Second call (after approval): return text response
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                warnings: [],
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'User name is Dero Israel' },
                  { type: 'text-end', id: 'text-1' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  },
                ]),
              };
            }
          },
        });

        const userAgent = new Agent({
          id: 'user-agent',
          name: 'User Agent',
          instructions: 'You are an agent that can get list of users using findUserTool.',
          model: mockModel,
          tools: { findUserTool },
          memory: new MockMemory(),
          defaultOptions: {
            autoResumeSuspendedTools: true,
          },
        });

        const mastra = new Mastra({
          agents: { userAgent },
          logger: false,
          storage: mockStorage,
        });

        const agentOne = mastra.getAgent('userAgent');
        const memory = {
          thread: randomUUID(),
          resource: randomUUID(),
        };

        const stream = await agentOne.stream('Find the user with name - Dero Israel', { memory });
        let toolName = '';
        for await (const _chunk of stream.fullStream) {
          if (_chunk.type === 'tool-call-approval') {
            toolName = _chunk.payload.toolName;
          }
        }
        if (toolName) {
          const resumeStream = await agentOne.stream('Approve', {
            memory,
          });
          for await (const _chunk of resumeStream.fullStream) {
          }

          const toolResults = await resumeStream.toolResults;

          const toolCall = toolResults?.find((result: any) => result.payload.toolName === 'findUserTool')?.payload;

          const name = (toolCall?.result as any)?.name;

          expect(mockFindUser).toHaveBeenCalled();
          expect(name).toBe('Dero Israel');
          expect(toolName).toBe('findUserTool');
        }
      }, 500000);

      it('should not require approval for skill tools when requireToolApproval is true', async () => {
        const mockSkill: Skill = {
          name: 'test-skill',
          description: 'A test skill',
          instructions: '# Test Skill\n\nTest instructions.',
          path: '/skills/test-skill',
          source: { type: 'local', projectPath: '/skills/test-skill' },
          references: [],
          scripts: [],
          assets: [],
        };
        const mockSkillMetadata: SkillMetadata = {
          name: mockSkill.name,
          description: mockSkill.description,
        };
        const mockWorkspaceSkills: WorkspaceSkills = {
          list: vi.fn().mockResolvedValue([mockSkillMetadata]),
          get: vi.fn().mockResolvedValue(mockSkill),
          has: vi.fn().mockResolvedValue(true),
          refresh: vi.fn().mockResolvedValue(undefined),
          maybeRefresh: vi.fn().mockResolvedValue(undefined),
          search: vi.fn().mockResolvedValue([]),
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
          getReference: vi.fn().mockResolvedValue(null),
          getScript: vi.fn().mockResolvedValue(null),
          getAsset: vi.fn().mockResolvedValue(null),
          listReferences: vi.fn().mockResolvedValue([]),
          listScripts: vi.fn().mockResolvedValue([]),
          listAssets: vi.fn().mockResolvedValue([]),
        };
        const mockWorkspace = { skills: mockWorkspaceSkills } as unknown as Workspace;

        let callCount = 0;
        const mockModel = new MockLanguageModelV2({
          doStream: async () => {
            callCount++;
            if (callCount === 1) {
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                warnings: [],
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-skill-1',
                    toolName: 'skill-activate',
                    input: '{"name":"test-skill"}',
                    providerExecuted: false,
                  },
                  {
                    type: 'finish',
                    finishReason: 'tool-calls',
                    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  },
                ]),
              };
            }
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Skill activated successfully' },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ]),
            };
          },
        });

        const skillsProcessor = new SkillsProcessor({ workspace: mockWorkspace });

        const userAgent = new Agent({
          id: 'skill-approval-agent',
          name: 'Skill Approval Agent',
          instructions: 'You are an agent with skills.',
          model: mockModel,
          inputProcessors: [skillsProcessor],
        });

        const mastra = new Mastra({
          agents: { userAgent },
          logger: false,
          storage: mockStorage,
        });

        const agentOne = mastra.getAgent('userAgent');

        const stream = await agentOne.stream('Activate the test skill', {
          requireToolApproval: true,
        });

        let hasApprovalChunk = false;
        let hasToolResult = false;
        for await (const chunk of stream.fullStream) {
          if (chunk.type === 'tool-call-approval') {
            hasApprovalChunk = true;
          }
          if (chunk.type === 'tool-result') {
            hasToolResult = true;
          }
        }

        // Skill tools should NOT trigger approval
        expect(hasApprovalChunk).toBe(false);
        // Skill tool should execute directly
        expect(hasToolResult).toBe(true);
      }, 15000);
    });
  });
}

toolApprovalAndSuspensionTests('v2');
