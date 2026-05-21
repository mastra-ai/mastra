// @vitest-environment jsdom
import type { BuilderModelPolicy } from '@mastra/client-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { INACTIVE_MODEL_POLICY } from '../context/model-policy-context';
import { ModelPolicyProvider } from '../context/model-policy-provider';
import { useModelPolicy } from '../hooks/use-model-policy';

const getModelPolicy = vi.fn<(args: { surface: 'builder' | 'editor' }) => Promise<BuilderModelPolicy>>();

vi.mock('@mastra/react', () => ({
  useMastraClient: () => ({
    getModelPolicy: (args: { surface: 'builder' | 'editor' }) => getModelPolicy(args),
  }),
}));

const Probe = () => {
  const policy = useModelPolicy();
  return <div data-testid="probe">{JSON.stringify(policy)}</div>;
};

const renderWithClient = (ui: React.ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

afterEach(() => {
  cleanup();
  getModelPolicy.mockReset();
});

describe('ModelPolicyProvider / useModelPolicy', () => {
  it('returns INACTIVE_MODEL_POLICY when no provider is mounted', () => {
    renderWithClient(<Probe />);
    expect(screen.getByTestId('probe').textContent).toBe(JSON.stringify(INACTIVE_MODEL_POLICY));
    expect(getModelPolicy).not.toHaveBeenCalled();
  });

  it('fetches the builder-surface policy and exposes it through context', async () => {
    const builderPolicy: BuilderModelPolicy = {
      active: true,
      pickerVisible: true,
      allowed: [{ provider: 'openai', modelId: 'gpt-5-mini' }],
      default: { provider: 'openai', modelId: 'gpt-5-mini' },
    };
    getModelPolicy.mockResolvedValue(builderPolicy);

    renderWithClient(
      <ModelPolicyProvider surface="builder">
        <Probe />
      </ModelPolicyProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('probe').textContent).toBe(JSON.stringify(builderPolicy));
    });
    expect(getModelPolicy).toHaveBeenCalledWith({ surface: 'builder' });
  });

  it('passes surface=editor through to the client and returns the resolved policy', async () => {
    getModelPolicy.mockResolvedValue({ active: false });

    renderWithClient(
      <ModelPolicyProvider surface="editor">
        <Probe />
      </ModelPolicyProvider>,
    );

    await waitFor(() => {
      expect(getModelPolicy).toHaveBeenCalledWith({ surface: 'editor' });
    });
    expect(screen.getByTestId('probe').textContent).toBe(JSON.stringify({ active: false }));
  });

  it('defaults to INACTIVE_MODEL_POLICY while the fetch is in flight', () => {
    getModelPolicy.mockReturnValue(new Promise(() => {}));

    renderWithClient(
      <ModelPolicyProvider surface="builder">
        <Probe />
      </ModelPolicyProvider>,
    );

    // No await: the first render should already show the inactive default.
    expect(screen.getByTestId('probe').textContent).toBe(JSON.stringify(INACTIVE_MODEL_POLICY));
  });
});
