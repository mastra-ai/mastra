// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentWorkingMemory } from '../agent-working-memory';
import {
  jsonWorkingMemory,
  markdownWorkingMemory,
  markdownWorkingMemoryWithTemplate,
  workingMemoryConfigDisabled,
  workingMemoryConfigEnabled,
} from './fixtures/working-memory';
import type { WorkingMemoryResponse } from './fixtures/working-memory';
import { WorkingMemoryProvider, useWorkingMemory } from '@/domains/agents/context/agent-working-memory-context';
import { server } from '@/test/msw-server';

// `toast` is a presentational third-party util; the behaviour under test is
// that the component reports the failure, not how the toast is drawn.
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { error: toastError, success: vi.fn() },
}));

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'chef-agent';
const THREAD_ID = 'real-thread';
const RESOURCE_ID = 'resource-1';
const WORKING_MEMORY_URL = `${BASE_URL}/api/memory/threads/:threadId/working-memory`;

const EMPTY_COPY = 'No working memory content yet. Click "Edit Working Memory" to add content.';
const NO_THREAD_HINT = 'Send a message to the agent to enable working memory.';

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
};

// Exposes the context's public `refetch` so a test can simulate the background
// refresh the chat provider triggers after a stream finishes.
let refetchWorkingMemory: () => Promise<unknown> = () => Promise.resolve();
function RefetchProbe() {
  const ctx = useWorkingMemory();
  refetchWorkingMemory = ctx.refetch;
  return null;
}

function serveWorkingMemory(response: WorkingMemoryResponse | (() => WorkingMemoryResponse)) {
  const onRead = vi.fn<() => void>();
  server.use(
    http.get(WORKING_MEMORY_URL, () => {
      onRead();
      return HttpResponse.json(typeof response === 'function' ? response() : response);
    }),
  );
  return onRead;
}

function renderWorkingMemory(threadId = THREAD_ID) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const tree = (currentThreadId: string) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <WorkingMemoryProvider agentId={AGENT_ID} threadId={currentThreadId} resourceId={RESOURCE_ID}>
          <RefetchProbe />
          <AgentWorkingMemory agentId={AGENT_ID} />
        </WorkingMemoryProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );

  const result = render(tree(threadId));
  return { ...result, rerenderWithThread: (nextThreadId: string) => result.rerender(tree(nextThreadId)) };
}

const findEditButton = () => screen.findByRole('button', { name: 'Edit Working Memory' });
const getTextarea = () => screen.getByLabelText<HTMLTextAreaElement>('Working memory content');

