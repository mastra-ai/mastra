import { google } from '@ai-sdk/google';
import { config } from 'dotenv';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createTool } from '../tools';
import { Agent } from './index';

config();

describe('Agent - Repetitive Tool Calls Issue #6827', () => {
  it('should test with real Gemini 2.5 Pro to see repetitive tool behavior', async () => {
    // Track how many times the tool is actually executed
    let toolExecutionCount = 0;
    let onStepFinishCount = 0;
    const executedToolCallIds: string[] = [];

    // Create a tool using Mastra's createTool
    const notifyTool = createTool({
      id: 'notify-care-team',
      description: 'Notify the care team about a patient request',
      inputSchema: z.object({
        message: z.string().optional().describe('Optional message to include'),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        notificationId: z.string(),
      }),
      execute: async () => {
        toolExecutionCount++;
        const id = `notification-${Date.now()}-${toolExecutionCount}`;
        executedToolCallIds.push(id);
        console.log(`Tool executed ${toolExecutionCount} times, ID: ${id}`);
        return {
          success: true,
          notificationId: id,
        };
      },
    });

    const geminiModel = google('gemini-2.5-pro'); // Using flash for testing, but can switch to gemini-2.5-pro

    // Create agent with real model
    const agent = new Agent({
      name: 'CareTeamAgent',
      instructions: `You are a helpful healthcare assistant. When asked to notify the care team, 
        use the notify-care-team tool ONCE. Do not call it multiple times unless explicitly asked.`,
      model: geminiModel,
      tools: {
        'notify-care-team': notifyTool,
      },
    });

    // Track what happens in each step
    const stepDetails: any[] = [];

    // Execute the agent with a request that should trigger ONE tool call
    console.log('\n=== Starting Agent Execution ===');

    const result = await agent.generate('Please notify my care team that I need assistance.', {
      maxSteps: 5, // Limit to prevent infinite loops
      onStepFinish: async step => {
        onStepFinishCount++;
        stepDetails.push({
          stepNumber: onStepFinishCount,
          finishReason: step.finishReason,
          toolCalls: step.toolCalls?.length || 0,
          text: step.text?.substring(0, 100),
        });
        console.log(`\nStep ${onStepFinishCount}:`);
        console.log('- Finish reason:', step.finishReason);
        console.log('- Tool calls in step:', step.toolCalls?.length || 0);
        if (step.toolCalls?.length) {
          step.toolCalls.forEach((tc: any) => {
            console.log(`  - Tool: ${tc.toolName}, ID: ${tc.toolCallId}`);
          });
        }
      },
    });

    // Consume the stream
    // console.log('\n=== Streaming Output ===');
    // for await (const chunk of result.fullStream) {
    //   console.log(chunk.type);
    //   // Just consume the stream
    //   if (chunk.type === 'text-delta') {
    //     process.stdout.write((chunk as any).textDelta || '');
    //   }
    // }

    console.log('\n\n=== FINAL RESULTS ===');
    console.log('Tool execution count:', toolExecutionCount);
    console.log('onStepFinish count:', onStepFinishCount);
    console.log('Executed tool call IDs:', executedToolCallIds);
    console.log('\nStep details:', JSON.stringify(stepDetails, null, 2));

    // ASSERTIONS - Testing for the bug
    // The bug: Tool gets called multiple times for the same request
    // Expected: Tool should only be executed once
    // Actual (with bug): Tool may be executed multiple times

    expect(toolExecutionCount).toBe(1); // Should only execute once
    expect(onStepFinishCount).toBeLessThanOrEqual(2); // Should finish in 1-2 steps max (tool call + response)

    // Log for debugging
    if (toolExecutionCount > 1) {
      console.error('\n⚠️  BUG DETECTED: Tool was executed', toolExecutionCount, 'times instead of once!');
    }
  }, 20_000);

  it('should call a final options tool exactly once at end of conversation', async () => {
    let toolExecutionCount = 0;
    const callIds: string[] = [];

    const presentChoicesTool = createTool({
      id: 'present-choices',
      description: 'Present user with final choices before ending the conversation',
      inputSchema: z.object({
        title: z.string().optional().describe('Optional title for the choices list'),
        choices: z.array(z.string()).min(1).describe('List of choices to present'),
      }),
      outputSchema: z.object({
        presented: z.boolean(),
        count: z.number(),
      }),
      execute: async ({ context }) => {
        toolExecutionCount++;
        const id = `present-${Date.now()}-${toolExecutionCount}`;
        callIds.push(id);
        console.log(`present-choices executed ${toolExecutionCount} times, ID: ${id}`);
        return { presented: true, count: toolExecutionCount };
      },
    });

    const geminiModel = google('gemini-2.5-pro');

    const agent = new Agent({
      name: 'OptionsAgent',
      instructions: `You are a helpful assistant. Provide a concise final answer. Then, as the very last action, call the 'present-choices' tool exactly once to present user options and then stop. Do not call any tool more than once.`,
      model: geminiModel,
      tools: {
        'present-choices': presentChoicesTool,
      },
    });

    const stepDetails: any[] = [];

    const result = await agent.generate(
      'Briefly explain benefits of a standing desk, then at the end present options A, B, C.',
      {
        maxSteps: 5,
        onStepFinish: async step => {
          stepDetails.push({
            finishReason: step.finishReason,
            toolCalls: step.toolCalls?.length || 0,
            text: step.text,
          });
          console.log('Finish reason:', step.finishReason, '- Tools:', step.toolCalls?.length || 0);
          if (step.text) {
            console.log('STEP TEXT:', step.text);
          }
        },
      },
    );

    console.log('RESULT TEXT:', result?.text);

    const totalToolCallsAcrossSteps = stepDetails.reduce((sum, s) => sum + (s.toolCalls || 0), 0);

    console.log('\nFINAL (end-of-convo) toolExecutionCount:', toolExecutionCount);
    console.log('FINAL (end-of-convo) toolCallsAcrossSteps:', totalToolCallsAcrossSteps);
    console.log('FINAL (end-of-convo) callIds:', callIds);
    console.log('FINAL (end-of-convo) stepDetails:', JSON.stringify(stepDetails, null, 2));

    expect(toolExecutionCount).toBe(1);
    expect(totalToolCallsAcrossSteps).toBeLessThanOrEqual(1);
  }, 30_000);

  it('should test with a more complex scenario to trigger the bug', async () => {
    let toolExecutionCount = 0;

    // Create a simple tool
    const echoTool = createTool({
      id: 'echo',
      description: 'Echo back a message',
      inputSchema: z.object({
        message: z.string(),
      }),
      outputSchema: z.object({
        echoed: z.string(),
      }),
      execute: async ({ context }) => {
        toolExecutionCount++;
        console.log(`Echo tool executed ${toolExecutionCount} times with:`, context.message);
        return { echoed: context.message };
      },
    });

    // Try with gemini-2.5-pro specifically as reported in the issue
    const geminiModel = google('gemini-2.5-pro'); // Change to 'gemini-2.5-pro' if available

    const agent = new Agent({
      name: 'EchoAgent',
      instructions: 'You are a helpful assistant. Use tools when asked.',
      model: geminiModel,
      tools: {
        echo: echoTool,
      },
    });

    // Try multiple prompts that might trigger the issue
    const testPrompts = [
      'Use the echo tool to say "hello"',
      'Echo "test message" for me',
      'Can you use the echo tool with message "bug test"',
    ];

    for (const prompt of testPrompts) {
      toolExecutionCount = 0;
      console.log(`\n=== Testing prompt: "${prompt}" ===`);

      const result = await agent.generate(prompt, {
        maxSteps: 5,
        onStepFinish: async step => {
          console.log('Step finished:', step.finishReason, '- Tools:', step.toolCalls?.length || 0);
        },
      });

      // for await (const _ of result.fullStream) {
      //   console.log(_.type);
      //   // Consume stream
      // }

      console.log('Tool executions for this prompt:', toolExecutionCount);

      if (toolExecutionCount > 1) {
        console.error('⚠️  BUG DETECTED: Tool executed', toolExecutionCount, 'times!');
        // Don't fail immediately, continue testing other prompts
      }
    }
  }, 20_000);
});
