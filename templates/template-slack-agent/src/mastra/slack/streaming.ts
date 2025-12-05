import { WebClient } from '@slack/web-api';
import type { Mastra } from '@mastra/core/mastra';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const TOOL_ICONS = ['🔄', '⚙️', '🔧', '⚡'];
const WORKFLOW_ICONS = ['📋', '⚡', '🔄', '✨'];

const ANIMATION_INTERVAL = 300;
const TOOL_DISPLAY_DELAY = 300;
const STEP_DISPLAY_DELAY = 300;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface StreamingOptions {
  mastra: Mastra;
  slackClient: WebClient;
  channel: string;
  threadTs: string;
  agentName: string;
  message: string;
  resourceId: string;
  threadId: string;
}

type Status = 'thinking' | 'routing' | 'tool_call' | 'workflow_step' | 'agent_call' | 'responding';

interface State {
  text: string;
  status: Status;
  toolName?: string;
  workflowName?: string;
  stepName?: string;
  agentName?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Convert kebab-case/snake_case/camelCase to Title Case */
const formatName = (id: string) =>
  id
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

/** Get animated status text for Slack message */
function getStatusText(state: State, frame: number): string {
  const spinner = SPINNER[frame % SPINNER.length];
  const toolIcon = TOOL_ICONS[frame % TOOL_ICONS.length];
  const workflowIcon = WORKFLOW_ICONS[frame % WORKFLOW_ICONS.length];

  switch (state.status) {
    case 'thinking':
      return `${spinner} Thinking...`;
    case 'routing':
      return `${spinner} Routing...`;
    case 'tool_call':
      return `${toolIcon} Using ${state.toolName}...`;
    case 'workflow_step':
      return `${workflowIcon} ${state.workflowName}: ${state.stepName}...`;
    case 'agent_call':
      return `${spinner} Calling ${state.agentName}...`;
    case 'responding':
      return `${spinner} Responding...`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export async function streamToSlack(options: StreamingOptions): Promise<void> {
  const { mastra, slackClient, channel, threadTs, agentName, message, resourceId, threadId } = options;

  const state: State = { text: '', status: 'thinking' };
  const stepQueue: string[] = [];

  let messageTs: string | undefined;
  let frame = 0;
  let animationTimer: NodeJS.Timeout | undefined;

  const updateSlack = async (text?: string) => {
    if (!messageTs) return;
    try {
      await slackClient.chat.update({
        channel,
        ts: messageTs,
        text: text ?? getStatusText(state, frame),
      });
    } catch {
      /* ignore rate limits */
    }
  };

  const showToolCall = async (name: string) => {
    state.status = 'tool_call';
    state.toolName = name;
    frame++;
    await updateSlack();
    await sleep(TOOL_DISPLAY_DELAY);
  };

  const showQueuedSteps = async () => {
    if (stepQueue.length === 0 || !messageTs) return;

    for (const stepName of stepQueue) {
      state.stepName = stepName;
      frame++;
      await updateSlack();
      await sleep(STEP_DISPLAY_DELAY);
    }
    stepQueue.length = 0;
  };

  try {
    // Post initial message
    const initial = await slackClient.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: getStatusText(state, 0),
    });
    messageTs = initial.ts as string;

    // Start animation loop
    animationTimer = setInterval(() => {
      frame++;
      updateSlack();
    }, ANIMATION_INTERVAL);

    // Get agent
    const agent = mastra.getAgent(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);

    // Stream via network() for workflow visibility
    const stream = await agent.network(message, {
      memory: { thread: threadId, resource: resourceId },
    });

    // Process stream chunks
    for await (const chunk of stream) {
      const type = chunk.type as string;
      const payload = (chunk as any).payload || {};
      console.log(`📦 ${type}`);

      switch (type) {
        case 'routing-agent-start':
          state.status = 'routing';
          break;

        case 'tool-execution-start': {
          const args = payload.args || {};
          const name = args.toolName || args.primitiveId || payload.toolName || 'tool';
          await showToolCall(formatName(name));
          break;
        }

        case 'routing-agent-tool-call':
        case 'tool-call':
          state.status = 'tool_call';
          state.toolName = formatName(payload.toolName || payload.name || 'tool');
          break;

        case 'workflow-execution-start':
          state.status = 'workflow_step';
          state.workflowName = formatName(payload.name || payload.workflowId || 'Workflow');
          state.stepName = 'Starting';
          break;

        case 'workflow-execution-event-workflow-step-start': {
          state.status = 'workflow_step';
          const inner = payload.payload || payload;
          state.stepName = formatName(inner.stepName || inner.id || 'Processing');
          stepQueue.push(state.stepName);
          break;
        }

        case 'workflow-execution-end':
          await showQueuedSteps();
          break;

        case 'agent-execution-start':
          state.status = 'agent_call';
          state.agentName = formatName(payload.agentId || payload.name || 'agent');
          break;

        case 'agent-execution-event-text-delta': {
          const inner = payload.payload || payload;
          if (inner.text) {
            state.text += inner.text;
            state.status = 'responding';
          }
          break;
        }

        case 'routing-agent-text-delta':
          if (payload.text) {
            state.text += payload.text;
            state.status = 'responding';
          }
          break;

        case 'network-execution-event-step-finish':
          if (payload.result?.text) {
            state.text = payload.result.text;
          }
          break;
      }
    }

    // Finalize
    clearInterval(animationTimer);
    console.log('📝 Final text:', state.text ? `"${state.text.slice(0, 100)}..."` : '(empty)');
    await updateSlack(state.text || "Sorry, I couldn't generate a response.");
    console.log('✅ Response sent to Slack');
  } catch (error) {
    console.error('❌ Error streaming to Slack:', error);
    if (animationTimer) clearInterval(animationTimer);

    const errorText = `❌ Error: ${error instanceof Error ? error.message : String(error)}`;

    if (messageTs) {
      await updateSlack(errorText);
    } else {
      await slackClient.chat.postMessage({ channel, thread_ts: threadTs, text: errorText }).catch(() => {});
    }

    throw error;
  }
}
