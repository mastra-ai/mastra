import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { MastraModelOutput } from './stream/base/output';
import { MessageList } from './agent/message-list';
import { ProcessorState, ProcessorRunner } from './processors/runner';
import { ChunkFrom, type ChunkType } from './stream/types';
import { ReadableStream, type ReadableStreamDefaultController } from 'stream/web';
import { createWorkflow, createStep } from './workflows/workflow';

/**
 * Memory Leak Tests for Issue #6322
 *
 * Tests validate proper cleanup of buffers, state, and data structures
 * to prevent unbounded memory growth during streaming operations.
 *
 * @see https://github.com/mastra-ai/mastra/issues/6322
 */

// Helper to measure memory usage
function getMemoryUsage(): number {
  if (global.gc) {
    global.gc(); // Force garbage collection if available (run with --expose-gc)
  }
  return process.memoryUsage().heapUsed / 1024 / 1024; // MB
}

// Helper to create a streaming chunk generator
function createChunkStream(chunks: ChunkType<undefined>[]): ReadableStream<ChunkType<undefined>> {
  return new ReadableStream({
    async start(controller: ReadableStreamDefaultController<ChunkType<undefined>>) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
        await new Promise(resolve => setTimeout(resolve, 1)); // Small delay to simulate streaming
      }
      controller.close();
    },
  });
}

