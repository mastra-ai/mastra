// @vitest-environment jsdom
import { cleanup, fireEvent, waitFor } from '@testing-library/react';
import { useLocation, Route  } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useWizard } from '../../../../contexts/wizard-context';
import { AgentProfileReadyStep } from '../agent-profile-ready-step';
import { TEST_AGENT_ID, flush, registerStepHandlers, renderStep } from './test-utils';

const StepProbe = () => {
  const { step } = useWizard();
  return <div data-testid="current-step">{step}</div>;
};

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

const renderReady = () =>
  renderStep(
    <>
      <StepProbe />
      <AgentProfileReadyStep />
    </>,
    { extraRoutes: <Route path="/agent-builder/agents/:id/view" element={<LocationProbe />} /> },
  );

describe('AgentProfileReadyStep', () => {
  beforeEach(() => {
    registerStepHandlers();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the ready heading and both CTAs', async () => {
    const { getByTestId } = renderReady();
    await flush();

    expect(getByTestId('agent-builder-ready-heading').textContent).toBe('Your agent is ready');
    expect(getByTestId('agent-builder-ready-review')).toBeTruthy();
    expect(getByTestId('agent-builder-ready-try')).toBeTruthy();
  });

  it('advances the wizard when "Review my agent" is clicked', async () => {
    const { getByTestId } = renderReady();
    await flush();

    expect(getByTestId('current-step').textContent).toBe('ready');
    fireEvent.click(getByTestId('agent-builder-ready-review'));
    expect(getByTestId('current-step').textContent).toBe('identity');
  });

  it('navigates to the agent view page when "Try my agent" is clicked', async () => {
    const { getByTestId } = renderReady();
    await flush();

    fireEvent.click(getByTestId('agent-builder-ready-try'));
    await waitFor(() =>
      expect(getByTestId('location').textContent).toBe(`/agent-builder/agents/${TEST_AGENT_ID}/view`),
    );
  });

  describe('specular sweep animation', () => {
    // jsdom implements neither Element.animate nor a real matchMedia, so the
    // tests install spies on both to observe the WAAPI call.
    const stubMatchMedia = (matches: boolean) => {
      vi.spyOn(window, 'matchMedia').mockImplementation(
        (query: string) =>
          ({
            matches: query.includes('prefers-reduced-motion') ? matches : false,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
          }) as MediaQueryList,
      );
    };

    let animateSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      animateSpy = vi.fn();
      Object.defineProperty(HTMLElement.prototype, 'animate', {
        configurable: true,
        writable: true,
        value: animateSpy,
      });
    });

    afterEach(() => {
      // @ts-expect-error -- jsdom has no native Element.animate; remove the stub entirely
      delete HTMLElement.prototype.animate;
      vi.restoreAllMocks();
    });

    it('plays the sweep exactly once on mount and not again on re-render', async () => {
      stubMatchMedia(false);
      const { rerenderStep } = renderReady();
      await flush();

      expect(animateSpy).toHaveBeenCalledTimes(1);

      rerenderStep();
      await flush();

      expect(animateSpy).toHaveBeenCalledTimes(1);
    });

    it('skips the sweep entirely when prefers-reduced-motion is set', async () => {
      stubMatchMedia(true);
      renderReady();
      await flush();

      expect(animateSpy).not.toHaveBeenCalled();
    });
  });
});
