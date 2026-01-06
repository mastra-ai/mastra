import { randomUUID } from 'node:crypto';
import type { UUID } from 'node:crypto';
import { toAISdkStream } from '@mastra/ai-sdk';
import { Agent } from '@mastra/core/agent';
import type { MastraModelConfig } from '@mastra/core/llm';
import { Mastra } from '@mastra/core/mastra';
import type { MastraMemory } from '@mastra/core/memory';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

function isV5PlusModel(model: MastraModelConfig): boolean {
  if (typeof model === 'string') return true;
  if (typeof model === 'object' && 'specificationVersion' in model) {
    return model.specificationVersion === 'v2' || model.specificationVersion === 'v3';
  }
  return false;
}

export async function setupStreamingMemoryTest({
  model,
  memory,
  tools,
}: {
  memory: MastraMemory;
  model: MastraModelConfig;
  tools: any;
}) {
  describe('Memory Streaming Tests', () => {
    it('should handle multiple tool calls in memory thread history', async () => {
      // Create agent with memory and tools
      const agent = new Agent({
        id: 'test-agent',
        name: 'test',
        instructions:
          'You are a weather agent. When asked about weather in any city, use the get_weather tool with the city name as the postal code. Respond in a pirate accent and dont use the degrees symbol, print the word degrees when needed.',
        model,
        memory,
        tools,
      });

      const threadId = randomUUID();
      const resourceId = randomUUID();
      const isV5Plus = isV5PlusModel(model);

      // First weather check
      const stream1 = isV5Plus
        ? await agent.stream('what is the weather in LA?', { threadId, resourceId })
        : await agent.streamLegacy('what is the weather in LA?', { threadId, resourceId });

      if (isV5Plus) {
        // Collect first stream
        const chunks1: string[] = [];
        for await (const chunk of stream1.fullStream) {
          if (chunk.type === `text-delta`) {
            // Handle both v5+ (payload.text) and legacy (textDelta) formats
            const text = (chunk as any).payload?.text ?? (chunk as any).textDelta;
            if (text) chunks1.push(text);
          }
        }
        const response1 = chunks1.join('');

        expect(chunks1.length).toBeGreaterThan(0);
        expect(response1).toContain('70 degrees');
      } else {
        // Collect first stream
        const chunks1: string[] = [];
        for await (const chunk of stream1.textStream) {
          chunks1.push(chunk);
        }
        const response1 = chunks1.join('');

        expect(chunks1.length).toBeGreaterThan(0);
        expect(response1).toContain('70 degrees');
      }

      // Second weather check
      const stream2Raw = isV5Plus
        ? await agent.stream('what is the weather in Seattle?', { threadId, resourceId })
        : await agent.streamLegacy('what is the weather in Seattle?', { threadId, resourceId });

      if (isV5Plus) {
        const stream2 = toAISdkStream(stream2Raw as any, { from: 'agent' });

        // Collect second stream
        const chunks2: string[] = [];

        for await (const chunk of stream2) {
          if (chunk.type === `text-delta`) {
            chunks2.push(chunk.delta);
          }
        }
        const response2 = chunks2.join('');

        expect(chunks2.length).toBeGreaterThan(0);
        expect(response2).toContain('Seattle');
        expect(response2).toContain('70 degrees');
      } else {
        // Collect second stream
        const chunks2: string[] = [];
        for await (const chunk of stream2Raw.textStream) {
          chunks2.push(chunk);
        }
        const response2 = chunks2.join('');

        expect(chunks2.length).toBeGreaterThan(0);
        expect(response2).toContain('Seattle');
        expect(response2).toContain('70 degrees');
      }
    });

    it('should use custom mastra ID generator for messages in memory', async () => {
      const agent = new Agent({
        id: 'test-msg-id-agent',
        name: 'test-msg-id',
        instructions: 'you are a helpful assistant.',
        model,
        memory,
      });

      const threadId = randomUUID();
      const resourceId = 'test-resource-msg-id';
      const customIds: UUID[] = [];

      new Mastra({
        idGenerator: () => {
          const id = randomUUID();
          customIds.push(id);
          return id;
        },
        agents: {
          agent: agent,
        },
      });

      const isV5Plus = isV5PlusModel(model);
      if (isV5Plus) {
        await agent.generate('Hello, world!', {
          threadId,
          resourceId,
        });
      } else {
        await agent.generateLegacy('Hello, world!', {
          threadId,
          resourceId,
        });
      }

      const agentMemory = (await agent.getMemory())!;
      const { messages } = await agentMemory.recall({ threadId });

      expect(messages).toHaveLength(2);
      expect(messages.length).toBeLessThan(customIds.length);
      for (const message of messages) {
        if (!(`id` in message)) {
          throw new Error(`Expected message.id`);
        }
        expect(customIds).toContain(message.id);
      }
    });

    describe('data-* parts persistence (issue #10477 and #10936)', () => {
      it('should preserve data-* parts through save → recall → UI conversion round-trip', async () => {
        const threadId = randomUUID();
        const resourceId = 'test-data-parts-resource';

        // Create a thread first
        await memory.createThread({
          threadId,
          resourceId,
          title: 'Data Parts Test Thread',
        });

        // Save messages with data-* custom parts (simulating what writer.custom() would produce)
        const messagesWithDataParts = [
          {
            id: randomUUID(),
            threadId,
            resourceId,
            role: 'user' as const,
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: 'Upload my file please' }],
            },
            createdAt: new Date(),
          },
          {
            id: randomUUID(),
            threadId,
            resourceId,
            role: 'assistant' as const,
            content: {
              format: 2 as const,
              parts: [
                { type: 'text' as const, text: 'Processing your file...' },
                {
                  type: 'data-upload-progress' as const,
                  data: {
                    fileName: 'document.pdf',
                    progress: 50,
                    status: 'uploading',
                  },
                },
              ],
            },
            createdAt: new Date(Date.now() + 1000),
          },
          {
            id: randomUUID(),
            threadId,
            resourceId,
            role: 'assistant' as const,
            content: {
              format: 2 as const,
              parts: [
                { type: 'text' as const, text: 'File uploaded successfully!' },
                {
                  type: 'data-file-reference' as const,
                  data: {
                    fileId: 'file-123',
                    fileName: 'document.pdf',
                    fileSize: 1024,
                  },
                },
              ],
            },
            createdAt: new Date(Date.now() + 2000),
          },
        ];

        // Save messages to storage
        await memory.saveMessages({ messages: messagesWithDataParts as any });

        // Recall messages from storage
        const recallResult = await memory.recall({
          threadId,
          resourceId,
        });

        expect(recallResult.messages.length).toBe(3);

        // Verify data-* parts are present in recalled messages (DB format)
        const assistantMessages = recallResult.messages.filter((m: any) => m.role === 'assistant');
        expect(assistantMessages.length).toBe(2);

        // Check first assistant message has data-upload-progress
        const uploadProgressMsg = assistantMessages.find((m: any) =>
          m.content.parts.some((p: any) => p.type === 'data-upload-progress'),
        );
        expect(uploadProgressMsg).toBeDefined();
        const uploadProgressPart = uploadProgressMsg!.content.parts.find((p: any) => p.type === 'data-upload-progress');
        expect(uploadProgressPart).toBeDefined();
        expect((uploadProgressPart as any).data.progress).toBe(50);

        // Check second assistant message has data-file-reference
        const fileRefMsg = assistantMessages.find((m: any) =>
          m.content.parts.some((p: any) => p.type === 'data-file-reference'),
        );
        expect(fileRefMsg).toBeDefined();
        const fileRefPart = fileRefMsg!.content.parts.find((p: any) => p.type === 'data-file-reference');
        expect(fileRefPart).toBeDefined();
        expect((fileRefPart as any).data.fileId).toBe('file-123');

        // Now convert to AIV5 UI format (this is what the frontend would receive)
        const { MessageList } = await import('@mastra/core/agent');
        const uiMessages = recallResult.messages.map((m: any) => MessageList.mastraDBMessageToAIV5UIMessage(m));

        expect(uiMessages.length).toBe(3);

        // Verify data-* parts are preserved in UI format
        const uiAssistantMessages = uiMessages.filter((m: any) => m.role === 'assistant');
        expect(uiAssistantMessages.length).toBe(2);

        // Check data-upload-progress is preserved in UI format
        const uiUploadProgressMsg = uiAssistantMessages.find((m: any) =>
          m.parts.some((p: any) => p.type === 'data-upload-progress'),
        );
        expect(uiUploadProgressMsg).toBeDefined();
        const uiUploadProgressPart = uiUploadProgressMsg!.parts.find((p: any) => p.type === 'data-upload-progress');
        expect(uiUploadProgressPart).toBeDefined();
        expect((uiUploadProgressPart as any).data.progress).toBe(50);
        expect((uiUploadProgressPart as any).data.fileName).toBe('document.pdf');

        // Check data-file-reference is preserved in UI format
        const uiFileRefMsg = uiAssistantMessages.find((m: any) =>
          m.parts.some((p: any) => p.type === 'data-file-reference'),
        );
        expect(uiFileRefMsg).toBeDefined();
        const uiFileRefPart = uiFileRefMsg!.parts.find((p: any) => p.type === 'data-file-reference');
        expect(uiFileRefPart).toBeDefined();
        expect((uiFileRefPart as any).data.fileId).toBe('file-123');
        expect((uiFileRefPart as any).data.fileName).toBe('document.pdf');

        // Clean up
        await memory.deleteThread(threadId);
      });
    });

    describe('workflow execution events persistence (issue #11640)', () => {
      /**
       * This test verifies that workflow events (data-step-finish, data-tool-output)
       * are properly persisted and can be recalled from memory (issue #11640 fix).
       *
       * The fix adds persistence for step-finish and tool-output events as data-* parts
       * in packages/core/src/loop/workflows/agentic-loop/index.ts and stream.ts
       */
      it('should persist workflow events (data-step-finish, data-tool-output) for recall', async () => {
        const threadId = randomUUID();
        const resourceId = 'test-workflow-events-fix-resource';

        // Create a thread first
        await memory.createThread({
          threadId,
          resourceId,
          title: 'Workflow Events Fix Test Thread',
        });

        // Simulate what gets saved NOW with the fix:
        // - data-step-finish: persisted by agentic-loop when step-finish is emitted
        // - data-tool-output: persisted by stream.ts when tool-output is emitted
        const messagesWithWorkflowEvents = [
          {
            id: randomUUID(),
            threadId,
            resourceId,
            role: 'user' as const,
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: 'Run my data processing workflow' }],
            },
            createdAt: new Date(),
          },
          {
            id: randomUUID(),
            threadId,
            resourceId,
            role: 'assistant' as const,
            content: {
              format: 2 as const,
              parts: [
                {
                  type: 'tool-invocation' as const,
                  toolInvocation: {
                    state: 'result' as const,
                    toolCallId: 'call-123',
                    toolName: 'data-processing-workflow',
                    args: { input: 'data.csv' },
                    result: { success: true, processedRows: 100 },
                  },
                },
                // With the fix, data-tool-output events are now persisted
                {
                  type: 'data-tool-output' as const,
                  data: {
                    toolName: 'data-processing-workflow',
                    stepId: 'validate-step',
                    output: { isValid: true },
                  },
                },
                {
                  type: 'data-tool-output' as const,
                  data: {
                    toolName: 'data-processing-workflow',
                    stepId: 'process-step',
                    output: { processedRows: 100 },
                  },
                },
                // With the fix, data-step-finish events are now persisted
                {
                  type: 'data-step-finish' as const,
                  data: {
                    stepResult: { reason: 'tool-calls', isContinued: true },
                    messageId: 'msg-123',
                  },
                },
                {
                  type: 'data-step-finish' as const,
                  data: {
                    stepResult: { reason: 'stop', isContinued: false },
                    messageId: 'msg-123',
                  },
                },
                { type: 'text' as const, text: 'Workflow completed successfully!' },
              ],
            },
            createdAt: new Date(Date.now() + 1000),
          },
        ];

        // Save messages with workflow events
        await memory.saveMessages({ messages: messagesWithWorkflowEvents as any });

        // Recall messages from storage
        const recallResult = await memory.recall({
          threadId,
          resourceId,
        });

        // Check what's available in recall
        const assistantMessages = recallResult.messages.filter((m: any) => m.role === 'assistant');
        expect(assistantMessages.length).toBe(1);

        const assistantParts = assistantMessages[0].content.parts;

        // Verify data-step-finish events are preserved
        const stepFinishParts = assistantParts.filter((p: any) => p.type === 'data-step-finish');
        expect(stepFinishParts.length).toBe(2);
        expect((stepFinishParts[0] as any).data.stepResult.reason).toBe('tool-calls');
        expect((stepFinishParts[1] as any).data.stepResult.reason).toBe('stop');

        // Verify data-tool-output events are preserved
        const toolOutputParts = assistantParts.filter((p: any) => p.type === 'data-tool-output');
        expect(toolOutputParts.length).toBe(2);
        expect((toolOutputParts[0] as any).data.stepId).toBe('validate-step');
        expect((toolOutputParts[1] as any).data.stepId).toBe('process-step');

        // Clean up
        await memory.deleteThread(threadId);
      });

      it('REAL WORKFLOW: should capture workflow execution events during streaming and preserve them in memory recall', async () => {
        // Skip if model is not V5+ (stream() requires V5+ models)
        if (!isV5PlusModel(model)) {
          console.log('Skipping REAL WORKFLOW test - requires AI SDK v5+ model');
          return;
        }

        // Create a simple multi-step workflow
        const validateStep = createStep({
          id: 'validate-input',
          inputSchema: z.object({
            data: z.string(),
          }),
          outputSchema: z.object({
            isValid: z.boolean(),
            sanitizedData: z.string(),
          }),
          execute: async ({ inputData }) => {
            return {
              isValid: true,
              sanitizedData: inputData.data.trim().toUpperCase(),
            };
          },
        });

        const processStep = createStep({
          id: 'process-data',
          inputSchema: z.object({
            isValid: z.boolean(),
            sanitizedData: z.string(),
          }),
          outputSchema: z.object({
            result: z.string(),
            processedAt: z.string(),
          }),
          execute: async ({ inputData }) => {
            return {
              result: `Processed: ${inputData.sanitizedData}`,
              processedAt: new Date().toISOString(),
            };
          },
        });

        const dataProcessingWorkflow = createWorkflow({
          id: 'data-processing-workflow',
          inputSchema: z.object({
            data: z.string(),
          }),
          outputSchema: z.object({
            result: z.string(),
            processedAt: z.string(),
          }),
        });

        dataProcessingWorkflow.then(validateStep).then(processStep).commit();

        // Create an agent with the workflow registered
        const workflowAgent = new Agent({
          id: 'workflow-test-agent',
          name: 'Workflow Test Agent',
          instructions: `You are an agent that processes data using workflows. 
            When asked to process data, use the data-processing-workflow to handle it.
            Always use the workflow for any data processing requests.`,
          model,
          memory,
          workflows: {
            'data-processing-workflow': dataProcessingWorkflow,
          },
        });

        const threadId = randomUUID();
        const resourceId = 'test-real-workflow-resource';

        // Stream using agent.stream() - the agent may call the workflow as a tool
        const streamResult = await workflowAgent.stream('Please process this data: "hello world"', {
          threadId,
          resourceId,
          maxSteps: 5,
        });

        // Collect ALL stream chunks
        const streamedChunks: any[] = [];
        for await (const chunk of streamResult.fullStream) {
          streamedChunks.push(chunk);
        }

        // Wait for stream to complete
        const response = await streamResult.response;
        console.log('Stream completed, response text length:', (response as any)?.text?.length);

        // Analyze all streamed chunk types
        const allChunkTypes = [...new Set(streamedChunks.map(c => c.type))].sort();
        console.log('\n=== STREAMED CHUNK TYPES ===');
        console.log(allChunkTypes.join('\n'));
        console.log(`\nTotal chunks: ${streamedChunks.length}`);

        // Log step-related chunks in detail (these are workflow step events)
        const stepChunks = streamedChunks.filter(c => c.type?.includes('step'));
        console.log(`\n=== STEP-RELATED CHUNKS (${stepChunks.length}) ===`);
        stepChunks.forEach((c, i) => {
          console.log(`${i + 1}. type: ${c.type}`);
          if (c.payload) {
            console.log(`   payload: ${JSON.stringify(c.payload).slice(0, 200)}`);
          }
        });

        // Log tool-related chunks (workflow called as tool)
        const toolChunks = streamedChunks.filter(c => c.type?.includes('tool'));
        console.log(`\n=== TOOL-RELATED CHUNKS (${toolChunks.length}) ===`);
        toolChunks.forEach((c, i) => {
          console.log(`${i + 1}. type: ${c.type}`);
          if (c.payload?.toolName) {
            console.log(`   toolName: ${c.payload.toolName}`);
          }
        });

        // Now recall messages from memory
        const recallResult = await memory.recall({
          threadId,
          resourceId,
        });

        console.log('\n=== RECALLED MESSAGES ===');
        console.log(`Total messages recalled: ${recallResult.messages.length}`);

        // Analyze what parts are in the recalled messages
        const allRecalledParts: string[] = [];
        recallResult.messages.forEach((msg: any, i: number) => {
          console.log(`\nMessage ${i + 1} (${msg.role}):`);
          if (msg.content?.parts) {
            msg.content.parts.forEach((p: any) => {
              allRecalledParts.push(p.type);
              console.log(`  - ${p.type}`);
              if (p.type === 'tool-invocation') {
                console.log(`    toolName: ${p.toolInvocation?.toolName}`);
              }
            });
          }
        });

        // Compare streamed chunk types vs recalled part types
        const streamedTypes = new Set(allChunkTypes);
        const recalledTypes = new Set(allRecalledParts);

        console.log('\n=== COMPARISON: STREAMED vs RECALLED ===');
        console.log(`Streamed chunk types (${streamedTypes.size}): ${[...streamedTypes].join(', ')}`);
        console.log(`Recalled part types (${recalledTypes.size}): ${[...recalledTypes].join(', ')}`);

        // Check what step events were streamed vs recalled
        // Note: step-finish is now persisted as data-step-finish, tool-output as data-tool-output
        const streamedStepTypes = allChunkTypes.filter(t => t?.includes('step'));
        const recalledStepTypes = allRecalledParts.filter(t => t?.includes('step'));
        console.log(`\nStep events streamed: ${streamedStepTypes.join(', ') || 'none'}`);
        console.log(`Step events recalled: ${recalledStepTypes.join(', ') || 'none'}`);

        // Check for data-step-finish and data-tool-output (the persisted versions)
        const hasDataStepFinish = allRecalledParts.some(t => t === 'data-step-finish');
        const hasDataToolOutput = allRecalledParts.some(t => t === 'data-tool-output');
        console.log(`\nPersisted workflow events in recall:`);
        console.log(`  data-step-finish: ${hasDataStepFinish ? 'YES ✓' : 'NO'}`);
        console.log(`  data-tool-output: ${hasDataToolOutput ? 'YES ✓' : 'NO'}`);

        // Verify the fix: step-finish should now be persisted as data-step-finish
        if (streamedStepTypes.includes('step-finish')) {
          console.log(`\n=== FIX VERIFICATION (issue #11640) ===`);
          if (hasDataStepFinish) {
            console.log('✓ step-finish is now persisted as data-step-finish');
          } else {
            console.log('✗ step-finish was streamed but data-step-finish is NOT in recall');
          }
        }

        // Assert that workflow events are now being persisted
        if (streamedStepTypes.includes('step-finish')) {
          expect(hasDataStepFinish).toBe(true);
        }

        // At minimum, we should have user message and some assistant response
        expect(recallResult.messages.length).toBeGreaterThan(0);

        // Clean up
        await memory.deleteThread(threadId);
      }, 120000); // 2 minute timeout for real LLM calls

      it('should preserve workflow execution events through save → recall → UI conversion round-trip', async () => {
        const threadId = randomUUID();
        const resourceId = 'test-workflow-events-resource';

        // Create a thread first
        await memory.createThread({
          threadId,
          resourceId,
          title: 'Workflow Events Test Thread',
        });

        // Simulate messages with workflow execution events (what would be saved during agent.network() streaming)
        // During streaming, these events are sent via writer.write() with types like:
        // - workflow-execution-start
        // - workflow-execution-event-step-start
        // - workflow-execution-event-step-output
        // - workflow-execution-end
        //
        // BUG: These events are streamed to the client but NOT persisted as structured parts.
        // Instead, only a final JSON blob is saved as text content.
        const messagesWithWorkflowEvents = [
          {
            id: randomUUID(),
            threadId,
            resourceId,
            role: 'user' as const,
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: 'Run my data processing workflow' }],
            },
            createdAt: new Date(),
          },
          {
            id: randomUUID(),
            threadId,
            resourceId,
            role: 'assistant' as const,
            content: {
              format: 2 as const,
              parts: [
                { type: 'text' as const, text: 'Starting workflow...' },
                // BUG: workflow-execution-* events are NOT saved as data-* parts
                // During streaming these events ARE sent to client but never persisted:
                {
                  type: 'data-workflow-execution-start' as const,
                  data: {
                    workflowId: 'data-processing-workflow',
                    runId: 'run-123',
                    args: { inputFile: 'data.csv' },
                  },
                },
                {
                  type: 'data-workflow-execution-event-step-start' as const,
                  data: {
                    stepId: 'validate-step',
                    runId: 'run-123',
                    payload: { status: 'starting' },
                  },
                },
                {
                  type: 'data-workflow-execution-event-step-output' as const,
                  data: {
                    stepId: 'validate-step',
                    runId: 'run-123',
                    output: { valid: true, rowCount: 100 },
                  },
                },
                // Simulating HITL (Human-in-the-Loop) step that user expects to see in history
                {
                  type: 'data-workflow-execution-event-step-suspended' as const,
                  data: {
                    stepId: 'approval-step',
                    runId: 'run-123',
                    suspendPayload: {
                      message: 'Please approve processing 100 rows',
                      options: ['approve', 'reject'],
                    },
                  },
                },
                {
                  type: 'data-workflow-execution-event-step-resumed' as const,
                  data: {
                    stepId: 'approval-step',
                    runId: 'run-123',
                    resumePayload: { decision: 'approve' },
                  },
                },
                {
                  type: 'data-workflow-execution-event-step-output' as const,
                  data: {
                    stepId: 'process-step',
                    runId: 'run-123',
                    output: { processedRows: 100, errors: 0 },
                  },
                },
                {
                  type: 'data-workflow-execution-end' as const,
                  data: {
                    workflowId: 'data-processing-workflow',
                    runId: 'run-123',
                    result: { status: 'success', totalProcessed: 100 },
                  },
                },
              ],
            },
            createdAt: new Date(Date.now() + 1000),
          },
          {
            id: randomUUID(),
            threadId,
            resourceId,
            role: 'assistant' as const,
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: 'Workflow completed successfully! Processed 100 rows.' }],
            },
            createdAt: new Date(Date.now() + 2000),
          },
        ];

        // Save messages to storage
        await memory.saveMessages({ messages: messagesWithWorkflowEvents as any });

        // Recall messages from storage
        const recallResult = await memory.recall({
          threadId,
          resourceId,
        });

        expect(recallResult.messages.length).toBe(3);

        // Get the assistant message that should contain workflow events
        const assistantMessages = recallResult.messages.filter((m: any) => m.role === 'assistant');
        expect(assistantMessages.length).toBe(2);

        // Find the message with workflow events
        const workflowEventsMsg = assistantMessages.find((m: any) =>
          m.content.parts.some((p: any) => p.type.startsWith('data-workflow-')),
        );

        // This assertion FAILS in production because workflow events are NOT being persisted
        // as structured data-* parts. Instead, only a JSON blob is saved.
        expect(workflowEventsMsg).toBeDefined();

        // Verify specific workflow event parts are present
        const workflowStartPart = workflowEventsMsg!.content.parts.find(
          (p: any) => p.type === 'data-workflow-execution-start',
        );
        expect(workflowStartPart).toBeDefined();
        expect((workflowStartPart as any).data.workflowId).toBe('data-processing-workflow');

        // Verify HITL events are preserved (critical for user to see in history)
        const hitlSuspendPart = workflowEventsMsg!.content.parts.find(
          (p: any) => p.type === 'data-workflow-execution-event-step-suspended',
        );
        expect(hitlSuspendPart).toBeDefined();
        expect((hitlSuspendPart as any).data.suspendPayload.options).toContain('approve');

        const hitlResumePart = workflowEventsMsg!.content.parts.find(
          (p: any) => p.type === 'data-workflow-execution-event-step-resumed',
        );
        expect(hitlResumePart).toBeDefined();
        expect((hitlResumePart as any).data.resumePayload.decision).toBe('approve');

        // Verify workflow end event
        const workflowEndPart = workflowEventsMsg!.content.parts.find(
          (p: any) => p.type === 'data-workflow-execution-end',
        );
        expect(workflowEndPart).toBeDefined();
        expect((workflowEndPart as any).data.result.status).toBe('success');

        // Now convert to AIV5 UI format (this is what the frontend would receive)
        const { MessageList } = await import('@mastra/core/agent');
        const uiMessages = recallResult.messages.map((m: any) => MessageList.mastraDBMessageToAIV5UIMessage(m));

        expect(uiMessages.length).toBe(3);

        // Verify workflow events are preserved in UI format
        const uiAssistantMessages = uiMessages.filter((m: any) => m.role === 'assistant');
        expect(uiAssistantMessages.length).toBe(2);

        // Find UI message with workflow events
        const uiWorkflowEventsMsg = uiAssistantMessages.find((m: any) =>
          m.parts.some((p: any) => p.type?.startsWith('data-workflow-')),
        );

        // Critical: Workflow events should be available in UI format for frontend display
        expect(uiWorkflowEventsMsg).toBeDefined();

        // Verify workflow-execution-start is preserved
        const uiWorkflowStartPart = uiWorkflowEventsMsg!.parts.find(
          (p: any) => p.type === 'data-workflow-execution-start',
        );
        expect(uiWorkflowStartPart).toBeDefined();
        expect((uiWorkflowStartPart as any).data.workflowId).toBe('data-processing-workflow');

        // Verify HITL events are preserved in UI (users need to see these in history)
        const uiHitlSuspendPart = uiWorkflowEventsMsg!.parts.find(
          (p: any) => p.type === 'data-workflow-execution-event-step-suspended',
        );
        expect(uiHitlSuspendPart).toBeDefined();

        const uiHitlResumePart = uiWorkflowEventsMsg!.parts.find(
          (p: any) => p.type === 'data-workflow-execution-event-step-resumed',
        );
        expect(uiHitlResumePart).toBeDefined();

        // Verify all step outputs are preserved
        const stepOutputParts = uiWorkflowEventsMsg!.parts.filter(
          (p: any) => p.type === 'data-workflow-execution-event-step-output',
        );
        expect(stepOutputParts.length).toBe(2); // validate-step and process-step outputs

        // Clean up
        await memory.deleteThread(threadId);
      });
    });
  });
}
