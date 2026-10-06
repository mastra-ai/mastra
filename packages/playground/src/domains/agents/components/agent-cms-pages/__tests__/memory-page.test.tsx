import type { ListEmbeddersResponse, ListVectorsResponse } from '@mastra/client-js';
import { fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { AgentEditFormProvider } from '../../../context/agent-edit-form-context';
import type { AgentFormValues } from '../../agent-edit-page/utils/form-validation';
import { MemoryPage } from '../memory-page';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

function Harness({ scope, memoryRef }: { scope: 'thread' | 'resource'; memoryRef?: AgentFormValues['memoryRef'] }) {
  const form = useForm<AgentFormValues>({
    defaultValues: {
      name: 'Memory Agent',
      memory: { enabled: true, observationalMemory: { enabled: true, scope } },
      memoryRef,
    },
  });

  return (
    <AgentEditFormProvider form={form} mode="edit" isSubmitting={false} handlePublish={async () => {}}>
      <MemoryPage />
    </AgentEditFormProvider>
  );
}

const noVectors: ListVectorsResponse = { vectors: [] };
const noEmbedders: ListEmbeddersResponse = { embedders: [] };

const useMemoryPageHandlers = () => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/agents/providers`, () => HttpResponse.json({ providers: [] })),
    http.get(`${TEST_BASE_URL}/api/editor/builder/settings`, () =>
      HttpResponse.json({ enabled: false, modelPolicy: { active: false } }),
    ),
    http.get(`${TEST_BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json({ providers: [] })),
    http.get(`${TEST_BASE_URL}/api/vectors`, () => HttpResponse.json(noVectors)),
    http.get(`${TEST_BASE_URL}/api/embedders`, () => HttpResponse.json(noEmbedders)),
  );
};

describe('MemoryPage', () => {
  it('shows and hides the message count through the message history switch', async () => {
    useMemoryPageHandlers();

    renderWithProviders(<Harness scope="thread" />);

    const messageHistorySwitch = await screen.findByRole('switch', { name: 'Enable message history' });
    expect(screen.getByRole<HTMLInputElement>('spinbutton', { name: 'Recent messages' }).value).toBe('40');

    fireEvent.click(messageHistorySwitch);
    expect(screen.queryByLabelText('Recent messages')).toBeNull();

    fireEvent.click(messageHistorySwitch);
    expect(screen.getByRole<HTMLInputElement>('spinbutton', { name: 'Recent messages' }).value).toBe('40');
  });

  describe('when observational memory uses resource scope', () => {
    it('labels the selected scope as deprecated', async () => {
      useMemoryPageHandlers();

      renderWithProviders(<Harness scope="resource" />);

      expect(await screen.findByText('Resource (deprecated)')).not.toBeNull();
    });
  });

  describe('when observational memory uses thread scope', () => {
    it('explains that resource scope is deprecated in the scope help text', async () => {
      useMemoryPageHandlers();

      renderWithProviders(<Harness scope="thread" />);

      expect(await screen.findByText(/Resource scope is deprecated/)).not.toBeNull();
    });
  });

  describe('when the agent references a registered memory instance', () => {
    it('shows the registered memory id instead of the inline memory settings', async () => {
      useMemoryPageHandlers();

      renderWithProviders(<Harness scope="thread" memoryRef={{ type: 'id', memoryId: 'support-memory' }} />);

      expect(await screen.findByText('support-memory')).not.toBeNull();
      expect(screen.queryByText('Message History')).toBeNull();
    });
  });
});
