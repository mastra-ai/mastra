/**
 * MemoryInputFilter — the input boundary between a client's request body and stored memory.
 *
 * ## What it is
 *
 * An input processor owned by memory. `Memory.getInputProcessors()` pushes it first, ahead of
 * MessageHistory, WorkingMemory, SemanticRecall, and Observational Memory, so it sees and can
 * rewrite the raw request input before any loader reads it.
 *
 * ## Why it exists
 *
 * Clients that use memory are told to send only the new message each turn (see the warning in
 * `docs/src/content/en/docs/memory/message-history.mdx` and the `prepareSendMessagesRequest`
 * example in `docs/src/content/en/integrations/agentic-ui/ai-sdk-ui.mdx`). Many don't. The
 * default `useChat` shape echoes the entire conversation back on every request, and that echo
 * is lossy: it is whatever the UI happened to have, not what was persisted.
 *
 * When memory treated that echo as the newest truth, three things went wrong:
 *
 *   1. The echoed copy was persisted over the stored row, so the client's `createdAt` rewrote
 *      the thread's ordering and the stored message lost its server-assigned identity.
 *   2. Assistant echoes carry text and tool calls but usually not the reasoning that produced
 *      them. Replaying text item ids without their reasoning item id makes OpenAI reject the
 *      request with "Item 'msg_*' of type 'message' was provided without its required
 *      'reasoning' item" (issue #24052).
 *   3. Whitespace differences between the stored text and the echoed text made the two copies
 *      look like distinct parts, so the model saw the assistant turn twice.
 *
 * Stripping provider metadata at send time only hid the symptom, and only for one provider path.
 * The fix is here: decide what the request is actually allowed to contribute before memory
 * loads. Memory is the base layer for a thread; the request may only add what memory doesn't
 * already have.
 *
 * ## What the request is allowed to contribute
 *
 * For a thread that already has stored messages, based on the tail of the input:
 *
 *   - ends with user message(s) → keep those, back to the last assistant message. Several
 *     consecutive user messages are all kept: they are all new, and they are stamped server-side
 *     (the normal client shape sends no ids, so ids and `createdAt` come from the server, and a
 *     client-supplied `createdAt` cannot reorder the thread). If that assistant message carries
 *     client tool updates (a result, error, denial, or approval answer), keep the ones that fill
 *     in a call its stored copy still has pending; see `advanceStoredToolCalls`.
 *   - ends with an assistant message → keep only its trailing run of client tool updates. This
 *     is the client-side tool flow: the assistant turn was stored with a pending call, and the
 *     client is returning the outcome for it. Everything earlier in that message is already
 *     stored. An update for a call the stored copy already finished is ignored when the two
 *     copies are layered in `MessageList.add`.
 *   - ends with an assistant message and no new results → drop it, but only if it exists in
 *     storage (see the `listMessagesById` check below). Internal callers such as the agent
 *     network pass assistant-role instruction messages that were never persisted; those are
 *     the whole prompt and must survive.
 *
 * For a thread with nothing stored, the entire input is the seed. Assistant provider metadata is
 * stripped there, because item ids name server-side items that this request never created — that
 * is exactly the orphaned-reference shape from #24052. Tool results keep their metadata: that
 * data came from the client.
 *
 * A caller that assembled the input itself can opt out of all of the above with
 * `retainFullInput`. The input is then processed exactly as supplied — no trim, no seed strip —
 * which is what the nested `useAgent` structuring pass needs so its replayed request keeps the
 * same message prefix as the parent run.
 *
 * ## What happens after this runs
 *
 * Loaders add stored rows as `memory`. `MessageList.add` treats a memory-sourced message that
 * collides by id with input as authoritative — the stored copy keeps its text, reasoning,
 * provider metadata, and `createdAt`, and the only thing taken from the input is a tool outcome
 * for a call the stored copy still has pending. The merged message stays tagged `input` so that
 * outcome is still persisted. See `clientToolOutcomes` in
 * `packages/core/src/agent/message-list/message-list.ts`.
 */
import type { Processor } from '..';
import type { MastraDBMessage, MastraMessagePart, MessageList } from '../../agent';
import type { MastraToolInvocationPart } from '../../agent/message-list';
import {
  advancesToolInvocationState,
  isClientToolInvocationUpdate,
} from '../../agent/message-list/utils/tool-invocation-state';
import { parseMemoryRequestContext } from '../../memory';
import type { RequestContext } from '../../request-context';
import type { MemoryStorage } from '../../storage';

export interface MemoryInputFilterOptions {
  storage: MemoryStorage;
  /**
   * When true, the request input is left exactly as supplied and no trimming or seeding is
   * performed. Used by callers that assemble the input themselves and need the message
   * sequence preserved (for example the nested `useAgent` structuring pass, which replays
   * the parent request's messages).
   */
  retainFullInput?: boolean;
}

/**
 * How many rows after the client's message are read when looking for a call that a state signal
 * moved into a later row of the same response.
 */
const FOLLOWING_ROWS_LIMIT = 20;

