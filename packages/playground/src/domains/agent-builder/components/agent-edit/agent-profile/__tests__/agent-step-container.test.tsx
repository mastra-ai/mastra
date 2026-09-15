import { cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { StreamRunningContext } from '../../../../contexts/stream-chat-context';
import { useWizard } from '../../../../contexts/wizard-context';
import type { WizardStep } from '../../../../contexts/wizard-context';
import { AgentStepContainer } from '../agent-step-container';
import { flush, registerStepHandlers, renderStep } from './test-utils';

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

const advanceTo = (getByTestId: (id: string) => HTMLElement, target: WizardStep) => {
  while (getByTestId('current-step').textContent !== target) {
    fireEvent.click(getByTestId('probe-next'));
  }
};

// Providing a real context value is not module mocking: the stream comes from a
// live builder-agent run, which MSW can't model in this unit scope.
const renderContainer = ({ isRunning = false }: { isRunning?: boolean } = {}) =>
  renderStep(
    <StreamRunningContext.Provider value={{ isRunning }}>
      <StepProbe />
      <AgentStepContainer cta={<button type="button">Continue</button>}>
        <div>body</div>
      </AgentStepContainer>
    </StreamRunningContext.Provider>,
  );

describe('AgentStepContainer back button', () => {
  beforeEach(() => {
    registerStepHandlers();
  });

  afterEach(() => {
    cleanup();
  });

  it('hides the back button on the first step', async () => {
    const { queryByTestId, getByTestId } = renderContainer();
    await flush();

    expect(getByTestId('current-step').textContent).toBe('ready');
    expect(queryByTestId('agent-builder-step-back')).toBeNull();
  });

  it('shows the back button on a later step and steps backward when clicked', async () => {
    const { getByTestId } = renderContainer();
    await flush();

    advanceTo(getByTestId, 'identity');
    expect(getByTestId('current-step').textContent).toBe('identity');
    const back = getByTestId('agent-builder-step-back');
    fireEvent.click(back);
    expect(getByTestId('current-step').textContent).toBe('ready');
  });

  it('disables the back button while streaming', async () => {
    const { getByTestId } = renderContainer({ isRunning: true });
    await flush();

    advanceTo(getByTestId, 'identity');
    expect((getByTestId('agent-builder-step-back') as HTMLButtonElement).disabled).toBe(true);
  });
});
