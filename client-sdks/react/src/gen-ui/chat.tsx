import { formatGenUIContext } from '@mastra/client-js/gen-ui';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { useEffect, useState } from 'react';
import { useChat } from '../agent/hooks';
import type { MastraChatProps, SendMessageArgs } from '../agent/hooks';
import type { ClientToolsInput } from '../agent/types';
import type { MessageRenderers } from '../ui/MessageFactory/types';
import { createGenUIController } from './controller';
import type { GenUIChatActionHandler, GenUIController } from './controller';
import type { GenUIRegistry } from './registry';
import { createGenUIRenderers } from './renderers';

export interface UseGenUIChatProps extends MastraChatProps {
  /** The registry created with `createGenUI`. Read once per mount; remount with a `key` to switch registries. */
  genUI: GenUIRegistry;
  /** Action handlers that components dispatch with `useGenUIAction(name)`. Handlers from the latest render run. */
  actions?: Record<string, GenUIChatActionHandler<any>>;
  /** Your own `MessageFactory` renderers, for parts GenUI does not render. */
  renderers?: MessageRenderers;
}

export interface GenUIChatHandle {
  controller: GenUIController;
  /** Spread into `MessageFactory`. Includes the `renderers` you passed for parts GenUI does not render. */
  renderers: MessageRenderers;
}

function mergeTools(own: ClientToolsInput | undefined, genUI: ClientToolsInput): ClientToolsInput {
  if (!own) return genUI;
  for (const name of Object.keys(genUI)) {
    if (name in own) {
      throw new Error(
        `Client tool "${name}" collides with a GenUI frontend tool. Rename one of them (component tool \`name\` option).`,
      );
    }
  }
  return { ...own, ...genUI };
}

function withContext(system: string | undefined, contextBlock: string | undefined) {
  if (!contextBlock) return system;
  return system ? `${system}\n\n${contextBlock}` : contextBlock;
}

function createController(
  { genUI, actions }: Pick<UseGenUIChatProps, 'genUI' | 'actions'>,
  history: { messages?: MastraDBMessage[]; threadId?: string },
): GenUIController {
  const controller = createGenUIController({ registry: genUI, actions });
  // Surfaces from history are ready on the first render.
  if (history.messages) controller.sync(history.messages, { threadId: history.threadId });
  return controller;
}

/**
 * `useChat` with Generative UI. Registers the registry's frontend tools, derives surfaces from the
 * chat's messages, and attaches published app context to outgoing messages. Plain `useChat` is untouched.
 */
export function useGenUIChat({ genUI, actions, renderers, ...chatProps }: UseGenUIChatProps) {
  const [controller] = useState(() =>
    createController({ genUI, actions }, { messages: chatProps.initialMessages, threadId: chatProps.threadId }),
  );
  const { threadId } = chatProps;
  const chat = useChat({ ...chatProps, clientTools: mergeTools(chatProps.clientTools, controller.clientTools) });

  useEffect(() => controller.retain(), [controller]);

  // The controller is an external store fed by the chat's messages.
  useEffect(() => {
    controller.sync(chat.messages, { threadId, running: chat.isRunning });
  }, [controller, chat.messages, chat.isRunning, threadId]);

  async function sendMessage(input: SendMessageArgs) {
    const contextBlock = formatGenUIContext(controller.context.snapshot());
    const system = withContext(input.modelSettings?.system, contextBlock);
    const modelSettings = system ? { modelSettings: { ...input.modelSettings, system } } : {};
    if (input.mode === 'network') return chat.sendMessage({ ...input, ...modelSettings });
    return chat.sendMessage({
      ...input,
      // useChat prefers per-call tools over hook-level ones, so GenUI tools must ride along.
      ...(input.clientTools ? { clientTools: mergeTools(input.clientTools, controller.clientTools) } : {}),
      ...modelSettings,
    });
  }

  // Actions run after commit, so they always see the chat and handlers of the latest render.
  useEffect(() => {
    controller.setServices({
      sendMessage: args => sendMessage(typeof args === 'string' ? { message: args, threadId } : args),
      approveToolCall: (toolCallId, resumeData) => chat.approveToolCall(toolCallId, resumeData),
      declineToolCall: toolCallId => chat.declineToolCall(toolCallId),
      threadId,
    });
    controller.setActions(actions);
  });

  function cancelRun(...args: Parameters<typeof chat.cancelRun>) {
    controller.markAborted();
    return chat.cancelRun(...args);
  }

  const handle: GenUIChatHandle = {
    controller,
    renderers: { ...renderers, ...createGenUIRenderers(controller, renderers) },
  };
  return { ...chat, sendMessage, cancelRun, genUI: handle };
}
