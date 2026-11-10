import { MASTRA_RESOURCE_ID_KEY } from '../../constants';
import {
  AWAIT_BUFFER_STATUS_ROUTE,
  CLONE_THREAD_ROUTE,
  CREATE_THREAD_ROUTE,
  GET_MEMORY_CONFIG_ROUTE,
  GET_MEMORY_STATUS_ROUTE,
  GET_OBSERVATIONAL_MEMORY_ROUTE,
  GET_THREAD_BY_ID_ROUTE,
  LIST_MESSAGES_ROUTE,
  LIST_THREADS_ROUTE,
  SAVE_MESSAGES_ROUTE,
  SEARCH_MEMORY_ROUTE,
  UPDATE_THREAD_ROUTE,
} from '../../handlers/memory';
import { saveMessagesBodySchema } from '../../schemas/memory';
import type { Args, CatalogueKit } from '../catalogue';
import { fitRows, fitValue } from '../result-size';
import { object, str, toJSONSchema } from '../schema';

const PER_PAGE_HINT = 'Call again with a smaller perPage to page through every item.';
// `hasMore` would be wrong once rows are cut; the caller pages again with a smaller perPage.
const PAGINATION = ['hasMore'];
const int = (description: string) => ({ type: 'integer' as const, minimum: 0, description });
const metadata = { type: 'object' as const, description: 'Arbitrary metadata.' };

/** Drops undefined values so optional arguments are not sent as empty query params. */
const defined = (values: Args) => Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));

/**
 * Memory: Observational Memory, threads, and messages. Every route enforces thread/resource ownership itself;
 * an agent left out by include/exclude is "not found" here, as in the agents toolset.
 */
