// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { SkillBuilderMobileMenu } from '../skill-builder-mobile-menu';
import type { SkillEditFormValues } from '@/domains/agent-builder/hooks/use-autosave-skill';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const SKILL_ID = 'skill-mobile';

interface FormHarnessProps {
  defaultVisibility?: SkillEditFormValues['visibility'];
  children: ReactNode;
}

const FormHarness = ({ defaultVisibility = 'private', children }: FormHarnessProps) => {
  const methods = useForm<SkillEditFormValues>({
    defaultValues: {
      name: '',
      description: '',
      instructions: '',
      visibility: defaultVisibility,
      workspaceId: undefined,
    },
  });
  const value = methods.watch('visibility');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TooltipProvider>
            <FormProvider {...methods}>
              {children}
              <span data-testid="form-visibility">{value}</span>
            </FormProvider>
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const installRadixDomShims = () => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class StubResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as unknown as { ResizeObserver: typeof StubResizeObserver }).ResizeObserver = StubResizeObserver;
  }
};

const openDropdown = async () => {
  const trigger = await screen.findByTestId('skill-builder-mobile-menu-trigger');
  fireEvent.click(trigger);
  await screen.findByRole('menu');
};

describe('SkillBuilderMobileMenu', () => {
  beforeAll(() => {
    installRadixDomShims();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when showSetVisibility is false', () => {
    render(
      <FormHarness>
        <SkillBuilderMobileMenu skillId={SKILL_ID} showSetVisibility={false} />
      </FormHarness>,
    );

    expect(screen.queryByTestId('skill-builder-mobile-menu')).toBeNull();
    expect(screen.queryByTestId('skill-builder-mobile-menu-trigger')).toBeNull();
  });

  it('shows Add to library item when private and opens the confirm dialog on click', async () => {
    render(
      <FormHarness>
        <SkillBuilderMobileMenu skillId={SKILL_ID} showSetVisibility />
      </FormHarness>,
    );

    await openDropdown();

    const item = await screen.findByTestId('skill-builder-mobile-menu-visibility-add');
    expect(item.textContent).toContain('Add to library');

    fireEvent.click(item);

    const dialog = await screen.findByTestId('skill-builder-visibility-confirm-dialog');
    expect(dialog.textContent).toContain('Add this skill to your library?');
  });

  it('shows Remove from library item when public', async () => {
    render(
      <FormHarness defaultVisibility="public">
        <SkillBuilderMobileMenu skillId={SKILL_ID} showSetVisibility />
      </FormHarness>,
    );

    await openDropdown();

    const item = await screen.findByTestId('skill-builder-mobile-menu-visibility-remove');
    expect(item.textContent).toContain('Remove from library');
    expect(screen.queryByTestId('skill-builder-mobile-menu-visibility-add')).toBeNull();
  });

  it('confirming dispatches PATCH with the new visibility and updates the form value', async () => {
    let capturedBody: any = null;
    server.use(
      http.patch(`${BASE_URL}/api/stored/skills/${SKILL_ID}`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: SKILL_ID, visibility: 'public' });
      }),
    );

    render(
      <FormHarness>
        <SkillBuilderMobileMenu skillId={SKILL_ID} showSetVisibility />
      </FormHarness>,
    );

    await openDropdown();
    fireEvent.click(await screen.findByTestId('skill-builder-mobile-menu-visibility-add'));

    await act(async () => {
      fireEvent.click(await screen.findByTestId('skill-builder-visibility-confirm-yes'));
    });

    await waitFor(() => {
      expect(capturedBody).toMatchObject({ visibility: 'public' });
    });
    await waitFor(() => {
      expect(screen.getByTestId('form-visibility').textContent).toBe('public');
    });
  });
});
