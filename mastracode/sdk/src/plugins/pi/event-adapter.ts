import type { AgentControllerEvent } from '@mastra/core/agent-controller';

import type { PiExtensionGeneration } from './types.js';
import { createPiExtensionContext } from './ui-adapter.js';

export interface PiSessionEventSource {
  subscribe(listener: (event: AgentControllerEvent) => void | Promise<void>): () => void;
  onBeforeAgentEnd?(
    listener: (event: Extract<AgentControllerEvent, { type: 'agent_end' }>) => void | Promise<void>,
  ): () => void;
}

export type PiEventAdapterOptions = {
  cwd: string;
  mode?: 'tui' | 'rpc' | 'json' | 'print';
  hasUI?: boolean;
};

function context(generation: PiExtensionGeneration, options: PiEventAdapterOptions) {
  return createPiExtensionContext(generation, { cwd: options.cwd, mode: options.mode ?? 'tui' });
}

function mapControllerEvent(event: AgentControllerEvent): Array<{ name: string; payload: Record<string, unknown> }> {
  switch (event.type) {
    case 'agent_start':
      return [
        { name: 'agent_start', payload: { type: 'agent_start' } },
        { name: 'turn_start', payload: { type: 'turn_start', turnIndex: 0, timestamp: 0 } },
      ];
    case 'agent_end':
      return [];
    case 'message_start':
    case 'message_update':
      return [{ name: event.type, payload: { type: event.type, message: event.message } }];
    case 'message_end':
      return [];
    case 'tool_start':
      return [
        {
          name: 'tool_execution_start',
          payload: {
            type: 'tool_execution_start',
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args,
          },
        },
      ];
    case 'tool_update':
      return [
        {
          name: 'tool_execution_update',
          payload: {
            type: 'tool_execution_update',
            toolCallId: event.toolCallId,
            partialResult: event.partialResult,
          },
        },
      ];
    case 'tool_end':
      return [
        {
          name: 'tool_execution_end',
          payload: {
            type: 'tool_execution_end',
            toolCallId: event.toolCallId,
            result: event.result,
            isError: event.isError,
          },
        },
      ];
    case 'model_changed':
      return [
        {
          name: 'model_select',
          payload: { type: 'model_select', model: { id: event.modelId }, previousModel: undefined, source: 'set' },
        },
      ];
    case 'mode_changed':
      return [
        {
          name: 'thinking_level_select',
          payload: {
            type: 'thinking_level_select',
            level: event.modeId,
            previousLevel: event.previousModeId,
          },
        },
      ];
    case 'thread_changed':
      return [
        {
          name: 'session_info_changed',
          payload: { type: 'session_info_changed', threadId: event.threadId, previousThreadId: event.previousThreadId },
        },
      ];
    default:
      return [];
  }
}

function normalizeEventPayload(
  generation: PiExtensionGeneration,
  name: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  try {
    structuredClone(payload);
    return JSON.parse(
      JSON.stringify(payload, (_key, value: unknown) => {
        if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
        return typeof value === 'bigint' ? value.toString() : value;
      }),
    ) as Record<string, unknown>;
  } catch {
    generation.addDiagnostic(
      'warning',
      `Pi extension "${generation.extensionId}" received non-serializable ${name} data; Mastra Code omitted the host payload.`,
      `event:${name}:non-serializable`,
    );
    return Object.fromEntries(
      ['type', 'toolCallId', 'toolName', 'isError']
        .filter(key => ['string', 'boolean', 'number'].includes(typeof payload[key]))
        .map(key => [key, payload[key]]),
    );
  }
}

export class PiEventAdapter {
  readonly #options: PiEventAdapterOptions;
  #generations: PiExtensionGeneration[] = [];
  #unsubscribe?: () => void;
  #unsubscribeBeforeEnd?: () => void;
  #attached = false;
  #attachment = 0;
  #generationRevision = 0;
  #lastMessage: unknown;
  #toolResults: unknown[] = [];
  #runActive = false;
  #dispatchQueue = Promise.resolve();
  readonly #diagnosedGenerations = new WeakSet<PiExtensionGeneration>();

  constructor(options: PiEventAdapterOptions) {
    this.#options = options;
  }

