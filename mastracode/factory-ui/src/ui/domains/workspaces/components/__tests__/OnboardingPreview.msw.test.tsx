import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { queryKeys } from '../../../../../api/keys';
import { OnboardingPreview } from '../onboarding/preview/OnboardingPreview';

describe('contextual onboarding previews', () => {
  it('shows the personal Factory model when shared access is absent', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
        HttpResponse.json({
          providers: [{ provider: 'anthropic', source: 'stored-user', userCredential: 'api_key' }],
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, reason: 'not_connected' }),
      ),
    );
    renderWithProviders(
      <OnboardingPreview
        step="model"
        modelScope="user"
        personalProviderId="anthropic"
        personalModel="anthropic/claude-fable-5"
        personalConnectionMethod="api_key"
      />,
    );
    const personalScene = screen.getByLabelText('Account setup preview');
    expect(personalScene.closest('[data-active]')).toHaveAttribute('data-active', 'true');
    const personal = within(personalScene);
    expect(within(personal.getByLabelText('Factory work model')).getByText('anthropic/claude-fable-5')).toBeVisible();
    expect(await personal.findByText('Your account is connected')).toBeVisible();
  });

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
    const { container, rerender } = renderWithProviders(
      <OnboardingPreview step="project-management" source="linear" />,
    );
    const intakeFields = () =>
      Array.from(container.querySelectorAll('[data-slot="metadata-item"]'), item => item.textContent);
    expect(intakeFields()).toEqual(['ENG-124', 'Issue']);
    expect(screen.getByText('Example')).toBeInTheDocument();
    expect(screen.getByText('Choose what to bring in after setup.')).toBeInTheDocument();

    rerender(<OnboardingPreview step="project-management" source="incident-io" />);
    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(intakeFields()).toEqual(['INC-124', 'Follow-up']);
    expect(screen.getAllByText('Add a health check')).toHaveLength(2);
    expect(screen.queryByText('ENG-124')).not.toBeInTheDocument();
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
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, reason: 'not_connected' }),
      ),
      http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
        HttpResponse.json({ modelId: null, thinkingLevel: null }),
      ),
    );
    const { client, rerender } = renderWithProviders(
      <OnboardingPreview step="model" modelScope="hybrid" model="openai/gpt-5.6-sol" personalProviderId="anthropic" />,
    );
    const shared = within(screen.getByLabelText('Factory work model'));
    const personal = within(screen.getByLabelText('Session model'));
    expect(shared.getByText('openai/gpt-5.6-sol')).toBeInTheDocument();
    expect(await personal.findByText('Connect your account')).toBeInTheDocument();

    saved = true;
    await client.invalidateQueries({ queryKey: queryKeys.providers() });
    expect(await personal.findByText('Your account is connected')).toBeInTheDocument();
    expect(shared.getByText('openai/gpt-5.6-sol')).toBeInTheDocument();

    rerender(<OnboardingPreview step="model" modelScope="hybrid" model="openai/gpt-5.6-sol" />);
    expect(personal.getByText('Connect your account')).toBeInTheDocument();
    expect(shared.getByText('openai/gpt-5.6-sol')).toBeInTheDocument();
  });
});
