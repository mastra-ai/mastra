import type { ListAgentsModelProvidersResponse } from '@mastra/client-js';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { AgentEditFormProvider } from '../../../context/agent-edit-form-context';
import type { AgentFormValues } from '../../agent-edit-page/utils/form-validation';
import { InformationPage } from '../information-page';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const prefixedGatewayProviders = {
  providers: [
    {
      id: 'private/ollama',
      name: 'Ollama',
      envVar: 'PRIVATE_API_KEY',
      connected: true,
      models: ['gpt-oss:20b'],
    },
  ],
} satisfies ListAgentsModelProvidersResponse;

function Harness({ model }: { model: AgentFormValues['model'] }) {
  const form = useForm<AgentFormValues>({ defaultValues: { name: 'Research Agent', model } });

  return (
    <AgentEditFormProvider form={form} mode="edit" isSubmitting={false} handlePublish={async () => {}}>
      <InformationPage />
    </AgentEditFormProvider>
  );
}

describe('InformationPage', () => {
  describe('when the agent runs on a model routed through a prefixed custom gateway', () => {
    // The agent endpoint reports `private/ollama/gpt-oss:20b` as provider `private` and model
    // `ollama/gpt-oss:20b`, while the providers list has provider `private/ollama`.
    it("selects the agent's provider and model", async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/agents/providers`, () => HttpResponse.json(prefixedGatewayProviders)),
        http.get(`${TEST_BASE_URL}/api/editor/builder/settings`, () =>
          HttpResponse.json({ enabled: false, modelPolicy: { active: false } }),
        ),
        http.get(`${TEST_BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json({ providers: [] })),
      );

      renderWithProviders(<Harness model={{ provider: 'private', name: 'ollama/gpt-oss:20b' }} />);

      await waitFor(() => expect(screen.getByPlaceholderText('Select provider')).toHaveProperty('value', 'Ollama'));
      expect(screen.getByPlaceholderText('Select model')).toHaveProperty('value', 'gpt-oss:20b');
    });
  });
});
