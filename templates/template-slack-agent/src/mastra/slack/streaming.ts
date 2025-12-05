import type { WebClient } from '@slack/web-api';
import { ANIMATION_INTERVAL, STEP_DISPLAY_DELAY, TOOL_DISPLAY_DELAY } from './constants.js';
import { getStatusText } from './status.js';
import { formatName, sleep } from './utils.js';
import type { StreamingOptions, StreamState } from './types.js';

export type { StreamingOptions } from './types.js';

export async function streamToSlack(options: StreamingOptions): Promise<void> {
  const { mastra, slackClient, channel, threadTs, agentName, message, resourceId, threadId } = options;

  const state: StreamState = { text: '', chunkType: 'start' };

  let messageTs: string | undefined;
  let frame = 0;
  let animationTimer: NodeJS.Timeout | undefined;
  let isFinished = false;

  // ─────────────────────────────────────────────────────────────────────────────
  // Slack helpers
  // ─────────────────────────────────────────────────────────────────────────────

  const stopAnimation = () => {
    isFinished = true;
    if (animationTimer) {
      clearInterval(animationTimer);
      animationTimer = undefined;
    }
  };

  const updateSlack = async (text?: string) => {
    if (!messageTs || isFinished) return;
    try {
      await slackClient.chat.update({
        channel,
        ts: messageTs,
        text: text ?? getStatusText(state, frame),
      });
    } catch {
      /* ignore rate limits during animation */
    }
  };

  const sendFinalMessage = async (text: string) => {
    await retrySlackUpdate(slackClient, channel, messageTs!, text);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Main
  // ─────────────────────────────────────────────────────────────────────────────

  try {
    // Post initial "thinking" message
    const initial = await slackClient.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: getStatusText(state, 0),
    });
    messageTs = initial.ts as string;

    // Start animation loop
    animationTimer = setInterval(() => {
      if (!isFinished) {
        frame++;
        updateSlack();
      }
    }, ANIMATION_INTERVAL);

    // Get agent and start streaming
    const agent = mastra.getAgent(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);

    const stream = await agent.stream(message, {
      resourceId,
      threadId,
    });

    // Process chunks
    for await (const chunk of stream.fullStream) {
      state.chunkType = chunk.type;

      switch (chunk.type) {
        case 'text-delta':
          if (chunk.payload.text) {
            state.text += chunk.payload.text;
          }
          break;

        case 'tool-call':
          state.toolName = formatName(chunk.payload.toolName);
          frame++;
          await updateSlack();
          await sleep(TOOL_DISPLAY_DELAY);
          break;

        case 'tool-output':
          // Workflow events come wrapped in tool-output chunks
          if (chunk.payload.output && typeof chunk.payload.output === 'object') {
            const output = chunk.payload.output as { type?: string; payload?: { id?: string; stepId?: string } };
            // Use the inner workflow event type for display
            if (output.type) {
              state.chunkType = output.type;
            }
            if (output.type === 'workflow-step-start') {
              state.stepName = formatName(output.payload?.id || output.payload?.stepId || 'step');
              frame++;
              await updateSlack();
              await sleep(STEP_DISPLAY_DELAY);
            }
          }
          break;

        case 'workflow-execution-start':
          state.workflowName = formatName(chunk.payload.name || chunk.payload.workflowId);
          state.stepName = 'Starting';
          break;
      }
    }

    // Done — send final response
    stopAnimation();
    await sendFinalMessage(state.text || "Sorry, I couldn't generate a response.");
    console.log('✅ Response sent to Slack');
  } catch (error) {
    console.error('❌ Error streaming to Slack:', error);
    stopAnimation();

    const errorText = `❌ Error: ${error instanceof Error ? error.message : String(error)}`;
    if (messageTs) {
      await sendFinalMessage(errorText);
    } else {
      await slackClient.chat.postMessage({ channel, thread_ts: threadTs, text: errorText }).catch(() => {});
    }

    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function retrySlackUpdate(client: WebClient, channel: string, ts: string, text: string, maxAttempts = 3) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await client.chat.update({ channel, ts, text });
      return;
    } catch (err) {
      console.error(`❌ Final message attempt ${attempt + 1} failed:`, err);
      if (attempt < maxAttempts - 1) await sleep(500);
    }
  }
  console.error(`❌ Failed to send final message after ${maxAttempts} attempts`);
}
