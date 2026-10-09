import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { queryKeys } from '../../../../../api/keys';
import { OnboardingPreview } from '../OnboardingPreview';

describe('contextual onboarding previews', () => {
  it('shows the selected tracker’s issue becoming a backlog card and uses its connection state', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, reason: 'not_connected' }),
      ),
      http.get(`${TEST_BASE_URL}/web/integrations/platform/incident-io/connections`, () =>
        HttpResponse.json({
          connections: [{ id: 'incident-1', integrationId: 'incident-io', status: 'active', accountLabel: 'acme' }],
        }),
      ),
    );
    const { rerender } = renderWithProviders(<OnboardingPreview step="project-management" source="linear" />);
    expect(screen.getByText('ENG-124 · Issue')).toBeInTheDocument();
    expect(screen.getByText('Example')).toBeInTheDocument();
    expect(screen.getByText('Choose what to bring in after setup.')).toBeInTheDocument();

    rerender(<OnboardingPreview step="project-management" source="incident-io" />);
    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('INC-124 · Follow-up')).toBeInTheDocument();
    expect(screen.getAllByText('Add a health check')).toHaveLength(2);
    expect(screen.queryByText('ENG-124 · Issue')).not.toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: 'Your Factory: ideas become reviewed code, with repository context and connected work',
      }),
    ).toBeInTheDocument();
  });

  it('keeps the shared model while personal access changes from a proposed connection to a saved credential', async () => {
    let saved = false;
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
        HttpResponse.json({
          providers: [
            {
              provider: 'anthropic',
              source: 'stored-org',
              orgCredential: 'api_key',
              ...(saved ? { userCredential: 'api_key' } : {}),
            },
          ],
        }),
      ),
    );
    const { client, rerender } = renderWithProviders(
      <OnboardingPreview step="personal-provider" model="openai/gpt-5.6-sol" personalProviderId="anthropic" />,
    );
    const shared = within(screen.getByLabelText('Factory work model'));
    const personal = within(screen.getByLabelText('Personal sessions provider'));
    expect(shared.getByText('openai/gpt-5.6-sol')).toBeInTheDocument();
    expect(await personal.findByText('Connect to use · only you')).toBeInTheDocument();
    expect(personal.getByText('Anthropic')).toBeInTheDocument();

    saved = true;
    await client.invalidateQueries({ queryKey: queryKeys.providers() });
    expect(await personal.findByText('Connected · only you')).toBeInTheDocument();
    expect(shared.getByText('openai/gpt-5.6-sol')).toBeInTheDocument();

    rerender(<OnboardingPreview step="personal-provider" model="openai/gpt-5.6-sol" />);
    expect(personal.getByText('No extra connection needed')).toBeInTheDocument();
    expect(shared.getByText('openai/gpt-5.6-sol')).toBeInTheDocument();
  });
});
