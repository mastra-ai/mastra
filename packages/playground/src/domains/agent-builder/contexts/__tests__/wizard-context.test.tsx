import type { BuilderSettingsResponse, StoredSkillResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WizardProvider, useWizard } from '../wizard-context';
import type { WizardStep } from '../wizard-context';
import { buildBuilderSettings } from './fixtures/builder';
import { server } from '@/test/msw-server';

type AgentFeatures = Partial<NonNullable<NonNullable<BuilderSettingsResponse['features']>['agent']>>;

// The skills list is read from the agent-primitives context. That context is a
// heavy aggregator (stored agent, tools, agents, workflows, skills, workspaces,
// auth) with its own dedicated tests, so it is stubbed here as a thin seam to
// feed only `availableSkills` into the wizard step computation.
let skillsMock: StoredSkillResponse[] = [];

vi.mock('@/domains/agent-builder/contexts/agent-primitives-context', () => ({
  useAgentPrimitives: () => ({ availableSkills: skillsMock }),
}));

const BASE_URL = 'http://localhost:4111';

interface PlatformsFixture {
  id: string;
  name: string;
  isConfigured: boolean;
}

const setPlatformsHandler = (platforms: PlatformsFixture[]) => {
  server.use(http.get('*/api/channels/platforms', () => HttpResponse.json(platforms)));
};

const setBuilderSettingsHandler = (settings: BuilderSettingsResponse) => {
  server.use(http.get('*/editor/builder/settings', () => HttpResponse.json(settings)));
};

/** Drives the real `useBuilderAgentFeatures` hook through builder settings. */
const setFeatures = (agentFeatures?: AgentFeatures, extra?: Partial<BuilderSettingsResponse>) => {
  setBuilderSettingsHandler({ ...buildBuilderSettings(agentFeatures), ...extra });
};

const Probe = () => {
  const { step, next, prev, steps, isLast } = useWizard();
  return (
    <div>
      <div data-testid="step">{step}</div>
      <div data-testid="steps">{steps.join('>')}</div>
      <div data-testid="is-last">{isLast ? 'yes' : 'no'}</div>
      <button type="button" data-testid="next" onClick={next}>
        next
      </button>
      <button type="button" data-testid="prev" onClick={prev}>
        prev
      </button>
    </div>
  );
};

