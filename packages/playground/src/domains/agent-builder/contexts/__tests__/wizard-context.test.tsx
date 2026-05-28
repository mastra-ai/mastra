// @vitest-environment jsdom
import type { StoredSkillResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { useBuilderAgentFeatures } from '../../hooks/use-builder-agent-features';
import { WizardProvider, useWizard } from '../wizard-context';
import type { WizardStep } from '../wizard-context';
import { server } from '@/test/msw-server';

type Features = ReturnType<typeof useBuilderAgentFeatures>;

const DEFAULT_FEATURES: Features = {
  tools: false,
  memory: false,
  workflows: false,
  agents: false,
  avatarUpload: false,
  skills: false,
  model: false,
  favorites: false,
  browser: false,
};

let featuresMock: Features = { ...DEFAULT_FEATURES };
let skillsMock: StoredSkillResponse[] = [];

vi.mock('@/domains/agent-builder/hooks/use-builder-agent-features', () => ({
  useBuilderAgentFeatures: () => featuresMock,
}));

vi.mock('@/domains/agent-builder/contexts/agent-primitives-context', () => ({
  useAgentPrimitives: () => ({ availableSkills: skillsMock }),
}));

const BASE_URL = 'http://localhost:4111';

interface PlatformsFixture {
  id: string;
  name: string;
  isConfigured: boolean;
}

const usePlatformsHandler = (platforms: PlatformsFixture[]) => {
  server.use(http.get('*/api/channels/platforms', () => HttpResponse.json(platforms)));
};

const Probe = () => {
  const { step, next, steps, isLast } = useWizard();
  return (
    <div>
      <div data-testid="step">{step}</div>
      <div data-testid="steps">{steps.join('>')}</div>
      <div data-testid="is-last">{isLast ? 'yes' : 'no'}</div>
      <button type="button" data-testid="next" onClick={next}>
        next
      </button>
    </div>
  );
};

const renderWizard = ({
  initialStep,
  children,
}: {
  initialStep?: WizardStep;
  children?: ReactNode;
} = {}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <WizardProvider initialStep={initialStep}>{children ?? <Probe />}</WizardProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

const flushPlatforms = () => act(async () => new Promise(resolve => setTimeout(resolve, 0)));

describe('WizardProvider', () => {
  beforeEach(() => {
    featuresMock = { ...DEFAULT_FEATURES };
    skillsMock = [];
    usePlatformsHandler([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('defaults to end when no initialStep is passed (no fresh-thread starter)', async () => {
    const { getByTestId } = renderWizard();
    await flushPlatforms();

    expect(getByTestId('steps').textContent).toBe('instructions>end');
    expect(getByTestId('step').textContent).toBe('end');

    fireEvent.click(getByTestId('next'));
    expect(getByTestId('step').textContent).toBe('end');
  });

  it('walks initial -> instructions -> end when all features are off and initialStep=initial', async () => {
    const { getByTestId } = renderWizard({ initialStep: 'initial' });
    await flushPlatforms();

    expect(getByTestId('steps').textContent).toBe('initial>instructions>end');
    expect(getByTestId('step').textContent).toBe('initial');

    fireEvent.click(getByTestId('next'));
    expect(getByTestId('step').textContent).toBe('instructions');

    fireEvent.click(getByTestId('next'));
    expect(getByTestId('step').textContent).toBe('end');

    // No-op at end.
    fireEvent.click(getByTestId('next'));
    expect(getByTestId('step').textContent).toBe('end');
  });

  it('builds the full tree when all features are on and a configured platform exists', async () => {
    featuresMock = {
      ...DEFAULT_FEATURES,
      tools: true,
      model: true,
      skills: true,
      browser: true,
    };
    skillsMock = [{ id: 'skill-a' } as StoredSkillResponse];
    usePlatformsHandler([{ id: 'slack', name: 'Slack', isConfigured: true }]);

    const { getByTestId } = renderWizard({ initialStep: 'initial' });

    await waitFor(() => {
      expect(getByTestId('steps').textContent).toBe('initial>model>tools>instructions>skills>browser>integrations>end');
    });

    const expectedOrder: WizardStep[] = [
      'initial',
      'model',
      'tools',
      'instructions',
      'skills',
      'browser',
      'integrations',
      'end',
    ];
    for (let i = 0; i < expectedOrder.length; i++) {
      expect(getByTestId('step').textContent).toBe(expectedOrder[i]);
      if (i < expectedOrder.length - 1) fireEvent.click(getByTestId('next'));
    }

    // Still no-op at end.
    fireEvent.click(getByTestId('next'));
    expect(getByTestId('step').textContent).toBe('end');
  });

  it('skips a feature step when the matching flag is off (tools off, model on)', async () => {
    featuresMock = { ...DEFAULT_FEATURES, model: true, tools: false };

    const { getByTestId } = renderWizard({ initialStep: 'initial' });
    await flushPlatforms();

    expect(getByTestId('steps').textContent).toBe('initial>model>instructions>end');

    fireEvent.click(getByTestId('next')); // initial -> model
    expect(getByTestId('step').textContent).toBe('model');
    fireEvent.click(getByTestId('next')); // model -> instructions
    expect(getByTestId('step').textContent).toBe('instructions');
  });

  it('skips a feature step when the matching flag is off (tools on, model off)', async () => {
    featuresMock = { ...DEFAULT_FEATURES, model: false, tools: true };

    const { getByTestId } = renderWizard({ initialStep: 'initial' });
    await flushPlatforms();

    expect(getByTestId('steps').textContent).toBe('initial>tools>instructions>end');
  });

  it('excludes skills when features.skills is on but no skills are available', async () => {
    featuresMock = { ...DEFAULT_FEATURES, skills: true };
    skillsMock = [];

    const { getByTestId } = renderWizard({ initialStep: 'initial' });
    await flushPlatforms();

    expect(getByTestId('steps').textContent).toBe('initial>instructions>end');
  });

  it('includes skills when features.skills is on and skills are available', async () => {
    featuresMock = { ...DEFAULT_FEATURES, skills: true };
    skillsMock = [{ id: 'skill-a' } as StoredSkillResponse];

    const { getByTestId } = renderWizard({ initialStep: 'initial' });
    await flushPlatforms();

    expect(getByTestId('steps').textContent).toBe('initial>instructions>skills>end');
  });

  it('excludes integrations when no platform is configured', async () => {
    usePlatformsHandler([{ id: 'slack', name: 'Slack', isConfigured: false }]);

    const { getByTestId } = renderWizard({ initialStep: 'initial' });
    await waitFor(() => {
      // Platforms query has resolved; nothing should have added `integrations`.
      expect(getByTestId('steps').textContent).toBe('initial>instructions>end');
    });
  });

  it('includes integrations when at least one platform is configured', async () => {
    usePlatformsHandler([
      { id: 'slack', name: 'Slack', isConfigured: false },
      { id: 'discord', name: 'Discord', isConfigured: true },
    ]);

    const { getByTestId } = renderWizard({ initialStep: 'initial' });
    await waitFor(() => {
      expect(getByTestId('steps').textContent).toBe('initial>instructions>integrations>end');
    });
  });

  it('clamps initialStep forward when the requested step is gated out', async () => {
    // model feature is off, but the caller asked us to start on `model`.
    featuresMock = { ...DEFAULT_FEATURES, model: false };

    const { getByTestId } = renderWizard({ initialStep: 'model' });
    await flushPlatforms();

    // model is filtered out -> tree is `instructions>end`. We clamp forward
    // to the first surviving step: `instructions`.
    expect(getByTestId('steps').textContent).toBe('instructions>end');
    expect(getByTestId('step').textContent).toBe('instructions');
  });

  it('returns a safe end-step default when useWizard is called outside the provider', () => {
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('step').textContent).toBe('end');
    expect(getByTestId('steps').textContent).toBe('');
    expect(getByTestId('is-last').textContent).toBe('no');
  });

  describe('isLast', () => {
    it('is true on instructions (the only user-facing step) and false after advancing to end', async () => {
      const { getByTestId } = renderWizard();
      await flushPlatforms();

      expect(getByTestId('steps').textContent).toBe('instructions>end');
      // Default state is 'end', not 'instructions'.
      expect(getByTestId('step').textContent).toBe('end');
      expect(getByTestId('is-last').textContent).toBe('no');
    });

    it('is true on the last user-facing step when starting from initial', async () => {
      const { getByTestId } = renderWizard({ initialStep: 'initial' });
      await flushPlatforms();

      // Tree: initial > instructions > end. instructions is the last user step.
      expect(getByTestId('step').textContent).toBe('initial');
      expect(getByTestId('is-last').textContent).toBe('no');

      fireEvent.click(getByTestId('next'));
      expect(getByTestId('step').textContent).toBe('instructions');
      expect(getByTestId('is-last').textContent).toBe('yes');

      fireEvent.click(getByTestId('next'));
      expect(getByTestId('step').textContent).toBe('end');
      expect(getByTestId('is-last').textContent).toBe('no');
    });

    it('is false on intermediate steps and true only on the final user-facing one', async () => {
      featuresMock = { ...DEFAULT_FEATURES, model: true, tools: true };

      const { getByTestId } = renderWizard({ initialStep: 'initial' });
      await flushPlatforms();

      // Tree: initial > model > tools > instructions > end.
      const order: { step: WizardStep; isLast: 'yes' | 'no' }[] = [
        { step: 'initial', isLast: 'no' },
        { step: 'model', isLast: 'no' },
        { step: 'tools', isLast: 'no' },
        { step: 'instructions', isLast: 'yes' },
        { step: 'end', isLast: 'no' },
      ];

      for (let i = 0; i < order.length; i++) {
        expect(getByTestId('step').textContent).toBe(order[i].step);
        expect(getByTestId('is-last').textContent).toBe(order[i].isLast);
        if (i < order.length - 1) fireEvent.click(getByTestId('next'));
      }
    });
  });
});
