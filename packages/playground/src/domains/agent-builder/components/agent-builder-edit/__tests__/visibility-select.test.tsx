// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import { VisibilitySelect } from '../visibility-select';

interface FormHarnessProps {
  defaultVisibility?: AgentBuilderEditFormValues['visibility'];
  children: ReactNode;
}

const FormHarness = ({ defaultVisibility = 'private', children }: FormHarnessProps) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: { name: '', instructions: '', visibility: defaultVisibility },
  });
  const value = methods.watch('visibility');
  return (
    <FormProvider {...methods}>
      {children}
      <span data-testid="form-visibility">{value}</span>
    </FormProvider>
  );
};

describe('VisibilitySelect', () => {
  beforeAll(() => {
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = () => {};
    }
    if (!Element.prototype.hasPointerCapture) {
      Element.prototype.hasPointerCapture = () => false;
    }
    if (!Element.prototype.releasePointerCapture) {
      Element.prototype.releasePointerCapture = () => {};
    }
  });

  afterEach(() => {
    cleanup();
  });

  it('reflects the form default of Private', () => {
    render(
      <FormHarness>
        <VisibilitySelect />
      </FormHarness>,
    );

    const trigger = screen.getByTestId('agent-builder-visibility-trigger');
    expect(trigger.textContent).toContain('Private');
    expect(screen.getByTestId('form-visibility').textContent).toBe('private');
  });

  it('writes Public back into the form when selected', async () => {
    render(
      <FormHarness>
        <VisibilitySelect />
      </FormHarness>,
    );

    const trigger = screen.getByTestId('agent-builder-visibility-trigger');
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'Enter' });

    const publicOption = await screen.findByRole('option', { name: 'Public' });
    fireEvent.click(publicOption);

    expect(screen.getByTestId('agent-builder-visibility-trigger').textContent).toContain('Public');
    expect(screen.getByTestId('form-visibility').textContent).toBe('public');
  });
});
