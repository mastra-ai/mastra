// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { cleanup, render } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentColorProvider } from '../../../../contexts/agent-color-context';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import { AgentProfileAvatar } from '../agent-profile-avatar';

const builderFeatures = {
  tools: true,
  memory: true,
  workflows: true,
  agents: true,
  skills: true,
  avatarUpload: true,
  model: true,
  favorites: true,
  browser: true,
};

vi.mock('@/domains/agent-builder/hooks/use-builder-agent-features', () => ({
  useBuilderAgentFeatures: () => builderFeatures,
}));

const Wrapper = ({ children }: { children: React.ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: 'My agent',
      description: '',
      instructions: '',
      tools: {},
      skills: {},
    } as AgentBuilderEditFormValues,
  });
  return (
    <TooltipProvider>
      <FormProvider {...methods}>
        <AgentColorProvider agentId="agent_test">{children}</AgentColorProvider>
      </FormProvider>
    </TooltipProvider>
  );
};

describe('AgentProfileAvatar', () => {
  beforeEach(() => {
    builderFeatures.avatarUpload = true;
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the upload trigger when editable and avatarUpload feature is enabled', () => {
    const { getByTestId, queryByTestId } = render(
      <Wrapper>
        <AgentProfileAvatar />
      </Wrapper>,
    );

    expect(getByTestId('agent-configure-avatar-trigger')).not.toBeNull();
    expect(queryByTestId('agent-configure-avatar-display')).toBeNull();
  });

  it('hides the upload trigger when the avatarUpload feature is disabled', () => {
    builderFeatures.avatarUpload = false;
    const { getByTestId, queryByTestId } = render(
      <Wrapper>
        <AgentProfileAvatar />
      </Wrapper>,
    );

    expect(queryByTestId('agent-configure-avatar-trigger')).toBeNull();
    expect(getByTestId('agent-configure-avatar-display')).not.toBeNull();
  });
});
