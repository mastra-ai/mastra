// @vitest-environment jsdom
import { cleanup, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useWizard } from '../../../../contexts/wizard-context';
import { AgentProfileLibraryStep } from '../agent-profile-library-step';
import { buildStoredAgent, configuredSlackPlatform } from './fixtures/builder';
import { BASE_URL, TEST_AGENT_ID, flush, registerStepHandlers, renderStep } from './test-utils';
import { server } from '@/test/msw-server';

const StepProbe = () => {
  const { step, next } = useWizard();
  return (
    <>
      <div data-testid="current-step">{step}</div>
      <button type="button" data-testid="probe-next" onClick={next}>
        next
      </button>
    </>
  );
};

// Onboarding tree (configured integration): ready>identity>instructions>library>integrations>end.
const advanceToLibrary = (getByTestId: (id: string) => HTMLElement) => {
  while (getByTestId('current-step').textContent !== 'library') {
    fireEvent.click(getByTestId('probe-next'));
  }
};

const renderLibrary = () =>
  renderStep(
    <>
      <StepProbe />
      <AgentProfileLibraryStep agentId={TEST_AGENT_ID} />
    </>,
  );

describe('AgentProfileLibraryStep', () => {
  beforeEach(() => {
    // A configured integration keeps `integrations` after `library`, so the
    // library step renders its own Continue CTA (not the last-step CTAs).
    registerStepHandlers({ platforms: configuredSlackPlatform });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders explanatory copy about adding to the library', async () => {
    const { getByTestId, getByText } = renderLibrary();
    await flush();

    expect(getByTestId('agent-builder-library-step')).toBeTruthy();
    expect(getByText(/Add to your library/i)).toBeTruthy();
    expect(getByText(/visible to everyone in your workspace/i)).toBeTruthy();
  });

  it('advances the wizard on Continue without any visibility mutation', async () => {
    const onMutate = vi.fn();
    server.use(
      http.patch(`${BASE_URL}/api/stored/agents/:id`, () => {
        onMutate();
        return HttpResponse.json({});
      }),
    );

    const { getByTestId, getByRole } = renderLibrary();
    await flush();

    advanceToLibrary(getByTestId);
    expect(getByTestId('current-step').textContent).toBe('library');
    fireEvent.click(getByRole('button', { name: /continue/i }));
    expect(getByTestId('current-step').textContent).toBe('integrations');
    expect(onMutate).not.toHaveBeenCalled();
  });

  it('adds the agent to the library through the confirm dialog and shows the added state', async () => {
    let capturedBody: unknown = null;
    server.use(
      http.patch(`${BASE_URL}/api/stored/agents/${TEST_AGENT_ID}`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(buildStoredAgent({ visibility: 'public' }));
      }),
    );

    const { getByTestId, queryByTestId, findByTestId } = renderLibrary();
    await flush();

    fireEvent.click(getByTestId('agent-builder-library-add'));
    const dialog = await findByTestId('agent-builder-visibility-confirm-dialog');
    expect(dialog.textContent).toContain('Add this agent to your library?');
    expect(capturedBody).toBeNull();

    fireEvent.click(getByTestId('agent-builder-visibility-confirm-yes'));

    await waitFor(() => {
      expect(capturedBody).toEqual({ visibility: 'public' });
    });
    await waitFor(() => {
      expect(getByTestId('agent-builder-library-added')).toBeTruthy();
    });
    expect(queryByTestId('agent-builder-library-add')).toBeNull();
  });

  it('shows the added state instead of the CTA when the agent is already in the library', async () => {
    registerStepHandlers({
      platforms: configuredSlackPlatform,
      storedAgent: buildStoredAgent({ visibility: 'public' }),
    });

    const { getByTestId, queryByTestId } = renderLibrary();
    await flush();

    expect(getByTestId('agent-builder-library-added')).toBeTruthy();
    expect(queryByTestId('agent-builder-library-add')).toBeNull();
  });
});