function stripAssistantProviderMetadata(message: MastraDBMessage): MastraDBMessage {
  if (message.role !== 'assistant') return message;

  return {
    ...message,
    content: {
      ...message.content,
      parts: message.content.parts.map(part => {
        if (part.type === 'tool-invocation' && isClientToolInvocationUpdate(part.toolInvocation.state)) return part;
        const {
          providerMetadata: _providerMetadata,
          providerOptions: _providerOptions,
          ...rest
        } = part as Record<string, unknown>;
        return rest as MastraMessagePart;
      }),
    },
  };
}

export class MemoryInputFilter implements Processor {
  readonly id = 'memory-input-filter';
  readonly name = 'MemoryInputFilter';

  private storage: MemoryStorage;
  /** Whether the request input is processed verbatim. Public so callers and tests can introspect it. */
  readonly retainFullInput: boolean;

  constructor(options: MemoryInputFilterOptions) {
    this.storage = options.storage;
    this.retainFullInput = options.retainFullInput === true;
  }

  async processInput({
    messageList,
    requestContext,
  }: {
    messages: MastraDBMessage[];
    messageList: MessageList;
    abort: (reason?: string) => never;
    requestContext?: RequestContext;
  }): Promise<MessageList> {
    const input = messageList.get.input.db();
    if (input.length === 0) return messageList;

    // The caller assembled this input itself and needs it processed verbatim: skip the trim
    // against stored history. Loaders still add stored rows underneath, and the same-id
    // layering in MessageList.add still applies.
    if (this.retainFullInput) return messageList;

    const context = parseMemoryRequestContext(requestContext);
    const threadId = context?.thread?.id ?? messageList.serialize().memoryInfo?.threadId;
    const resourceId = context?.resourceId ?? messageList.serialize().memoryInfo?.resourceId;
    if (!threadId) return messageList;

    const lastMessage = input.at(-1)!;
    let retainedInput: MastraDBMessage[];
    let boundaryAssistant: MastraDBMessage | undefined;

    if (lastMessage.role === 'user') {
      const lastAssistantIndex = input.findLastIndex(message => message.role === 'assistant');
      retainedInput = input.slice(lastAssistantIndex + 1);
      boundaryAssistant = input[lastAssistantIndex];
    } else if (lastMessage.role === 'assistant') {
      const trailingResults: Extract<MastraMessagePart, { type: 'tool-invocation' }>[] = [];
      for (let index = lastMessage.content.parts.length - 1; index >= 0; index--) {
        const part = lastMessage.content.parts[index]!;
        // Stream data parts (e.g. observational memory buffering markers) are appended
        // after the parts they annotate and carry no model content. Skip them so they
        // don't terminate the trailing-result run and drop the client's tool result.
        if (part.type.startsWith('data-')) continue;
        if (part.type !== 'tool-invocation' || !isClientToolInvocationUpdate(part.toolInvocation.state)) break;
        trailingResults.unshift(part);
      }
      retainedInput =
        trailingResults.length > 0
          ? [
              {
                ...lastMessage,
                content: {
                  ...lastMessage.content,
                  content: '',
                  parts: trailingResults,
                },
              },
            ]
          : [];
    } else {
      return messageList;
    }

    const inputUnchanged =
      retainedInput.length === input.length && retainedInput.every((message, index) => message === input[index]);
    if (inputUnchanged) return messageList;

    const stored = await this.storage.listMessages({
      threadId,
      resourceId,
      page: 0,
      perPage: 1,
      orderBy: { field: 'createdAt', direction: 'DESC' },
      includeTotal: false,
    });

    if (stored.messages.length === 0) {
      const seeded = input.map(stripAssistantProviderMetadata);
      messageList.clear.input.db();
      for (const message of seeded) {
        messageList.add(message, 'input', { merge: false });
      }
      return messageList;
    }

    // A trailing assistant message with no new tool results is only a redundant echo
    // when it refers to a message that already exists in storage. Internal callers
    // (for example the agent network) pass assistant-role instruction messages that
    // were never persisted; dropping those would delete the prompt, so keep them.
    if (retainedInput.length === 0) {
      const { messages: persisted } = lastMessage.id
        ? await this.storage.listMessagesById({ messageIds: [lastMessage.id] })
        : { messages: [] };
      if (persisted.length === 0) return messageList;
    }

    if (boundaryAssistant) {
      const advanced = await this.advanceStoredToolCalls(boundaryAssistant, threadId, resourceId);
      retainedInput = [...advanced, ...retainedInput];
    } else if (lastMessage.role === 'assistant' && retainedInput.length > 0) {
      retainedInput = await this.routeTrailingUpdates(retainedInput[0]!, threadId, resourceId);
    }

    messageList.clear.input.db();
    for (const message of retainedInput) {
      messageList.add(message, 'input', { merge: false });
    }

    return messageList;
  }

