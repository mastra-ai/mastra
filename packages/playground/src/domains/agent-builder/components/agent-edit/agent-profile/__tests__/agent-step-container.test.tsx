// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentColorProvider } from '../../../../contexts/agent-color-context';
import { StreamRunningContext } from '../../../../contexts/stream-chat-context';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import { AgentStepContainer } from '../agent-step-container';

interface HarnessProps {
  agentId?: string;
  isRunning: boolean;
  children: ReactNode;
}

const Harness = ({ agentId = 'agent_test', isRunning, children }: HarnessProps) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: { name: '' } as AgentBuilderEditFormValues,
  });
  return (
    <StreamRunningContext.Provider value={{ isRunning }}>
      <FormProvider {...methods}>
        <AgentColorProvider agentId={agentId}>{children}</AgentColorProvider>
      </FormProvider>
    </StreamRunningContext.Provider>
  );
};

describe('AgentStepContainer', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the default neutral gradient layer and the agent-color layer with a linear-gradient when an agentId is provided', () => {
    const { getByTestId } = render(
      <Harness isRunning={false}>
        <AgentStepContainer cta={null}>
          <div>body</div>
        </AgentStepContainer>
      </Harness>,
    );

    const defaultLayer = getByTestId('agent-step-container-gradient-default');
    expect(defaultLayer.classList.contains('step-container-gradient')).toBe(true);
    expect(defaultLayer.classList.contains('step-container-gradient--default')).toBe(true);

    const agentLayer = getByTestId('agent-step-container-gradient');
    expect(agentLayer.getAttribute('aria-hidden')).toBe('true');
    expect(agentLayer.style.opacity).toBe('1');
    expect(agentLayer.style.backgroundImage).toMatch(/^linear-gradient\(/);
  });

  it('hides the agent-color layer when no agentId is provided', () => {
    const { getByTestId } = render(
      <Harness isRunning={false} agentId="">
        <AgentStepContainer cta={null}>
          <div>body</div>
        </AgentStepContainer>
      </Harness>,
    );

    const agentLayer = getByTestId('agent-step-container-gradient');
    expect(agentLayer.style.opacity).toBe('0');
    expect(agentLayer.style.backgroundImage).toBe('');
  });

  it('does not apply the streaming animation class to either layer when isRunning is false', () => {
    const { getByTestId } = render(
      <Harness isRunning={false}>
        <AgentStepContainer cta={null}>
          <div>body</div>
        </AgentStepContainer>
      </Harness>,
    );

    expect(getByTestId('agent-step-container-gradient-default').classList.contains('step-container-gradient--streaming')).toBe(false);
    expect(getByTestId('agent-step-container-gradient').classList.contains('step-container-gradient--streaming')).toBe(false);
  });

  it('applies the streaming animation class to both layers when isRunning is true', () => {
    const { getByTestId } = render(
      <Harness isRunning={true}>
        <AgentStepContainer cta={null}>
          <div>body</div>
        </AgentStepContainer>
      </Harness>,
    );

    expect(getByTestId('agent-step-container-gradient-default').classList.contains('step-container-gradient--streaming')).toBe(true);
    expect(getByTestId('agent-step-container-gradient').classList.contains('step-container-gradient--streaming')).toBe(true);
  });
});