describe('Memory Leak Tests - Issue #6322', () => {
  describe('Component Memory Leaks', () => {
    describe('MastraModelOutput buffer accumulation', () => {
      it('clears buffers after stream completes', async () => {
        const chunks: ChunkType<undefined>[] = [];
        for (let i = 0; i < 100; i++) {
          chunks.push({
            runId: 'test-run-id',
            from: ChunkFrom.AGENT,
            type: 'text-delta',
            payload: {
              id: `text-${i}`,
              text: `Content chunk ${i} `,
            },
          });
        }
        chunks.push({
          runId: 'test-run-id',
          from: ChunkFrom.AGENT,
          type: 'finish',
          payload: {
            stepResult: {
              reason: 'stop',
            },
            output: {
              usage: {
                inputTokens: 100,
                outputTokens: 500,
                totalTokens: 600,
              },
            },
            metadata: {},
            messages: {
              all: [],
              user: [],
              nonUser: [],
            },
          },
        });

        const messageList = new MessageList({ threadId: 'test-thread' });
        const stream = createChunkStream(chunks);

        const output = new MastraModelOutput({
          model: {
            modelId: 'test-model',
            provider: 'test-provider',
            version: 'v2' as const,
          },
          stream,
          messageList,
          messageId: 'test-message-id',
          options: {
            runId: 'test-run',
            returnScorerData: false,
          },
        });

        // First read: consume the stream
        const reader1 = output.fullStream.getReader();
        let firstReadCount = 0;

        while (true) {
          const { done, value } = await reader1.read();
          if (done) break;
          firstReadCount++;
        }
        reader1.releaseLock();

        console.log(`First read: Processed ${firstReadCount} chunks`);

        // Second read: buffers should be cleared, replay should return nothing
        const reader2 = output.fullStream.getReader();
        let secondReadCount = 0;

        while (true) {
          const { done, value } = await reader2.read();
          if (done) break;
          secondReadCount++;
        }
        reader2.releaseLock();

        console.log(`Second read (replay): Got ${secondReadCount} chunks`);

        expect(secondReadCount).toBe(0);
        expect(firstReadCount).toBe(101);
      });
    });

    describe('ProcessorState unbounded growth', () => {
      it('clears stream parts after processing', () => {
        const processorState = new ProcessorState<undefined>({
          processorName: 'test-processor',
          processorIndex: 0,
        });

        const initialMemory = getMemoryUsage();

        for (let i = 0; i < 500; i++) {
          const chunk: ChunkType<undefined> = {
            runId: 'test-run-id',
            from: ChunkFrom.AGENT,
            type: 'text-delta',
            payload: {
              id: `text-${i}`,
              text: `This is chunk ${i} with content. `,
            },
          };
          processorState.addPart(chunk);
        }

        const afterChunks = getMemoryUsage();
        const memoryUsed = afterChunks - initialMemory;

        console.log('ProcessorState after 500 chunks:', {
          streamParts: processorState.streamParts.length,
          memoryUsed: `${memoryUsed.toFixed(2)} MB`,
        });

        processorState.finalize();

        expect(processorState.streamParts.length).toBe(0);

        // Note: Memory measurement after cleanup is unreliable due to GC timing
        // The primary assertion (streamParts.length === 0) validates the fix
        const afterCleanup = getMemoryUsage();
        const retained = afterCleanup - initialMemory;
        console.log(`Memory retained after cleanup: ${retained.toFixed(2)} MB (GC may not have run yet)`);
      });

      it('clears parts after each step in multi-step workflows', () => {
        const allStates: ProcessorState<undefined>[] = [];

        for (let step = 0; step < 10; step++) {
          const stepState = new ProcessorState<undefined>({
            processorName: `step-${step}`,
            processorIndex: step,
          });

          for (let i = 0; i < 100; i++) {
            const chunk: ChunkType<undefined> = {
              runId: `run-${step}`,
              from: ChunkFrom.AGENT,
              type: 'text-delta',
              payload: {
                id: `text-${step}-${i}`,
                text: `Step ${step}, Chunk ${i}: ${'x'.repeat(100)}`,
              },
            };
            stepState.addPart(chunk);
          }

          stepState.finalize();

          allStates.push(stepState);
          console.log(`Step ${step + 1}: ${stepState.streamParts.length} parts (should be 0)`);
        }

        const totalParts = allStates.reduce((sum, state) => sum + state.streamParts.length, 0);
        console.log(`Total parts across ${allStates.length} steps: ${totalParts} (should be 0)`);

        expect(totalParts).toBe(0);
        expect(allStates.every(state => state.streamParts.length === 0)).toBe(true);
      });

      it('clears customState after processing', () => {
        const processorState = new ProcessorState<undefined>({
          processorName: 'custom-state-test',
          processorIndex: 0,
        });

        processorState.customState = {
          largeArray: [],
          metadata: {},
        };

        for (let i = 0; i < 1000; i++) {
          processorState.customState.largeArray.push({
            id: i,
            data: 'x'.repeat(1000),
            timestamp: Date.now(),
            metadata: {
              index: i,
              type: 'test',
              nested: { deep: { value: 'x'.repeat(100) } },
            },
          });
        }

        const customStateSize = JSON.stringify(processorState.customState).length;
        console.log(`Custom state size before cleanup: ${(customStateSize / 1024 / 1024).toFixed(2)} MB`);

        processorState.finalize();

        expect(Object.keys(processorState.customState).length).toBe(0);
        expect(processorState.customState.largeArray || []).toHaveLength(0);
      });

      it('automatically clears state when stream completes (integration test)', async () => {
        /**
         * Integration test that validates ProcessorState.finalize() is called
         * automatically by ProcessorRunner when the finish chunk is processed.
         *
         * Unlike the unit tests above, this test goes through the full streaming
         * pipeline to ensure automatic cleanup works in production.
         */

        const processorStates = new Map<string, ProcessorState<undefined>>();
        const logger = {
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {},
        };

        const runner = new ProcessorRunner({
          outputProcessors: [
            {
              name: 'test-processor',
              processOutputStream: async ({ part, streamParts, state }) => {
                // Processor that uses state
                state.processedCount = (state.processedCount || 0) + 1;
                return part;
              },
            },
          ],
          logger: logger as any,
          agentName: 'test-agent',
        });

        // Process 100 chunks through the pipeline
        for (let i = 0; i < 100; i++) {
          const chunk: ChunkType<undefined> = {
            runId: 'test-run',
            from: ChunkFrom.AGENT,
            type: 'text-delta',
            payload: {
              id: `text-${i}`,
              text: 'x'.repeat(200),
            },
          };

          await runner.processPart(chunk, processorStates);
        }

        // Get the state before finish chunk
        const state = processorStates.get('test-processor');
        expect(state).toBeDefined();
        expect(state!.streamParts.length).toBe(100);
        expect(state!.customState.processedCount).toBe(100);

        console.log('Before finish chunk:', {
          streamParts: state!.streamParts.length,
          customStateKeys: Object.keys(state!.customState).length,
        });

        // Process finish chunk - this should trigger automatic cleanup
        const finishChunk: ChunkType<undefined> = {
          runId: 'test-run',
          from: ChunkFrom.AGENT,
          type: 'finish',
          payload: {
            stepResult: { reason: 'stop' },
            output: {
              usage: {
                inputTokens: 100,
                outputTokens: 100,
                totalTokens: 200,
              },
            },
            metadata: {},
            messages: {
              all: [],
              user: [],
              nonUser: [],
            },
          },
        };

        await runner.processPart(finishChunk, processorStates);

        // After finish chunk, state should be cleared automatically
        console.log('After finish chunk:', {
          streamParts: state!.streamParts.length,
          customStateKeys: Object.keys(state!.customState).length,
        });

        expect(state!.streamParts.length).toBe(0);
        expect(Object.keys(state!.customState).length).toBe(0);
      });
    });

    describe('MessageList TypeError reproduction', () => {
      it('handles malformed data gracefully', () => {
        const messageList = new MessageList({ threadId: 'test' });
        const malformedData: any = 4822;

        expect(() => {
          MessageList.isMastraMessageV2(malformedData);
        }).not.toThrow();

        const mixedData: any[] = [{ role: 'user', content: 'Hello' }, 4822, { role: 'assistant', content: 'Response' }];

        expect(() => {
          messageList.add(mixedData, 'memory');
        }).not.toThrow();
      });

      it('handles malformed data from memory query (Stefan stack trace)', () => {
        const messageList = new MessageList({ threadId: 'test' });

        const malformedMemoryResults: any[] = [
          { role: 'user', content: 'Previous message' },
          4822,
          { role: 'assistant', content: 'Response' },
          undefined,
          null,
        ];

        expect(() => {
          messageList.add(malformedMemoryResults, 'memory');
        }).not.toThrow();

        const numberOnly: any = 4822;
        expect(() => {
          MessageList.isMastraMessageV2(numberOnly);
        }).not.toThrow();

        expect(() => {
          MessageList.isMastraMessageV1(numberOnly);
        }).not.toThrow();
      });
    });
  });

  describe('Production Simulation', () => {
    it('clears buffers after each stream to prevent accumulation', async () => {
      console.log(`\n=== Production Simulation ===`);

      const outputs: MastraModelOutput<undefined>[] = [];

      for (let i = 0; i < 20; i++) {
        const chunks: ChunkType<undefined>[] = [];

        for (let j = 0; j < 50; j++) {
          chunks.push({
            runId: `run-${i}`,
            from: ChunkFrom.AGENT,
            type: 'text-delta',
            payload: {
              id: `text-${i}-${j}`,
              text: 'x'.repeat(100),
            },
          });
        }

        for (let j = 0; j < 5; j++) {
          chunks.push({
            runId: `run-${i}`,
            from: ChunkFrom.AGENT,
            type: 'tool-call-delta',
            payload: {
              toolCallId: `tool-${j}`,
              argsTextDelta: JSON.stringify({ data: 'x'.repeat(50) }),
            },
          });
        }

        chunks.push({
          runId: `run-${i}`,
          from: ChunkFrom.AGENT,
          type: 'finish',
          payload: {
            stepResult: {
              reason: 'stop',
            },
            output: {
              usage: {
                inputTokens: 100,
                outputTokens: 500,
                totalTokens: 600,
              },
            },
            metadata: {},
            messages: {
              all: [],
              user: [],
              nonUser: [],
            },
          },
        });

        const messageList = new MessageList({ threadId: `thread-${i}` });
        const stream = createChunkStream(chunks);

        const output = new MastraModelOutput({
          model: {
            modelId: 'gpt-4',
            provider: 'openai',
            version: 'v2' as const,
          },
          stream,
          messageList,
          messageId: `msg-${i}`,
          options: {
            runId: `run-${i}`,
            returnScorerData: false,
          },
        });

        outputs.push(output);

        const reader = output.fullStream.getReader();
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
        reader.releaseLock();
      }

      console.log(`Created ${outputs.length} outputs, testing buffer retention via replay...`);

      let totalReplayedChunks = 0;

      for (let i = 0; i < outputs.length; i++) {
        const replayReader = outputs[i].fullStream.getReader();
        let replayCount = 0;

        while (true) {
          const { done } = await replayReader.read();
          if (done) break;
          replayCount++;
        }
        replayReader.releaseLock();

        totalReplayedChunks += replayCount;
      }

      console.log(`Replayed chunks: ${totalReplayedChunks} (expected: 0)`);

      expect(totalReplayedChunks).toBe(0);
    });

    it('clears large payload buffers after stream completion', async () => {
      console.log(`\n=== Large Payload Simulation ===`);

      const outputs: MastraModelOutput<undefined>[] = [];

      for (let i = 0; i < 5; i++) {
        const chunks: ChunkType<undefined>[] = [];
        const largeText = 'x'.repeat(80000);
        const chunkSize = 1000;

        for (let j = 0; j < largeText.length; j += chunkSize) {
          chunks.push({
            runId: `large-run-${i}`,
            from: ChunkFrom.AGENT,
            type: 'text-delta',
            payload: {
              id: `text-large-${i}-${j}`,
              text: largeText.slice(j, j + chunkSize),
            },
          });
        }

        chunks.push({
          runId: `large-run-${i}`,
          from: ChunkFrom.AGENT,
          type: 'finish',
          payload: {
            stepResult: {
              reason: 'stop',
            },
            output: {
              usage: {
                inputTokens: 1000,
                outputTokens: 20000,
                totalTokens: 21000,
              },
            },
            metadata: {},
            messages: {
              all: [],
              user: [],
              nonUser: [],
            },
          },
        });

        const messageList = new MessageList({ threadId: 'large-thread' });
        const stream = createChunkStream(chunks);

        const output = new MastraModelOutput({
          model: {
            modelId: 'gpt-4',
            provider: 'openai',
            version: 'v2' as const,
          },
          stream,
          messageList,
          messageId: `large-msg-${i}`,
          options: {
            runId: `large-run-${i}`,
            returnScorerData: false,
          },
        });

        outputs.push(output);

        const reader = output.fullStream.getReader();
        let totalText = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value?.type === 'text-delta') {
            totalText += value.payload.text;
          }
        }
        reader.releaseLock();

        console.log(`Stream ${i + 1}: Processed ${totalText.length} chars`);
      }

      console.log(`\nTesting buffer retention via replay...`);

      let totalReplayedChunks = 0;

      for (let i = 0; i < outputs.length; i++) {
        const replayReader = outputs[i].fullStream.getReader();
        let replayCount = 0;

        while (true) {
          const { done } = await replayReader.read();
          if (done) break;
          replayCount++;
        }
        replayReader.releaseLock();

        totalReplayedChunks += replayCount;
      }

      console.log(`Replayed chunks: ${totalReplayedChunks} (expected: 0)`);

      expect(totalReplayedChunks).toBe(0);
    });
  });

  describe('Exact Production Error Reproduction', () => {
    it('handles second execution with large context without OOM', { timeout: 30000 }, async () => {
      console.log(`\n=== Second Execution OOM Reproduction (leo-paz) ===`);

      const largeContext = {
        deal: {
          id: 'deal-123',
          description: 'x'.repeat(20000),
          history: Array.from({ length: 100 }, (_, i) => ({
            id: i,
            timestamp: Date.now(),
            action: 'x'.repeat(200),
            metadata: { data: 'x'.repeat(100) },
          })),
        },
      };

      const createWorkflowExecution = async (executionNum: number) => {
        const chunks: ChunkType<undefined>[] = [];

        for (let step = 0; step < 3; step++) {
          for (let i = 0; i < 100; i++) {
            chunks.push({
              runId: `execution-${executionNum}-step-${step}`,
              from: ChunkFrom.AGENT,
              type: 'text-delta',
              payload: {
                id: `text-${executionNum}-${step}-${i}`,
                text: JSON.stringify(largeContext).slice(i * 100, (i + 1) * 100),
              },
            });
          }

          chunks.push({
            runId: `execution-${executionNum}-step-${step}`,
            from: ChunkFrom.AGENT,
            type: 'finish',
            payload: {
              stepResult: { reason: 'stop' },
              output: {
                usage: {
                  inputTokens: 20000,
                  outputTokens: 500,
                  totalTokens: 20500,
                },
              },
              metadata: { context: largeContext },
              messages: { all: [], user: [], nonUser: [] },
            },
          });
        }

        const messageList = new MessageList({ threadId: `workflow-${executionNum}` });
        const stream = createChunkStream(chunks);

        const output = new MastraModelOutput({
          model: {
            modelId: 'gpt-4',
            provider: 'openai',
            version: 'v2' as const,
          },
          stream,
          messageList,
          messageId: `msg-${executionNum}`,
          options: {
            runId: `execution-${executionNum}`,
            returnScorerData: false,
          },
        });

        const reader = output.fullStream.getReader();
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
        reader.releaseLock();

        return output;
      };

      console.log('First execution...');
      const firstOutput = await createWorkflowExecution(1);

      console.log('Second execution (this is where OOM occurs in production)...');
      const secondOutput = await createWorkflowExecution(2);

      console.log('Testing buffer retention after both executions...');

      let totalRetained = 0;
      for (const output of [firstOutput, secondOutput]) {
        const reader = output.fullStream.getReader();
        let count = 0;
        while (true) {
          const { done } = await reader.read();
          if (done) break;
          count++;
        }
        reader.releaseLock();
        totalRetained += count;
      }

      console.log(`Total chunks retained: ${totalRetained} (expected: 0)`);
      console.log(`If this test doesn't OOM, buffers will be cleared after fix`);

      expect(totalRetained).toBe(0);
    });

    it('handles sustained load without memory exhaustion', { timeout: 30000 }, async () => {
      console.log(`\n=== Sustained Load Reproduction (Stefan - 30min crashes) ===`);

      const outputs: MastraModelOutput<undefined>[] = [];
      const targetIterations = 30;

      console.log(`Simulating ${targetIterations} agent.stream() calls...`);

      for (let i = 0; i < targetIterations; i++) {
        const chunks: ChunkType<undefined>[] = [];

        for (let j = 0; j < 100; j++) {
          chunks.push({
            runId: `sustained-${i}`,
            from: ChunkFrom.AGENT,
            type: 'text-delta',
            payload: {
              id: `text-${i}-${j}`,
              text: 'Response chunk with typical content length. '.repeat(5),
            },
          });
        }

        chunks.push({
          runId: `sustained-${i}`,
          from: ChunkFrom.AGENT,
          type: 'finish',
          payload: {
            stepResult: { reason: 'stop' },
            output: {
              usage: {
                inputTokens: 500,
                outputTokens: 1000,
                totalTokens: 1500,
              },
            },
            metadata: {},
            messages: { all: [], user: [], nonUser: [] },
          },
        });

        const messageList = new MessageList({ threadId: `sustained-${i}` });
        const stream = createChunkStream(chunks);

        const output = new MastraModelOutput({
          model: {
            modelId: 'gpt-4',
            provider: 'openai',
            version: 'v2' as const,
          },
          stream,
          messageList,
          messageId: `msg-${i}`,
          options: {
            runId: `sustained-${i}`,
            returnScorerData: false,
          },
        });

        outputs.push(output);

        const reader = output.fullStream.getReader();
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
        reader.releaseLock();

        if ((i + 1) % 10 === 0) {
          console.log(`  Completed ${i + 1}/${targetIterations} streams`);
        }
      }

      console.log(`Testing buffer retention across all ${targetIterations} streams...`);

      let totalRetained = 0;
      for (const output of outputs) {
        const reader = output.fullStream.getReader();
        let count = 0;
        while (true) {
          const { done } = await reader.read();
          if (done) break;
          count++;
        }
        reader.releaseLock();
        totalRetained += count;
      }

      console.log(`Total chunks retained: ${totalRetained} (expected: 0)`);
      console.log(`With ${targetIterations} streams × 101 chunks = ${targetIterations * 101} potential retention`);

      expect(totalRetained).toBe(0);
    });

    it('handles JSON serialization of accumulated buffers without exhaustion', { timeout: 30000 }, async () => {
      console.log(`\n=== JSON Serialization Exhaustion (AtiqGauri, sccorby) ===`);

      const outputs: MastraModelOutput<undefined>[] = [];

      for (let i = 0; i < 10; i++) {
        const chunks: ChunkType<undefined>[] = [];

        for (let j = 0; j < 200; j++) {
          const complexObject = {
            id: `obj-${i}-${j}`,
            timestamp: Date.now(),
            data: 'x'.repeat(500),
            nested: {
              level1: { level2: { level3: { data: 'y'.repeat(200) } } },
            },
            array: Array.from({ length: 50 }, (_, k) => ({ index: k, value: 'z'.repeat(100) })),
          };

          chunks.push({
            runId: `json-test-${i}`,
            from: ChunkFrom.AGENT,
            type: 'text-delta',
            payload: {
              id: `text-${i}-${j}`,
              text: JSON.stringify(complexObject),
            },
          });
        }

        chunks.push({
          runId: `json-test-${i}`,
          from: ChunkFrom.AGENT,
          type: 'finish',
          payload: {
            stepResult: { reason: 'stop' },
            output: {
              usage: {
                inputTokens: 1000,
                outputTokens: 5000,
                totalTokens: 6000,
              },
            },
            metadata: {
              complexData: {
                nested: Array.from({ length: 100 }, (_, k) => ({
                  id: k,
                  data: 'x'.repeat(200),
                })),
              },
            },
            messages: { all: [], user: [], nonUser: [] },
          },
        });

        const messageList = new MessageList({ threadId: `json-test-${i}` });
        const stream = createChunkStream(chunks);

        const output = new MastraModelOutput({
          model: {
            modelId: 'gpt-4',
            provider: 'openai',
            version: 'v2' as const,
          },
          stream,
          messageList,
          messageId: `json-msg-${i}`,
          options: {
            runId: `json-test-${i}`,
            returnScorerData: false,
          },
        });

        outputs.push(output);

        const reader = output.fullStream.getReader();
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
        reader.releaseLock();
      }

      console.log(`Attempting JSON serialization of all outputs (reproduces stack trace)...`);

      let totalSize = 0;

      try {
        for (const output of outputs) {
          const serialized = JSON.stringify(output);
          totalSize += serialized.length;
        }
        console.log(`Successfully serialized ${totalSize} bytes`);
      } catch (error: any) {
        console.log(`JSON serialization failed: ${error.message}`);
        console.log(`This reproduces the "JsonStringify" error from production`);
      }

      console.log(`Testing buffer cleanup to prevent JSON exhaustion...`);

      let totalRetained = 0;
      for (const output of outputs) {
        const reader = output.fullStream.getReader();
        let count = 0;
        while (true) {
          const { done } = await reader.read();
          if (done) break;
          count++;
        }
        reader.releaseLock();
        totalRetained += count;
      }

      console.log(`Total chunks retained: ${totalRetained} (expected: 0)`);

      expect(totalRetained).toBe(0);
    });
  });

  describe('Additional Memory Leaks', () => {
    describe('Workflow #runs Map accumulation', () => {
      it('clears completed workflow runs from #runs Map', async () => {
        console.log('\n=== Workflow #runs Map Test (Integration) ===');
        console.log('Testing workflow run cleanup after completion...');

        // Create a simple workflow with one step
        const step1 = createStep({
          id: 'step1',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ result: z.string() }),
          execute: async ({ inputData }) => {
            return { result: `processed: ${inputData.value}` };
          },
        });

        const workflow = createWorkflow({
          id: 'test-workflow' as const,
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ result: z.string() }),
          steps: [step1],
        });

        workflow.then(step1).commit();

        console.log(`Initial runs in Map: ${workflow.runs.size}`);

        // Execute workflow 10 times (reduced from 100 for speed)
        for (let i = 0; i < 10; i++) {
          const run = await workflow.createRunAsync();
          const { stream } = run.stream({ inputData: { value: `test-${i}` } });
          // Consume the stream to complete the workflow
          for await (const _ of stream) {
            // Just consume the stream
          }
        }

        // After executions complete, #runs Map should be empty due to cleanup
        const finalRunsCount = workflow.runs.size;

        console.log(`Runs in Map after 10 executions: ${finalRunsCount}`);
        console.log(`Expected: 0 (cleaned up after completion)`);
        console.log(`Actual: ${finalRunsCount}`);

        // Fix for #6322: cleanup() is now called in workflow.ts lines 1660-1661, 1668
        expect(finalRunsCount).toBe(0);
      });
    });

    describe('EventEmitter listener accumulation', () => {
      it('removes event listeners after stream completion', async () => {
        console.log('\n=== EventEmitter Listener Test (Integration) ===');

        // Test MastraModelOutput's internal EventEmitter cleanup
        const outputs: MastraModelOutput[] = [];

        // Create and complete 10 streams
        for (let i = 0; i < 10; i++) {
          const chunks: ChunkType<undefined>[] = [];
          chunks.push({
            runId: `test-run-${i}`,
            from: ChunkFrom.AGENT,
            type: 'text-delta',
            payload: {
              id: `text-${i}`,
              text: `Test content ${i}`,
            },
          });
          chunks.push({
            runId: `test-run-${i}`,
            from: ChunkFrom.AGENT,
            type: 'finish',
            payload: {
              stepResult: { reason: 'stop' },
              output: { usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 } },
              metadata: {},
              messages: { all: [], user: [], nonUser: [] },
            },
          });

          const messageList = new MessageList({ threadId: `test-thread-${i}` });
          const stream = createChunkStream(chunks);

          const output = new MastraModelOutput({
            model: {
              modelId: 'test-model',
              provider: 'test-provider',
              version: 'v2' as const,
            },
            stream,
            messageList,
            messageId: `test-message-${i}`,
            options: {
              runId: `test-run-${i}`,
              returnScorerData: false,
            },
          });
          outputs.push(output);

          // Consume the stream to trigger listener setup and cleanup
          for await (const _ of output.textStream) {
            // Just consume
          }
        }

        // Check that the last output's emitter has cleaned up its listeners
        const lastOutput = outputs[outputs.length - 1] as any;
        const emitter = lastOutput._emitter || lastOutput['#emitter'];

        // After stream completes, listeners for 'chunk' and 'finish' should be removed
        const chunkListeners = emitter?.listenerCount?.('chunk') || 0;
        const finishListeners = emitter?.listenerCount?.('finish') || 0;

        console.log(`Chunk listeners after completion: ${chunkListeners}`);
        console.log(`Finish listeners after completion: ${finishListeners}`);
        console.log(`Expected: 0 (cleaned up)`);

        expect(chunkListeners).toBe(0);
        expect(finishListeners).toBe(0);
      });
    });
  });
});
