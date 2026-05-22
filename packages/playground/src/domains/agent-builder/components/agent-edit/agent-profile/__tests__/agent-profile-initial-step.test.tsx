// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentColorProvider } from '../../../../contexts/agent-color-context';
import { StreamRunningContext } from '../../../../contexts/stream-chat-context';
import type { AgentBuilderEditFormValues } from '../../../../schemas';

const nextMock = vi.fn();
vi.mock('@/domains/agent-builder/contexts/wizard-context', () => ({
  useWizard: () => ({ step: 'initial', next: nextMock, steps: ['initial', 'end'] }),
}));

vi.mock('@/lib/routing', () => ({
  startViewTransition: (cb: () => void) => cb(),
}));

// Import the component AFTER the mocks above so the mocked modules are used.
import { AgentProfileInitialStep } from '../agent-profile-initial-step';

interface DirtyFlags {
  name?: boolean;
  description?: boolean;
}

interface HarnessProps {
  isRunning: boolean;
  dirty?: DirtyFlags;
  children: ReactNode;
}

const DirtyPrimer = ({ dirty }: { dirty: DirtyFlags }) => {
  const { setValue } = useFormContext<AgentBuilderEditFormValues>();
  useEffect(() => {
    if (dirty.name) {
      setValue('name', 'Atlas', { shouldDirty: true });
    }
    if (dirty.description) {
      setValue('description', 'A helpful agent', { shouldDirty: true });
    }
  }, [dirty.name, dirty.description, setValue]);
  return null;
};

const Harness = ({ isRunning, dirty = {}, children }: HarnessProps) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: { name: '', description: '' } as AgentBuilderEditFormValues,
  });
  return (
    <StreamRunningContext.Provider value={{ isRunning }}>
      <FormProvider {...methods}>
        <DirtyPrimer dirty={dirty} />
        <AgentColorProvider agentId="agent_test">{children}</AgentColorProvider>
      </FormProvider>
    </StreamRunningContext.Provider>
  );
};

describe('AgentProfileInitialStep', () => {
  afterEach(() => {
    cleanup();
    nextMock.mockReset();
  });

  it('renders Continue with the fade-in utility when not streaming and both name + description are dirty', () => {
    const { getByRole } = render(
      <Harness isRunning={false} dirty={{ name: true, description: true }}>
        <AgentProfileInitialStep avatar={<span>avatar</span>} details={<span>details</span>} />
      </Harness>,
    );

    const button = getByRole('button', { name: /continue/i });
    expect(button.classList.contains('animate-in')).toBe(true);
    expect(button.classList.contains('fade-in')).toBe(true);
  });

  it('hides Continue when streaming even if name + description are dirty', () => {
    const { queryByRole } = render(
      <Harness isRunning={true} dirty={{ name: true, description: true }}>
        <AgentProfileInitialStep avatar={<span>avatar</span>} details={<span>details</span>} />
      </Harness>,
    );

    expect(queryByRole('button', { name: /continue/i })).toBeNull();
  });

  it('hides Continue when only the name is dirty', () => {
    const { queryByRole } = render(
      <Harness isRunning={false} dirty={{ name: true }}>
        <AgentProfileInitialStep avatar={<span>avatar</span>} details={<span>details</span>} />
      </Harness>,
    );

    expect(queryByRole('button', { name: /continue/i })).toBeNull();
  });

  it('hides Continue when only the description is dirty', () => {
    const { queryByRole } = render(
      <Harness isRunning={false} dirty={{ description: true }}>
        <AgentProfileInitialStep avatar={<span>avatar</span>} details={<span>details</span>} />
      </Harness>,
    );

    expect(queryByRole('button', { name: /continue/i })).toBeNull();
  });

  it('hides Continue when no fields are dirty', () => {
    const { queryByRole } = render(
      <Harness isRunning={false}>
        <AgentProfileInitialStep avatar={<span>avatar</span>} details={<span>details</span>} />
      </Harness>,
    );

    expect(queryByRole('button', { name: /continue/i })).toBeNull();
  });

  it('staggers the skeleton fade-in with delay-[100ms] / delay-[150ms] utilities when preparing', () => {
    const { getByTestId } = render(
      <Harness isRunning={false}>
        <AgentProfileInitialStep avatar={<span />} details={<span />} isPreparing />
      </Harness>,
    );

    const name = getByTestId('agent-profile-initial-step-name-skeleton');
    const description = getByTestId('agent-profile-initial-step-description-skeleton');

    expect(name.className).toMatch(/\banimate-in\b/);
    expect(name.className).toMatch(/\bfade-in\b/);
    expect(name.className).toMatch(/delay-\[100ms\]/);
    expect(name.className).toMatch(/\bfill-mode-both\b/);

    expect(description.className).toMatch(/\banimate-in\b/);
    expect(description.className).toMatch(/\bfade-in\b/);
    expect(description.className).toMatch(/delay-\[150ms\]/);
    expect(description.className).toMatch(/\bfill-mode-both\b/);
  });

  it('advances the wizard when Continue is clicked', () => {
    const { getByRole } = render(
      <Harness isRunning={false} dirty={{ name: true, description: true }}>
        <AgentProfileInitialStep avatar={<span>avatar</span>} details={<span>details</span>} />
      </Harness>,
    );

    fireEvent.click(getByRole('button', { name: /continue/i }));
    expect(nextMock).toHaveBeenCalledTimes(1);
  });
});