export async function addMemoryTools(kit: CatalogueKit) {
  const { addOperation, addCombined, requestContext } = kit;
  const call: CatalogueKit['call'] = async (route, input, signal) => {
    const agentId = input.query?.agentId ?? (input.body as Args | undefined)?.agentId;
    if (typeof agentId === 'string') await kit.requireSelected('agents', agentId, 'Agent');
    return kit.call(route, input, signal);
  };
  const agentIds = await kit.visibleAgentIds();
  const agentId = kit.idParam('Agent', agentIds, 'list_agents');
  const resourceId = str(
    'Owner of the memory, for example a user id. Defaults to you when the server maps users to resources.',
  );
  const threadId = str('Thread id.');
  const contextResource = (args: Args) => args.resourceId ?? requestContext.get(MASTRA_RESOURCE_ID_KEY);

  const omScope = { agentId, threadId: str('Thread id. Omit for resource-scoped Observational Memory.'), resourceId };
  // get_observations is offered on the memory:read GET route. Waiting runs the buffer-status route, which needs
  // more (memory:write, and no read-only mode), so `waitForPending` is only in the schema when that route is permitted.
  const canWait = kit.permitted(AWAIT_BUFFER_STATUS_ROUTE);
  const waitForPending = {
    type: 'boolean' as const,
    description:
      'Set true right after call_agent to wait (up to 30s) for Observational Memory to finish processing recent messages before reading. Returns an error if the agent has no Observational Memory.',
  };
  addOperation(
    GET_OBSERVATIONAL_MEMORY_ROUTE,
    object(canWait ? { ...omScope, waitForPending } : omScope, ['agentId']),
    async (args, signal) => {
      const scope = defined({ agentId: args.agentId, threadId: args.threadId, resourceId: args.resourceId });
      // Active observations can grow to tens of thousands of tokens before reflection condenses them.
      if (canWait && args.waitForPending === true) {
        return fitValue(await call(AWAIT_BUFFER_STATUS_ROUTE, { body: scope }, signal));
      }
      // limit 1: the route also reads earlier records, which this tool doesn't return.
      const result = (await call(GET_OBSERVATIONAL_MEMORY_ROUTE, { query: { ...scope, limit: 1 } }, signal)) as Args;
      return fitValue({ record: result?.record ?? null });
    },
  );

  const page = { page: int('Page number, from 0.'), perPage: int('Items per page.') };
  addOperation(
    LIST_THREADS_ROUTE,
    object({ agentId: { ...agentId, description: 'Agent whose memory to list. Optional.' }, resourceId, ...page }),
    async (args, signal) =>
      fitRows(await call(LIST_THREADS_ROUTE, { query: defined(args) }, signal), 'threads', PER_PAGE_HINT, {
        cursors: PAGINATION,
      }),
  );
  addOperation(
    GET_THREAD_BY_ID_ROUTE,
    object({ threadId, agentId: { ...agentId, description: 'Agent whose memory holds the thread. Optional.' } }, [
      'threadId',
    ]),
    (args, signal) =>
      call(
        GET_THREAD_BY_ID_ROUTE,
        { pathParams: { threadId: args.threadId }, query: defined({ agentId: args.agentId }) },
        signal,
      ),
  );
  addOperation(
    LIST_MESSAGES_ROUTE,
    object(
      { threadId, agentId: { ...agentId, description: 'Agent whose memory holds the thread. Optional.' }, ...page },
      ['threadId'],
    ),
    async (args, signal) => {
      const { threadId: id, ...query } = args;
      const result = await call(LIST_MESSAGES_ROUTE, { pathParams: { threadId: id }, query: defined(query) }, signal);
      // uiMessages repeats the same messages in UI format, unclipped, so it goes whenever the messages are cut or clipped.
      return fitRows(result, 'messages', PER_PAGE_HINT, { cursors: PAGINATION, views: ['uiMessages'] });
    },
  );
  addOperation(
    SEARCH_MEMORY_ROUTE,
    object(
      {
        agentId,
        searchQuery: str('What to search for.'),
        resourceId,
        threadId: str('Only search this thread.'),
        limit: int('Maximum results. Defaults to 20.'),
      },
      ['agentId', 'searchQuery'],
    ),
    (args, signal) =>
      call(SEARCH_MEMORY_ROUTE, { query: defined({ ...args, resourceId: contextResource(args) }) }, signal),
  );
  addCombined(
    [GET_MEMORY_STATUS_ROUTE, GET_MEMORY_CONFIG_ROUTE],
    object({ agentId, resourceId, threadId }, ['agentId']),
    async (args, signal) => {
      const status = await call(GET_MEMORY_STATUS_ROUTE, { query: defined(args) }, signal);
      const config = (await call(GET_MEMORY_CONFIG_ROUTE, { query: { agentId: args.agentId } }, signal)) as Args;
      return { status, config: config?.config ?? config };
    },
  );

  addOperation(
    CREATE_THREAD_ROUTE,
    object(
      {
        agentId,
        resourceId,
        title: str('Thread title.'),
        metadata,
        threadId: str('Id for the new thread. Generated if omitted.'),
      },
      ['agentId'],
    ),
    (args, signal) => {
      const { agentId: id, ...body } = args;
      return call(
        CREATE_THREAD_ROUTE,
        { query: { agentId: id }, body: defined({ ...body, resourceId: contextResource(args) }) },
        signal,
      );
    },
  );
  addOperation(
    UPDATE_THREAD_ROUTE,
    object({ threadId, agentId, title: str('New title.'), metadata }, ['threadId', 'agentId']),
    (args, signal) =>
      call(
        UPDATE_THREAD_ROUTE,
        {
          pathParams: { threadId: args.threadId },
          query: { agentId: args.agentId },
          body: defined({ title: args.title, metadata: args.metadata }),
        },
        signal,
      ),
  );
  addOperation(
    CLONE_THREAD_ROUTE,
    object(
      {
        threadId: str('Thread to copy.'),
        agentId,
        newThreadId: str('Id for the copy. Generated if omitted.'),
        title: str('Title for the copy.'),
        metadata,
        messageLimit: int('Only copy the most recent N messages.'),
      },
      ['threadId', 'agentId'],
    ),
    (args, signal) =>
      call(
        CLONE_THREAD_ROUTE,
        {
          pathParams: { threadId: args.threadId },
          query: { agentId: args.agentId },
          body: defined({
            newThreadId: args.newThreadId,
            title: args.title,
            metadata: args.metadata,
            options: args.messageLimit === undefined ? undefined : { messageLimit: args.messageLimit },
          }),
        },
        signal,
      ),
  );
  const messages = toJSONSchema(saveMessagesBodySchema)?.properties?.messages;
  addOperation(
    SAVE_MESSAGES_ROUTE,
    object(
      {
        agentId,
        messages: typeof messages === 'object' ? messages : { type: 'array', items: { type: 'object' } },
      },
      ['agentId', 'messages'],
    ),
    (args, signal) =>
      call(SAVE_MESSAGES_ROUTE, { query: { agentId: args.agentId }, body: { messages: args.messages } }, signal),
  );
}
