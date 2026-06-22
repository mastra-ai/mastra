import type {
  Agent,
  AgentSideConnection,
  InitializeRequest,
  InitializeResponse,
  NewSessionRequest,
  NewSessionResponse,
  PromptRequest,
  PromptResponse,
  CancelNotification,
  ContentBlock,
} from '@agentclientprotocol/sdk';
import { PROTOCOL_VERSION } from '@agentclientprotocol/sdk';
import type { Harness, HarnessMode } from '@mastra/core/harness';
import { handleHarnessEvent } from './event-mapper.js';
import type { PromptState } from './event-mapper.js';

/**
 * ACP Agent implementation that wraps a mastracode Harness.
 * Each instance represents one ACP connection from a client.
 */
export class MastraCodeAcpAgent implements Agent {
  private readonly connection: AgentSideConnection;
  private readonly harness: Harness;
  private readonly modes: HarnessMode[];
  private readonly sessionMap = new Map<string, string>(); // sessionId -> threadId
  private currentPromptState: PromptState | null = null;
  private promptMutex: Promise<void> = Promise.resolve();

  private getThreadIdOrThrow(sessionId: string): string {
    const threadId = this.sessionMap.get(sessionId);
    if (!threadId) {
      throw new Error(`Unknown ACP sessionId: ${sessionId}`);
    }
    return threadId;
  }

  constructor(connection: AgentSideConnection, harness: Harness, modes: HarnessMode[]) {
    this.connection = connection;
    this.harness = harness;
    this.modes = modes;

    // Register persistent event listener
    this.harness.subscribe(event => {
      handleHarnessEvent(event, this.currentPromptState, this.connection, this.harness);
    });
  }

  async initialize(_request: InitializeRequest): Promise<InitializeResponse> {
    return {
      protocolVersion: PROTOCOL_VERSION,
      agentInfo: {
        name: 'mastracode',
        title: 'Mastra Code',
        version: '0.1.0',
      },
      agentCapabilities: {
        loadSession: false,
      },
    };
  }

  async authenticate(): Promise<void> {
    // No-op: mastracode handles its own auth
  }

  async newSession(_request: NewSessionRequest): Promise<NewSessionResponse> {
    const thread = await this.harness.createThread();
    const sessionId = thread.id;
    this.sessionMap.set(sessionId, thread.id);

    // Switch to the new thread
    await this.harness.switchThread({ threadId: thread.id });

    // Build modes list from constructor param
    const availableModes = this.modes.map((m: HarnessMode) => ({
      id: m.id,
      name: m.name ?? m.id,
    }));

    const currentModeId = this.harness.session.mode.get();

    // Build models list (best-effort)
    let models: NewSessionResponse['models'];
    try {
      const availableModels = await this.harness.listAvailableModels();
      const currentModelId = this.harness.session.model.get();
      models = {
        currentModelId: currentModelId ?? '',
        availableModels: availableModels.map(m => ({
          modelId: m.id,
          name: m.modelName,
        })),
      };
    } catch {
      // Model listing may fail if no providers are configured
    }

    return {
      sessionId,
      modes: {
        currentModeId,
        availableModes,
      },
      models,
    };
  }

  async prompt(request: PromptRequest): Promise<PromptResponse> {
    const { sessionId, prompt: contentBlocks } = request;

    // Extract text from content blocks
    const text = extractTextFromContentBlocks(contentBlocks);

    // Ensure we're on the right thread
    const threadId = this.getThreadIdOrThrow(sessionId);
    await this.harness.switchThread({ threadId });

    // Serialize prompts via mutex
    const prevMutex = this.promptMutex;
    let resolveMutex: () => void;
    this.promptMutex = new Promise<void>(resolve => {
      resolveMutex = resolve;
    });

    await prevMutex;

    try {
      // Create prompt state that will be resolved when agent_end fires
      const result = new Promise<{
        reason: 'complete' | 'aborted' | 'error' | 'suspended';
        usage: PromptState['usage'];
      }>(resolve => {
        const usage: PromptState['usage'] = {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        };

        this.currentPromptState = {
          sessionId,
          lastTextLength: 0,
          usage,
          resolve: reason => {
            resolve({ reason, usage });
            this.currentPromptState = null;
          },
        };
      });

      // Send the message to the harness
      try {
        await this.harness.sendMessage({ content: text });
      } catch (error) {
        this.currentPromptState = null;
        throw error;
      }

      // Wait for agent_end to resolve
      const { reason, usage } = await result;

      return {
        stopReason: mapStopReason(reason),
        usage: {
          inputTokens: usage.promptTokens,
          outputTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
          thoughtTokens: usage.reasoningTokens,
          cachedReadTokens: usage.cachedInputTokens,
          cachedWriteTokens: usage.cacheCreationInputTokens,
        },
      };
    } finally {
      resolveMutex!();
    }
  }

  async cancel(_notification: CancelNotification): Promise<void> {
    this.harness.abort();
  }

  async setSessionMode(params: { sessionId: string; modeId: string }): Promise<void> {
    const threadId = this.getThreadIdOrThrow(params.sessionId);
    await this.harness.switchThread({ threadId });
    this.harness.session.mode.set({ modeId: params.modeId });
  }

  async unstable_setSessionModel(params: { sessionId: string; modelId: string }): Promise<void> {
    const threadId = this.getThreadIdOrThrow(params.sessionId);
    await this.harness.switchThread({ threadId });
    this.harness.session.model.set({ modelId: params.modelId });
  }
}

export function extractTextFromContentBlocks(blocks: ContentBlock[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.type === 'text') {
      parts.push(block.text);
    } else if (block.type === 'resource_link') {
      parts.push(`[resource: ${block.uri}]`);
    } else if (block.type === 'resource') {
      parts.push(`[resource: ${block.resource.uri}]`);
    }
  }
  return parts.join('\n');
}

export function mapStopReason(
  reason: 'complete' | 'aborted' | 'error' | 'suspended',
): 'end_turn' | 'cancelled' | 'max_tokens' | 'max_turn_requests' | 'refusal' {
  switch (reason) {
    case 'complete':
      return 'end_turn';
    case 'aborted':
      return 'cancelled';
    case 'error':
      return 'end_turn';
    case 'suspended':
      return 'end_turn';
  }
}
