import type { Catalog } from '@json-render/core';
import { formatGenUIContext } from '@mastra/client-js/gen-ui';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '../agent/hooks';
import type { MastraChatProps, SendMessageArgs } from '../agent/hooks';
import type { ClientToolsInput } from '../agent/types';
import type { MessageRenderers, TextPart } from '../ui/MessageFactory/types';
import { createGenUIController } from './controller';
import type { GenUIActionHandlers, GenUIController } from './controller';
import { isMcpAppContextText, renderMcpApp, useMcpAppHost } from './mcp-apps';
import type { GenUIRegistry } from './registry';
import { createGenUIRenderers } from './renderers';

/** @experimental Generative UI is in beta and may change without notice. */
export interface UseGenUIChatProps<C extends Catalog = Catalog> extends MastraChatProps {
  /** The registry created with `createGenUI`. Read once per mount; remount with a `key` to switch registries. */
  genUI: GenUIRegistry<C>;
  /** Handlers for the catalog's actions, which specs bind to component events through `on`. Handlers from the latest render run. */
  actions?: GenUIActionHandlers<C>;
  /** Where specs navigate to, through an action's `onSuccess: { navigate }`. The latest render's function runs. */
  navigate?: (path: string) => void;
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
  { genUI, actions, navigate }: Pick<UseGenUIChatProps, 'genUI' | 'actions' | 'navigate'>,
  history: { messages?: MastraDBMessage[]; threadId?: string },
): GenUIController {
  const controller = createGenUIController({ registry: genUI, actions, navigate });
  // Approvals from history are ready on the first render.
  if (history.messages) controller.sync(history.messages, { threadId: history.threadId });
  return controller;
}

/**
 * `useChat` with Generative UI. Registers the registry's frontend tools, renders their calls in the
 * chat's messages, and attaches published app context to outgoing messages. Plain `useChat` is untouched.
 *
 * Passing saved thread messages as `initialMessages` rebuilds specs, tool UIs, and pending approvals. A reply
 * stopped while the model was still writing a spec is not saved, so its partial interface is gone after a reload.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function useGenUIChat<C extends Catalog = Catalog>({
  genUI,
  actions,
  navigate,
  renderers,
  ...chatProps
}: UseGenUIChatProps<C>) {
  const [controller] = useState(() =>
    createController(
      { genUI, actions, navigate },
      { messages: chatProps.initialMessages, threadId: chatProps.threadId },
    ),
  );
  const { threadId } = chatProps;
  const { host, takeModelContext } = useMcpAppHost(genUI.mcpApps, text => sendMessage({ message: text, threadId }));
  // Rebuilt only when the MCP App tool list arrives, so memoized messages skip re-rendering while a
  // reply streams. They read your renderers from a ref, so parts GenUI hands back to you use the latest ones.
  // GenUI's own tools win over MCP Apps; your renderers handle the rest.
  const baseRenderers = useRef(renderers);
  const genUIRenderers = useMemo(
    () =>
      createGenUIRenderers(controller, {
        ToolInvocation: part => renderMcpApp(controller, host, part) ?? baseRenderers.current?.ToolInvocation?.(part),
        DynamicTool: part => renderMcpApp(controller, host, part) ?? baseRenderers.current?.DynamicTool?.(part),
        Data: part => baseRenderers.current?.Data?.(part),
      }),
    [controller, host],
  );
  // MCP App context rides along as a user message part; keep it out of the transcript you render.
  const text = renderers?.Text;
  const textRenderer = useMemo(
    () => (text ? { Text: (part: TextPart) => (isMcpAppContextText(part.text) ? false : text(part)) } : {}),
    [text],
  );
  const chat = useChat({ ...chatProps, clientTools: mergeTools(chatProps.clientTools, controller.clientTools) });

  useEffect(() => controller.retain(), [controller]);

  // Read the specs before the messages render, so a view never draws a frame behind its message.
  controller.readSpecs(chat.messages);
  // The controller is an external store fed by the chat's messages.
  useEffect(() => {
    controller.sync(chat.messages, { threadId, running: chat.isRunning });
  }, [controller, chat.messages, chat.isRunning, threadId]);

  async function sendMessage(input: SendMessageArgs) {
    const contextBlock = formatGenUIContext(controller.context.snapshot());
    const system = withContext(input.modelSettings?.system, contextBlock);
    const modelSettings = system ? { modelSettings: { ...input.modelSettings, system } } : {};
    const appContext = takeModelContext();
    const coreUserMessages = appContext.messages.length
      ? { coreUserMessages: [...(input.coreUserMessages ?? []), ...appContext.messages] }
      : {};
    try {
      if (input.mode === 'network') return await chat.sendMessage({ ...input, ...modelSettings, ...coreUserMessages });
      return await chat.sendMessage({
        ...input,
        // useChat prefers per-call tools over hook-level ones, so GenUI tools must ride along.
        ...(input.clientTools ? { clientTools: mergeTools(input.clientTools, controller.clientTools) } : {}),
        ...modelSettings,
        ...coreUserMessages,
      });
    } catch (error) {
      // The message wasn't sent, so the context waits for the next one.
      appContext.restore();
      throw error;
    }
  }

  // Actions run after commit, so they always see the chat and handlers of the latest render.
  useEffect(() => {
    controller.setServices({
      sendMessage: args => sendMessage(typeof args === 'string' ? { message: args, threadId } : args),
      approveToolCall: (toolCallId, resumeData) => chat.approveToolCall(toolCallId, resumeData),
      declineToolCall: toolCallId => chat.declineToolCall(toolCallId),
      threadId,
    });
    controller.setActions(actions, navigate);
    baseRenderers.current = renderers;
  });

  const handle: GenUIChatHandle = {
    controller,
    renderers: { ...renderers, ...textRenderer, ...genUIRenderers },
  };
  return { ...chat, sendMessage, genUI: handle };
}
