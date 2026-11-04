import { formatGenUIContext } from '@mastra/client-js/gen-ui';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useChat } from '../agent/hooks';
import type { MastraChatProps, SendMessageArgs } from '../agent/hooks';
import type { ClientToolsInput } from '../agent/types';
import type { MessageRenderers } from '../ui/MessageFactory/types';
import { createGenUIController } from './controller';
import type { GenUIChatActionHandler, GenUIController } from './controller';
import type { GenUIRegistry } from './registry';
import { createGenUIRenderers } from './renderers';

export interface UseGenUIChatProps extends MastraChatProps {
  /** The registry created with `createGenUI`. Keep it stable (module scope); a new registry resets GenUI state. */
  genUI: GenUIRegistry;
  /** Action handlers that components dispatch with `useGenUIAction(name)`. Read once per registry. */
  actions?: Record<string, GenUIChatActionHandler<any>>;
}

export interface GenUIChatHandle {
  controller: GenUIController;
  /** Pass to `MessageFactory` (spread) or wrap with `useGenUIRenderers` to keep your own renderers. */
  renderers: ReturnType<typeof createGenUIRenderers>;
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

/**
 * `useChat` with Generative UI. Registers the registry's frontend tools, derives surfaces from the
 * chat's messages, and attaches published app context to outgoing messages. Plain `useChat` is untouched.
 */
export function useGenUIChat({ genUI: registry, actions, ...chatProps }: UseGenUIChatProps) {
  const initialMessages = useRef(chatProps.initialMessages);
  const controller = useMemo(() => {
    const created = createGenUIController({ registry, actions });
    // Seed from history before the first render so surfaces show without waiting for an effect.
    if (initialMessages.current) created.sync(initialMessages.current);
    return created;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- actions are read once per registry.
  }, [registry]);
  useEffect(() => controller.retain(), [controller]);

  const clientTools = useMemo(
    () => mergeTools(chatProps.clientTools, controller.clientTools),
    [chatProps.clientTools, controller],
  );
  const chat = useChat({ ...chatProps, clientTools });

  useLayoutEffect(() => {
    controller.sync(chat.messages);
  }, [controller, chat.messages]);
  useLayoutEffect(() => {
    controller.setLive(chat.isRunning);
  }, [controller, chat.isRunning]);

  const threadId = chatProps.threadId;
  const previousThread = useRef(threadId);
  useLayoutEffect(() => {
    if (previousThread.current === threadId) return;
    previousThread.current = threadId;
    controller.reset();
  }, [controller, threadId]);

  const sendMessage = async (input: SendMessageArgs) => {
    const contextBlock = formatGenUIContext(controller.context.snapshot());
    if (input.mode === 'network') {
      const system = withContext(input.modelSettings?.system, contextBlock);
      return chat.sendMessage({ ...input, ...(system ? { modelSettings: { ...input.modelSettings, system } } : {}) });
    }
    const system = withContext(input.modelSettings?.system, contextBlock);
    return chat.sendMessage({
      ...input,
      // useChat prefers per-call tools over hook-level ones, so GenUI tools must ride along.
      ...(input.clientTools ? { clientTools: mergeTools(input.clientTools, controller.clientTools) } : {}),
      ...(system ? { modelSettings: { ...input.modelSettings, system } } : {}),
    });
  };

  const latest = useRef({ sendMessage, chat, threadId });
  latest.current = { sendMessage, chat, threadId };
  useLayoutEffect(() => {
    controller.setServices({
      sendMessage: args =>
        latest.current.sendMessage(
          typeof args === 'string' ? { message: args, threadId: latest.current.threadId } : args,
        ),
      approveToolCall: (toolCallId, resumeData) => latest.current.chat.approveToolCall(toolCallId, resumeData),
      declineToolCall: toolCallId => latest.current.chat.declineToolCall(toolCallId),
      get threadId() {
        return latest.current.threadId;
      },
    });
  }, [controller]);

  const handle = useMemo<GenUIChatHandle>(
    () => ({ controller, renderers: createGenUIRenderers(controller) }),
    [controller],
  );

  const cancelRun: typeof chat.cancelRun = (...args) => {
    controller.markAborted();
    return chat.cancelRun(...args);
  };

  return { ...chat, sendMessage, cancelRun, genUI: handle };
}

/**
 * Combine GenUI renderers with your own. Parts GenUI does not render are passed to `base`.
 * Memoized on the identity of each base renderer.
 */
export function useGenUIRenderers(genUI: GenUIChatHandle, base: MessageRenderers = {}): MessageRenderers {
  const { Data, ToolInvocation, DynamicTool } = base;
  return useMemo(
    () => ({ ...base, ...createGenUIRenderers(genUI.controller, { Data, ToolInvocation, DynamicTool }) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on each renderer, not the object.
    [
      genUI.controller,
      Data,
      ToolInvocation,
      DynamicTool,
      base.Text,
      base.Reasoning,
      base.File,
      base.StepStart,
      base.SourceUrl,
      base.SourceDocument,
      base.Error,
    ],
  );
}