  /**
   * `useChat` without `sendAutomaticallyWhen` sends a client tool result together with the next
   * user message, so the result rides on the assistant message just before the user tail. Keep a
   * tool part from that message only when it fills in a call the stored copy still has pending.
   * If the message isn't stored under that id, keep none: the AI SDK client can fold several
   * server messages into one UI message under a new id, and then a client result can't be told
   * apart from a duplicated server result.
   *
   * A response can be stored as several assistant rows (a state signal between steps seals the
   * current row and the rest of the response continues in a new one), while the client still
   * holds it as one message under the first row's id. Each kept update is therefore returned
   * under the id of the stored row that holds its call.
   */
  private async advanceStoredToolCalls(
    message: MastraDBMessage,
    threadId: string,
    resourceId: string | undefined,
  ): Promise<MastraDBMessage[]> {
    const updates = message.content.parts.filter(
      (part): part is MastraToolInvocationPart =>
        part.type === 'tool-invocation' && isClientToolInvocationUpdate(part.toolInvocation.state),
    );
    if (updates.length === 0) return [];

    const owners = await this.findStoredToolCalls(message, updates, threadId, resourceId);
    if (!owners) return [];

    const partsByRow = new Map<string, MastraToolInvocationPart[]>();
    for (const part of updates) {
      const owner = owners.get(part.toolInvocation.toolCallId);
      if (!owner || !advancesToolInvocationState(owner.state, part.toolInvocation.state)) continue;
      partsByRow.set(owner.rowId, [...(partsByRow.get(owner.rowId) ?? []), part]);
    }

    return [...partsByRow].map(([rowId, parts]) => ({
      ...message,
      id: rowId,
      content: { ...message.content, content: '', parts },
    }));
  }

  /**
   * A result sent on its own is layered onto the stored row with the message's id. When the call
   * lives in a later row of the same response (see `advanceStoredToolCalls`), move the update to
   * that row; otherwise `clientToolOutcomes` would discard it because the first row doesn't hold
   * the call. Updates for calls the first row holds, or that aren't found, stay where they were.
   */
  private async routeTrailingUpdates(
    message: MastraDBMessage,
    threadId: string,
    resourceId: string | undefined,
  ): Promise<MastraDBMessage[]> {
    const updates = message.content.parts as MastraToolInvocationPart[];
    const owners = await this.findStoredToolCalls(message, updates, threadId, resourceId);
    if (!owners) return [message];

    const kept: MastraToolInvocationPart[] = [];
    const movedByRow = new Map<string, MastraToolInvocationPart[]>();
    for (const part of updates) {
      const owner = owners.get(part.toolInvocation.toolCallId);
      if (!owner || owner.rowId === message.id) {
        kept.push(part);
        continue;
      }
      if (!advancesToolInvocationState(owner.state, part.toolInvocation.state)) continue;
      movedByRow.set(owner.rowId, [...(movedByRow.get(owner.rowId) ?? []), part]);
    }

    const routed: MastraDBMessage[] = [...movedByRow].map(([rowId, parts]) => ({
      ...message,
      id: rowId,
      content: { ...message.content, parts },
    }));
    return kept.length > 0 ? [{ ...message, content: { ...message.content, parts: kept } }, ...routed] : routed;
  }

  /**
   * Find the stored row and state of each updated call. Starts with the row stored under the
   * message's id; only when that row lacks one of the calls does it read the assistant rows stored
   * after it, up to the next user message. Returns undefined when the message isn't stored in this
   * thread.
   */
  private async findStoredToolCalls(
    message: MastraDBMessage,
    updates: MastraToolInvocationPart[],
    threadId: string,
    resourceId: string | undefined,
  ): Promise<Map<string, { rowId: string; state: MastraToolInvocationPart['toolInvocation']['state'] }> | undefined> {
    if (!message.id) return undefined;

    const { messages } = await this.storage.listMessagesById({ messageIds: [message.id] });
    const first = messages.find(candidate => candidate.id === message.id && candidate.threadId === threadId);
    if (!first) return undefined;

    const owners = new Map<string, { rowId: string; state: MastraToolInvocationPart['toolInvocation']['state'] }>();
    const collect = (row: MastraDBMessage) => {
      for (const part of row.content.parts) {
        if (part.type === 'tool-invocation' && !owners.has(part.toolInvocation.toolCallId)) {
          owners.set(part.toolInvocation.toolCallId, { rowId: row.id, state: part.toolInvocation.state });
        }
      }
    };
    collect(first);

    const missing = () => updates.some(part => !owners.has(part.toolInvocation.toolCallId));
    if (!missing()) return owners;

    const { messages: following } = await this.storage.listMessages({
      threadId,
      resourceId,
      page: 0,
      perPage: FOLLOWING_ROWS_LIMIT,
      orderBy: { field: 'createdAt', direction: 'ASC' },
      filter: { dateRange: { start: new Date(first.createdAt) } },
      includeTotal: false,
    });
    for (const row of following) {
      if (row.id === first.id || row.threadId !== threadId) continue;
      if (row.role === 'user') break;
      if (row.role !== 'assistant') continue;
      collect(row);
      if (!missing()) break;
    }

    return owners;
  }
}