  async setGenerations(generations: PiExtensionGeneration[]): Promise<void> {
    if (
      generations.length === this.#generations.length &&
      generations.every((generation, index) => generation === this.#generations[index])
    ) {
      return;
    }
    this.#generationRevision += 1;
    const prior = new Set(this.#generations);
    const next = new Set(generations);
    if (this.#attached) {
      await this.#dispatchQueue;
      this.#runActive = false;
      this.#lastMessage = undefined;
      this.#toolResults = [];

      for (const generation of prior) {
        if (!next.has(generation))
          await this.#dispatchToGeneration(generation, 'session_shutdown', { type: 'session_shutdown' });
      }
    }
    this.#generations = [...generations];
    for (const generation of generations) {
      if (this.#diagnosedGenerations.has(generation)) continue;
      this.#diagnosedGenerations.add(generation);
      if (generation.hasHandlers('turn_start') || generation.hasHandlers('turn_end')) {
        generation.addDiagnostic(
          'warning',
          `Pi extension "${generation.extensionId}" receives one adapted Pi turn per Mastra Code agent run.`,
          'event:turn-granularity',
        );
      }
      if (generation.hasHandlers('agent_end')) {
        generation.addDiagnostic(
          'warning',
          `Pi extension "${generation.extensionId}" receives only the final streamed message in agent_end; Mastra Code does not expose the full run transcript on this listener.`,
          'event:agent_end-messages',
        );
      }
    }
    if (!this.#attached) return;
    for (const generation of generations) {
      if (!prior.has(generation))
        await this.#dispatchToGeneration(generation, 'session_start', { type: 'session_start' });
    }
  }

  async attach(session: PiSessionEventSource): Promise<void> {
    await this.detach();
    const attachment = ++this.#attachment;
    this.#dispatchQueue = Promise.resolve();
    this.#unsubscribe = session.subscribe(event => {
      const generationRevision = this.#generationRevision;
      const dispatch = () =>
        attachment === this.#attachment ? this.#dispatch(event, attachment, generationRevision) : Promise.resolve();
      this.#dispatchQueue = this.#dispatchQueue.then(dispatch, dispatch);
      return this.#dispatchQueue;
    });
    this.#unsubscribeBeforeEnd = session.onBeforeAgentEnd?.(event => {
      const generationRevision = this.#generationRevision;
      const dispatch = () =>
        attachment === this.#attachment && generationRevision === this.#generationRevision
          ? this.#beforeAgentEnd(event)
          : Promise.resolve();
      this.#dispatchQueue = this.#dispatchQueue.then(dispatch, dispatch);
      return this.#dispatchQueue;
    });
    this.#attached = true;
    await this.#dispatchNamed('session_start', { type: 'session_start' });
  }

  async detach(): Promise<void> {
    const wasAttached = this.#attached;
    this.#attachment += 1;
    this.#unsubscribe?.();
    this.#unsubscribeBeforeEnd?.();
    await this.#dispatchQueue;
    this.#unsubscribe = undefined;
    this.#unsubscribeBeforeEnd = undefined;
    this.#attached = false;
    this.#runActive = false;
    this.#lastMessage = undefined;
    this.#toolResults = [];
    if (wasAttached) await this.#dispatchNamed('session_shutdown', { type: 'session_shutdown' });
  }

  async #beforeAgentEnd(event: Extract<AgentControllerEvent, { type: 'agent_end' }>): Promise<void> {
    for (const generation of this.#generations) {
      try {
        const results = await generation.emit(
          'agent_settled',
          { type: 'agent_settled', reason: event.reason },
          context(generation, this.#options),
        );
        if (results.some(result => result !== undefined)) {
          generation.addDiagnostic(
            'warning',
            `Pi extension "${generation.extensionId}" returned a value from agent_settled; Mastra Code cannot use it to veto completion.`,
            'event:agent_settled',
          );
        }
      } catch {
        // Generation.emit attributes the failure. Continue so sibling extensions still receive the event.
      }
    }
  }

  async #dispatch(event: AgentControllerEvent, attachment: number, generationRevision: number): Promise<void> {
    if (attachment !== this.#attachment || generationRevision !== this.#generationRevision) return;
    const generations = [...this.#generations];
    if (event.type === 'agent_start') {
      this.#lastMessage = undefined;
      this.#toolResults = [];
      this.#runActive = true;
    } else if (event.type === 'message_end') {
      this.#lastMessage = event.message;
    } else if (event.type === 'tool_end') {
      this.#toolResults.push({
        toolCallId: event.toolCallId,
        result: event.result,
        isError: event.isError,
      });
    }
    for (const mapped of mapControllerEvent(event)) {
      for (const generation of generations) {
        if (attachment !== this.#attachment || generationRevision !== this.#generationRevision) return;
        await this.#dispatchToGeneration(generation, mapped.name, mapped.payload);
      }
    }
    if (
      event.type === 'agent_end' &&
      this.#runActive &&
      attachment === this.#attachment &&
      generationRevision === this.#generationRevision
    ) {
      this.#runActive = false;
      const messages = this.#lastMessage === undefined ? [] : [this.#lastMessage];
      for (const generation of generations) {
        await this.#dispatchToGeneration(generation, 'agent_end', {
          type: 'agent_end',
          messages,
          reason: event.reason,
        });
        await this.#dispatchToGeneration(generation, 'turn_end', {
          type: 'turn_end',
          turnIndex: 0,
          message: this.#lastMessage,
          toolResults: this.#toolResults,
        });
      }
    }
  }

  async #dispatchNamed(name: string, payload: Record<string, unknown>): Promise<void> {
    for (const generation of [...this.#generations]) await this.#dispatchToGeneration(generation, name, payload);
  }

  async #dispatchToGeneration(
    generation: PiExtensionGeneration,
    name: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      await generation.emit(name, normalizeEventPayload(generation, name, payload), context(generation, this.#options));
    } catch {
      // Generation.emit attributes the failure. Continue so sibling extensions still receive the event.
    }
  }
}
