import type { ListEmbeddersResponse, ListVectorsResponse } from '@mastra/client-js';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { AgentEditFormProvider } from '../../../context/agent-edit-form-context';
import type { AgentFormValues } from '../../agent-edit-page/utils/form-validation';
import { MemoryPage } from '../memory-page';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

function Harness({ scope }: { scope: 'thread' | 'resource' }) {
  const form = useForm<AgentFormValues>({
    defaultValues: {
      name: 'Memory Agent',
      memory: { enabled: true, observationalMemory: { enabled: true, scope } },
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
});
