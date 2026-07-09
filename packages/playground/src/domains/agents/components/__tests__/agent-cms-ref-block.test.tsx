import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { AgentCMSRefBlock } from '../agent-cms-blocks/agent-cms-ref-block';
import type { RefInstructionBlock } from '../agent-edit-page/utils/form-validation';
import { emptyStoredAgents, promptBlock } from './fixtures/prompt-blocks';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const refBlock = (promptBlockId: string): RefInstructionBlock => ({
  id: `ref-${promptBlockId}`,
  type: 'prompt_block_ref',
  promptBlockId,
});

// The ref block renders through `ContentBlock`'s `<Draggable>`, which requires a
// surrounding droppable/drag-drop context to mount.
const renderRefBlock = (block: RefInstructionBlock) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <DragDropContext onDragEnd={() => {}}>
            <Droppable droppableId="ref-block-test">
              {provided => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  <AgentCMSRefBlock index={0} block={block} />
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

// The ref block always looks up which agents reference the block ("Used by").
const stubUsedByAgents = () =>
  server.use(http.get(`${BASE_URL}/api/stored/agents`, () => HttpResponse.json(emptyStoredAgents)));

afterEach(() => cleanup());

describe('AgentCMSRefBlock', () => {
  it('warns that a draft ref is skipped at runtime', async () => {
    stubUsedByAgents();
    server.use(
      http.get(`${BASE_URL}/api/stored/prompt-blocks/draft-block`, () =>
        // No activeVersionId → draft → runtime skips it.
        HttpResponse.json(promptBlock({ id: 'draft-block', name: 'Draft Block', status: 'draft' })),
      ),
    );

    renderRefBlock(refBlock('draft-block'));

    expect(await screen.findByText('Draft')).not.toBeNull();
    expect(screen.getByText(/skips it at runtime until the block is published/)).not.toBeNull();
    // The draft warning is distinct from the unpublished-edits warning.
    expect(screen.queryByText('Unpublished edits')).toBeNull();
  });

  it('renders a published ref without any draft or unpublished-edits warning', async () => {
    stubUsedByAgents();
    server.use(
      http.get(`${BASE_URL}/api/stored/prompt-blocks/live-block`, () =>
        HttpResponse.json(
          promptBlock({ id: 'live-block', name: 'Live Block', status: 'published', activeVersionId: 'v1' }),
        ),
      ),
    );

    renderRefBlock(refBlock('live-block'));

    expect(await screen.findByText('Live Block')).not.toBeNull();
    expect(screen.queryByText('Draft')).toBeNull();
    expect(screen.queryByText('Unpublished edits')).toBeNull();
    expect(screen.queryByText(/skips it at runtime/)).toBeNull();
  });

  it('warns that a published block with newer edits runs its last published version', async () => {
    stubUsedByAgents();
    server.use(
      http.get(`${BASE_URL}/api/stored/prompt-blocks/edited-block`, () =>
        // Published (activeVersionId) but with unpublished edits (hasDraft).
        HttpResponse.json(
          promptBlock({
            id: 'edited-block',
            name: 'Edited Block',
            status: 'published',
            activeVersionId: 'v1',
            hasDraft: true,
          }),
        ),
      ),
    );

    renderRefBlock(refBlock('edited-block'));

    expect(await screen.findByText('Unpublished edits')).not.toBeNull();
    expect(screen.getByText(/runs the last published version at runtime/)).not.toBeNull();
    expect(screen.queryByText('Draft')).toBeNull();
  });

  it('shows a loading state while the referenced block is in flight', async () => {
    stubUsedByAgents();
    let resolveBlock: () => void = () => {};
    const blockReady = new Promise<void>(resolve => {
      resolveBlock = resolve;
    });
    server.use(
      http.get(`${BASE_URL}/api/stored/prompt-blocks/slow-block`, async () => {
        await blockReady;
        return HttpResponse.json(promptBlock({ id: 'slow-block', name: 'Slow Block', status: 'draft' }));
      }),
    );

    renderRefBlock(refBlock('slow-block'));

    expect(await screen.findByText('Loading prompt block...')).not.toBeNull();

    resolveBlock();
    await waitFor(() => expect(screen.queryByText('Loading prompt block...')).toBeNull());
  });

  it('shows a not-found message when the referenced block no longer exists', async () => {
    stubUsedByAgents();
    server.use(http.get(`${BASE_URL}/api/stored/prompt-blocks/missing-block`, () => HttpResponse.json(null)));

    renderRefBlock(refBlock('missing-block'));

    expect(await screen.findByText('Prompt block not found (ID: missing-block)')).not.toBeNull();
  });
});
