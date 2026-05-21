// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentColorProvider } from '../../../../contexts/agent-color-context';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import { Models } from '../models';

vi.mock('@/domains/builder', () => ({
  useBuilderModelPolicy: () => ({ active: false, pickerVisible: true }),
  useBuilderFilteredProviders: (providers: unknown) => providers,
  useBuilderFilteredModels: (models: unknown) => models,
}));

vi.mock('@/domains/llm', () => ({
  cleanProviderId: (provider: string) => provider,
  ProviderLogo: ({ providerId }: { providerId: string }) => <span data-testid={`provider-logo-${providerId}`} />,
  useAllModels: () => [],
  useLLMProviders: () => ({
    isLoading: true,
    data: undefined,
  }),
}));

const FormHarness = ({ children }: { children: ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: '',
      model: { provider: '', name: '' },
    } as AgentBuilderEditFormValues,
  });
  return (
    <FormProvider {...methods}>
      <AgentColorProvider>{children}</AgentColorProvider>
    </FormProvider>
  );
};

describe('Models loading state', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a structural skeleton that mirrors the loaded grid template', () => {
    const { getByTestId, queryByTestId } = render(
      <FormHarness>
        <Models />
      </FormHarness>,
    );

    const skeleton = getByTestId('model-card-picker-loading');
    expect(skeleton).toBeTruthy();
    // The loaded picker testid must NOT be present while data is loading.
    expect(queryByTestId('model-card-picker')).toBeNull();
    // Lock in the structural grid contract so a regression to the old
    // `<Skeleton className="h-40 w-full" />` block can't slip back in.
    expect(skeleton.className).toContain('grid-rows-[auto_auto_minmax(0,1fr)]');
  });
});