beforeEach(() => {
  server.use(http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json(workingMemoryConfigEnabled)));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AgentWorkingMemory', () => {
  describe('viewing', () => {
    it('given the working-memory request is in flight, then shows a loading state until the markdown content arrives', async () => {
      const gate = deferred<void>();
      server.use(
        http.get(WORKING_MEMORY_URL, async () => {
          await gate.promise;
          return HttpResponse.json(markdownWorkingMemory('# Preferences\n\nLikes pasta'));
        }),
      );

      renderWorkingMemory();

      expect(screen.queryByText('Working Memory')).toBeNull();

      gate.resolve();

      expect(await screen.findByText('Preferences')).not.toBeNull();
      expect(screen.getByText('Likes pasta')).not.toBeNull();
      expect(screen.getByText('Working Memory')).not.toBeNull();
    });

    it('given a json template and compact json content, then pretty-prints the content', async () => {
      serveWorkingMemory(jsonWorkingMemory('{"name":"Ada","likes":["pasta"]}'));

      renderWorkingMemory();

      const pre = await screen.findByText(
        (_, node) => node?.tagName === 'PRE' && node.textContent?.includes('Ada') === true,
      );
      expect(pre.textContent).toBe(JSON.stringify({ name: 'Ada', likes: ['pasta'] }, null, 2));
    });

    it('given a json template and no content yet, then shows the pretty-printed template', async () => {
      serveWorkingMemory(jsonWorkingMemory(null, '{"name":"","likes":[]}'));

      renderWorkingMemory();

      const pre = await screen.findByText(
        (_, node) => node?.tagName === 'PRE' && node.textContent?.includes('likes') === true,
      );
      expect(pre.textContent).toBe(JSON.stringify({ name: '', likes: [] }, null, 2));
    });

    it('given a markdown template and no content yet, then shows the template content', async () => {
      serveWorkingMemory(markdownWorkingMemoryWithTemplate(null, '# User Profile\n\n- Name:'));

      renderWorkingMemory();

      expect(await screen.findByText('User Profile')).not.toBeNull();
      expect(screen.queryByText(EMPTY_COPY)).toBeNull();
    });

    it('given no content and no template, then shows the empty-state copy', async () => {
      serveWorkingMemory(markdownWorkingMemory(null));

      renderWorkingMemory();

      expect(await screen.findByText(EMPTY_COPY)).not.toBeNull();
    });

    it.each(['thread', 'resource'] as const)(
      'given source is %s, then shows the matching scope badge',
      async source => {
        serveWorkingMemory({ ...markdownWorkingMemory('hello'), source });

        renderWorkingMemory();

        expect(await screen.findByText(source)).not.toBeNull();
      },
    );

    it('given the thread does not exist yet, then explains how to enable it and disables editing', async () => {
      serveWorkingMemory({ ...markdownWorkingMemory(null), threadExists: false });

      renderWorkingMemory();

      expect(await screen.findByText(NO_THREAD_HINT)).not.toBeNull();
      const edit = await findEditButton();
      expect(edit.getAttribute('aria-disabled')).toBe('true');

      fireEvent.click(edit);
      expect(screen.queryByLabelText('Working memory content')).toBeNull();
    });

    it('given the working-memory request fails, then falls back to the empty state without crashing', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      server.use(http.get(WORKING_MEMORY_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

      renderWorkingMemory();

      expect(await screen.findByText(EMPTY_COPY)).not.toBeNull();
    });

    it('given working memory is disabled in the memory config, then shows the not-enabled explanation', async () => {
      server.use(http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json(workingMemoryConfigDisabled)));
      serveWorkingMemory(markdownWorkingMemory('hidden'));

      renderWorkingMemory();

      expect(await screen.findByText(/Working memory is not enabled for this agent/)).not.toBeNull();
      expect(screen.getByRole('link', { name: /Learn about working memory/ })).not.toBeNull();
      expect(screen.queryByText('hidden')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Edit Working Memory' })).toBeNull();
    });

    it('given the user switches thread, then shows the new thread memory and never the previous one', async () => {
      server.use(
        http.get(WORKING_MEMORY_URL, ({ params }) =>
          HttpResponse.json(markdownWorkingMemory(`memory of ${String(params.threadId)}`)),
        ),
      );

      const { rerenderWithThread } = renderWorkingMemory('thread-a');
      expect(await screen.findByText('memory of thread-a')).not.toBeNull();

      rerenderWithThread('thread-b');

      expect(await screen.findByText('memory of thread-b')).not.toBeNull();
      expect(screen.queryByText('memory of thread-a')).toBeNull();
    });
  });

  describe('editing', () => {
    it('given the thread exists, when the user edits and saves, then posts the new content and renders the saved value', async () => {
      let served = markdownWorkingMemory('old value');
      const onRead = serveWorkingMemory(() => served);
      const onWrite = vi.fn<(body: unknown) => void>();
      server.use(
        http.post(WORKING_MEMORY_URL, async ({ request }) => {
          onWrite(await request.json());
          served = markdownWorkingMemory('new value');
          return HttpResponse.json({ success: true });
        }),
      );

      renderWorkingMemory();
      expect(await screen.findByText('old value')).not.toBeNull();
      const readsBeforeSave = onRead.mock.calls.length;

      fireEvent.click(await findEditButton());
      fireEvent.change(getTextarea(), { target: { value: 'new value' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() =>
        expect(onWrite).toHaveBeenCalledWith({ workingMemory: 'new value', resourceId: RESOURCE_ID }),
      );
      expect(await screen.findByText('new value')).not.toBeNull();
      expect(screen.queryByLabelText('Working memory content')).toBeNull();
      expect(screen.queryByText('old value')).toBeNull();
      expect(onRead.mock.calls.length).toBeGreaterThan(readsBeforeSave);
    });

    it('given a json template, when the user saves invalid json, then reports the error and stays in edit mode without posting', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      serveWorkingMemory(jsonWorkingMemory('{"name":"Ada"}'));
      const onWrite = vi.fn<() => void>();
      server.use(
        http.post(WORKING_MEMORY_URL, () => {
          onWrite();
          return HttpResponse.json({ success: true });
        }),
      );

      renderWorkingMemory();

      fireEvent.click(await findEditButton());
      fireEvent.change(getTextarea(), { target: { value: '{not json' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => expect(toastError).toHaveBeenCalledWith('Failed to update working memory'));
      expect(onWrite).not.toHaveBeenCalled();
      expect(getTextarea().value).toBe('{not json');
    });

    it('given the user is editing, when a background refresh delivers new data, then the draft is kept', async () => {
      let served = markdownWorkingMemory('server v1');
      serveWorkingMemory(() => served);

      renderWorkingMemory();
      expect(await screen.findByText('server v1')).not.toBeNull();

      fireEvent.click(await findEditButton());
      fireEvent.change(getTextarea(), { target: { value: 'my draft' } });

      served = markdownWorkingMemory('server v2');
      await refetchWorkingMemory();

      await waitFor(() => expect(getTextarea().value).toBe('my draft'));

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(await screen.findByText('server v2')).not.toBeNull();
    });

    it('given the user is editing, when they cancel, then the original content is restored', async () => {
      serveWorkingMemory(markdownWorkingMemory('keep me'));

      renderWorkingMemory();
      fireEvent.click(await findEditButton());
      fireEvent.change(getTextarea(), { target: { value: 'discard me' } });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(await screen.findByText('keep me')).not.toBeNull();
      expect(screen.queryByLabelText('Working memory content')).toBeNull();
    });
  });
});
