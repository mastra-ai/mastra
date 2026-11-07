import type { Catalog } from '@json-render/core';
import { formatGenUIContext } from '@mastra/client-js/gen-ui';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { useEffect, useRef, useState } from 'react';
import { useChat } from '../agent/hooks';
import type { MastraChatProps, SendMessageArgs } from '../agent/hooks';
import type { ClientToolsInput } from '../agent/types';
import type { MessageRenderers } from '../ui/MessageFactory/types';
import { createGenUIController } from './controller';
import type { GenUIActionHandlers, GenUIController } from './controller';
import type { GenUIRegistry } from './registry';
import { createGenUIRenderers } from './renderers';

/** @experimental Generative UI is in beta and may change without notice. */
export interface UseGenUIChatProps<C extends Catalog = Catalog> extends MastraChatProps {
  /** The registry created with `createGenUI`. Read once per mount; remount with a `key` to switch registries. */
  genUI: GenUIRegistry<C>;
  /** Handlers for the catalog's actions, which surface specs bind to component events through `on`. Handlers from the latest render run. */
  actions?: GenUIActionHandlers<C>;
  /**
   * Your own `MessageFactory` renderers, for parts GenUI does not render. Define them outside the
   * component (or memoize them) so messages don't re-render on every streamed token.
   */
  renderers?: MessageRenderers;
}

/** @experimental Generative UI is in beta and may change without notice. */
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
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function useGenUIChat<C extends Catalog = Catalog>({
  genUI,
  actions,
  renderers,
  ...chatProps
}: UseGenUIChatProps<C>) {
  const [controller] = useState(() =>
    createController({ genUI, actions }, { messages: chatProps.initialMessages, threadId: chatProps.threadId }),
  );
  // Built once so memoized messages skip re-rendering while a reply streams. They read your
  // renderers from a ref, so parts GenUI hands back to you use the latest ones.
  const baseRenderers = useRef(renderers);
  const [genUIRenderers] = useState(() =>
    createGenUIRenderers(controller, {
      Data: part => baseRenderers.current?.Data?.(part),
      ToolInvocation: part => baseRenderers.current?.ToolInvocation?.(part),
      DynamicTool: part => baseRenderers.current?.DynamicTool?.(part),
    }),
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
    baseRenderers.current = renderers;
  });

  function cancelRun(...args: Parameters<typeof chat.cancelRun>) {
    controller.markAborted();
    return chat.cancelRun(...args);
  }

  const handle: GenUIChatHandle = {
    controller,
    renderers: { ...renderers, ...genUIRenderers },
  };
  return { ...chat, sendMessage, cancelRun, genUI: handle };
}
