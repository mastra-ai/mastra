// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { cleanup, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import { ModelDetail } from '../model-detail';

vi.mock('@/domains/builder', () => ({
  useBuilderModelPolicy: () => ({ active: false }),
}));

const FormWrapper = ({ children }: { children: React.ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: '',
      instructions: '',
      model: { provider: 'openai', name: 'gpt-4o' },
    },
  });

  return (
    <TooltipProvider>
      <FormProvider {...methods}>{children}</FormProvider>
    </TooltipProvider>
  );
};

const renderModelDetail = (editable = true) =>
  render(
    <FormWrapper>
      <ModelDetail onClose={() => {}} editable={editable} />
    </FormWrapper>,
  );

describe('ModelDetail readonly mode', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the configured model without editable picker controls when readonly', () => {
    renderModelDetail(false);

    expect(screen.getByTestId('model-detail-readonly-chip').textContent).toContain('openai/gpt-4o');
    expect(screen.queryByTestId('model-detail-picker')).toBeNull();
  });
});