const renderWizard = ({
  initialStep,
  hasAgentTools,
  children,
}: {
  initialStep?: WizardStep;
  hasAgentTools?: boolean;
  children?: ReactNode;
} = {}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <WizardProvider initialStep={initialStep} hasAgentTools={hasAgentTools}>
          {children ?? <Probe />}
        </WizardProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

const expectSteps = async (getByTestId: (id: string) => HTMLElement, steps: string) =>
  waitFor(() => expect(getByTestId('steps').textContent).toBe(steps));

describe('WizardProvider', () => {
  beforeEach(() => {
    skillsMock = [];
    setPlatformsHandler([]);
    setFeatures();
  });

  afterEach(() => {
    cleanup();
  });

  describe('when no initialStep is passed', () => {
    it('defaults to the end step with no fresh-thread starter', async () => {
      const { getByTestId } = renderWizard();
      await expectSteps(getByTestId, 'instructions>end');

      expect(getByTestId('step').textContent).toBe('end');

      fireEvent.click(getByTestId('next'));
      expect(getByTestId('step').textContent).toBe('end');
    });
  });

  describe('when all features are off and initialStep is ready', () => {
    it('walks ready -> identity -> instructions -> library -> end', async () => {
      const { getByTestId } = renderWizard({ initialStep: 'ready' });
      await expectSteps(getByTestId, 'ready>identity>instructions>library>end');

      expect(getByTestId('step').textContent).toBe('ready');

      fireEvent.click(getByTestId('next'));
      expect(getByTestId('step').textContent).toBe('identity');

      fireEvent.click(getByTestId('next'));
      expect(getByTestId('step').textContent).toBe('instructions');

      fireEvent.click(getByTestId('next'));
      expect(getByTestId('step').textContent).toBe('library');

      fireEvent.click(getByTestId('next'));
      expect(getByTestId('step').textContent).toBe('end');
    });

    it('is a no-op when advancing past the end step', async () => {
      const { getByTestId } = renderWizard({ initialStep: 'ready' });
      await expectSteps(getByTestId, 'ready>identity>instructions>library>end');

      for (let i = 0; i < 5; i++) fireEvent.click(getByTestId('next'));
      expect(getByTestId('step').textContent).toBe('end');
    });

    it('is a no-op when going back from the first step', async () => {
      const { getByTestId } = renderWizard({ initialStep: 'ready' });
      await expectSteps(getByTestId, 'ready>identity>instructions>library>end');

      fireEvent.click(getByTestId('prev'));
      expect(getByTestId('step').textContent).toBe('ready');
    });

    it('walks backward with prev()', async () => {
      const { getByTestId } = renderWizard({ initialStep: 'ready' });
      await expectSteps(getByTestId, 'ready>identity>instructions>library>end');

      fireEvent.click(getByTestId('next')); // ready -> identity
      fireEvent.click(getByTestId('next')); // identity -> instructions
      expect(getByTestId('step').textContent).toBe('instructions');

      fireEvent.click(getByTestId('prev')); // instructions -> identity
      expect(getByTestId('step').textContent).toBe('identity');

      fireEvent.click(getByTestId('prev')); // identity -> ready
      expect(getByTestId('step').textContent).toBe('ready');
    });

    it('round-trips next() then prev()', async () => {
      const { getByTestId } = renderWizard({ initialStep: 'ready' });
      await expectSteps(getByTestId, 'ready>identity>instructions>library>end');

      fireEvent.click(getByTestId('next'));
      expect(getByTestId('step').textContent).toBe('identity');
      fireEvent.click(getByTestId('prev'));
      expect(getByTestId('step').textContent).toBe('ready');
    });
  });

  describe('when all features are on and a configured platform exists', () => {
    it('builds the full step tree', async () => {
      setFeatures({ tools: true, model: true, skills: true, browser: true });
      skillsMock = [{ id: 'skill-a' } as StoredSkillResponse];
      setPlatformsHandler([{ id: 'slack', name: 'Slack', isConfigured: true }]);

      const { getByTestId } = renderWizard({ initialStep: 'ready' });

      await expectSteps(getByTestId, 'ready>identity>model>tools>instructions>skills>browser>library>integrations>end');
    });

    it('advances through every step in order and is a no-op at end', async () => {
      setFeatures({ tools: true, model: true, skills: true, browser: true });
      skillsMock = [{ id: 'skill-a' } as StoredSkillResponse];
      setPlatformsHandler([{ id: 'slack', name: 'Slack', isConfigured: true }]);

      const { getByTestId } = renderWizard({ initialStep: 'ready' });
      await expectSteps(getByTestId, 'ready>identity>model>tools>instructions>skills>browser>library>integrations>end');

      const expectedOrder: WizardStep[] = [
        'ready',
        'identity',
        'model',
        'tools',
        'instructions',
        'skills',
        'browser',
        'library',
        'integrations',
        'end',
      ];
      for (let i = 0; i < expectedOrder.length; i++) {
        expect(getByTestId('step').textContent).toBe(expectedOrder[i]);
        if (i < expectedOrder.length - 1) fireEvent.click(getByTestId('next'));
      }

      fireEvent.click(getByTestId('next'));
      expect(getByTestId('step').textContent).toBe('end');
    });
  });

  describe('when a feature flag is off', () => {
    it('skips tools and keeps model when only model is on', async () => {
      setFeatures({ model: true, tools: false });

      const { getByTestId } = renderWizard({ initialStep: 'ready' });
      await expectSteps(getByTestId, 'ready>identity>model>instructions>library>end');

      fireEvent.click(getByTestId('next')); // ready -> identity
      fireEvent.click(getByTestId('next')); // identity -> model
      expect(getByTestId('step').textContent).toBe('model');
      fireEvent.click(getByTestId('next')); // model -> instructions
      expect(getByTestId('step').textContent).toBe('instructions');
    });

    it('skips model and keeps tools when only tools is on', async () => {
      setFeatures({ model: false, tools: true });

      const { getByTestId } = renderWizard({ initialStep: 'ready' });
      await expectSteps(getByTestId, 'ready>identity>tools>instructions>library>end');
    });
  });

  describe('when features.skills is on', () => {
    it('excludes the skills step when no skills are available', async () => {
      setFeatures({ skills: true });
      skillsMock = [];

      const { getByTestId } = renderWizard({ initialStep: 'ready' });
      await expectSteps(getByTestId, 'ready>identity>instructions>library>end');
    });

    it('includes the skills step when skills are available', async () => {
      setFeatures({ skills: true });
      skillsMock = [{ id: 'skill-a' } as StoredSkillResponse];

      const { getByTestId } = renderWizard({ initialStep: 'ready' });
      await expectSteps(getByTestId, 'ready>identity>instructions>skills>library>end');
    });
  });

  describe('gating parity with agent-profile-tabs', () => {
    it('includes model when features.model is off but the admin model policy is active', async () => {
      setFeatures({ model: false }, { modelPolicy: { active: true } });

      const { getByTestId } = renderWizard({ initialStep: 'ready' });
      await expectSteps(getByTestId, 'ready>identity>model>instructions>library>end');
    });

    it('includes tools when only features.agents is on and agent tools exist', async () => {
      setFeatures({ agents: true });

      const { getByTestId } = renderWizard({ initialStep: 'ready', hasAgentTools: true });
      await expectSteps(getByTestId, 'ready>identity>tools>instructions>library>end');
    });

    it('includes tools when only features.workflows is on and agent tools exist', async () => {
      setFeatures({ workflows: true });

      const { getByTestId } = renderWizard({ initialStep: 'ready', hasAgentTools: true });
      await expectSteps(getByTestId, 'ready>identity>tools>instructions>library>end');
    });

    it('excludes tools when the feature is on but no agent tools are available', async () => {
      setFeatures({ tools: true });

      const { getByTestId } = renderWizard({ initialStep: 'ready', hasAgentTools: false });
      await expectSteps(getByTestId, 'ready>identity>instructions>library>end');
    });
  });

  describe('when channel platforms are configured', () => {
    it('excludes integrations when no platform is configured', async () => {
      setPlatformsHandler([{ id: 'slack', name: 'Slack', isConfigured: false }]);

      const { getByTestId } = renderWizard({ initialStep: 'ready' });
      await expectSteps(getByTestId, 'ready>identity>instructions>library>end');
    });

    it('includes integrations when a configured Slack platform exists', async () => {
      setPlatformsHandler([
        { id: 'slack', name: 'Slack', isConfigured: true },
        { id: 'discord', name: 'Discord', isConfigured: false },
      ]);

      const { getByTestId } = renderWizard({ initialStep: 'ready' });
      await expectSteps(getByTestId, 'ready>identity>instructions>library>integrations>end');
    });

    it('excludes integrations when only a non-Slack platform is configured', async () => {
      setPlatformsHandler([
        { id: 'slack', name: 'Slack', isConfigured: false },
        { id: 'discord', name: 'Discord', isConfigured: true },
      ]);

      const { getByTestId } = renderWizard({ initialStep: 'ready' });
      await expectSteps(getByTestId, 'ready>identity>instructions>library>end');
    });
  });

  describe('when the requested initialStep is gated out', () => {
    it('clamps forward to the first surviving step', async () => {
      setFeatures({ model: false });

      const { getByTestId } = renderWizard({ initialStep: 'model' });
      await expectSteps(getByTestId, 'instructions>end');

      expect(getByTestId('step').textContent).toBe('instructions');
    });
  });

  describe('when useWizard is called outside the provider', () => {
    it('returns a safe end-step default', () => {
      const { getByTestId } = render(<Probe />);
      expect(getByTestId('step').textContent).toBe('end');
      expect(getByTestId('steps').textContent).toBe('');
      expect(getByTestId('is-last').textContent).toBe('no');
    });
  });

  describe('isLast', () => {
    it('is false at the default end step', async () => {
      const { getByTestId } = renderWizard();
      await expectSteps(getByTestId, 'instructions>end');

      expect(getByTestId('step').textContent).toBe('end');
      expect(getByTestId('is-last').textContent).toBe('no');
    });

    it('is true only on the last user-facing step when starting from ready', async () => {
      const { getByTestId } = renderWizard({ initialStep: 'ready' });
      await expectSteps(getByTestId, 'ready>identity>instructions>library>end');

      expect(getByTestId('step').textContent).toBe('ready');
      expect(getByTestId('is-last').textContent).toBe('no');

      fireEvent.click(getByTestId('next'));
      expect(getByTestId('step').textContent).toBe('identity');
      expect(getByTestId('is-last').textContent).toBe('no');

      fireEvent.click(getByTestId('next'));
      expect(getByTestId('step').textContent).toBe('instructions');
      expect(getByTestId('is-last').textContent).toBe('no');

      fireEvent.click(getByTestId('next'));
      expect(getByTestId('step').textContent).toBe('library');
      expect(getByTestId('is-last').textContent).toBe('yes');

      fireEvent.click(getByTestId('next'));
      expect(getByTestId('step').textContent).toBe('end');
      expect(getByTestId('is-last').textContent).toBe('no');
    });

    it('is false on intermediate steps and true only on the final user-facing one', async () => {
      setFeatures({ model: true, tools: true });

      const { getByTestId } = renderWizard({ initialStep: 'ready' });
      await expectSteps(getByTestId, 'ready>identity>model>tools>instructions>library>end');

      const order: { step: WizardStep; isLast: 'yes' | 'no' }[] = [
        { step: 'ready', isLast: 'no' },
        { step: 'identity', isLast: 'no' },
        { step: 'model', isLast: 'no' },
        { step: 'tools', isLast: 'no' },
        { step: 'instructions', isLast: 'no' },
        { step: 'library', isLast: 'yes' },
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
