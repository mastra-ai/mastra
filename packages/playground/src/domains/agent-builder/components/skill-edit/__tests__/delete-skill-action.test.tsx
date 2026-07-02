import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import type * as ReactRouter from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteSkillMenuItem, DeleteSkillPanelButton } from '../delete-skill-action';
import { server } from '@/test/msw-server';

const navigate = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof ReactRouter>('react-router');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});
vi.mock('@mastra/playground-ui/store/playground-store', () => ({
  usePlaygroundStore: () => ({ requestContext: undefined }),
}));

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const { toast } = await import('@mastra/playground-ui/utils/toast');

const BASE_URL = 'http://localhost:4111';

const installRadixDomShims = () => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class StubResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as unknown as { ResizeObserver: typeof StubResizeObserver }).ResizeObserver = StubResizeObserver;
  }
};

const Wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>{children}</TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

describe('DeleteSkillPanelButton', () => {
  beforeAll(() => {
    installRadixDomShims();
  });

  beforeEach(() => {
    navigate.mockReset();
    (toast.success as ReturnType<typeof vi.fn>).mockReset();
    (toast.error as ReturnType<typeof vi.fn>).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('opens the confirmation dialog with the skill name when clicked', () => {
    render(
      <Wrapper>
        <DeleteSkillPanelButton skillId="skill-123" skillName="My Skill" />
      </Wrapper>,
    );

    const button = screen.getByTestId('skill-builder-delete-skill');
    expect(button.textContent).toContain('Delete skill');

    fireEvent.click(button);

    const dialog = screen.getByTestId('skill-builder-delete-skill-dialog');
    expect(dialog.textContent).toContain('My Skill');
  });

  it('does not fire a DELETE request when the user cancels', async () => {
    let deleteCalled = false;
    server.use(
      http.delete(`${BASE_URL}/api/stored/skills/skill-123`, () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );

    render(
      <Wrapper>
        <DeleteSkillPanelButton skillId="skill-123" skillName="My Skill" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('skill-builder-delete-skill'));
    fireEvent.click(screen.getByTestId('skill-builder-delete-skill-cancel'));

    await waitFor(() => {
      expect(screen.queryByTestId('skill-builder-delete-skill-dialog')).toBeNull();
    });
    expect(deleteCalled).toBe(false);
  });

  it('calls DELETE, toasts success, and navigates after the request resolves', async () => {
    let deleteCalled = false;
    server.use(
      http.delete(`${BASE_URL}/api/stored/skills/skill-123`, () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );

    render(
      <Wrapper>
        <DeleteSkillPanelButton skillId="skill-123" skillName="My Skill" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('skill-builder-delete-skill'));
    fireEvent.click(screen.getByTestId('skill-builder-delete-skill-confirm'));

    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Skill deleted');
    });
    expect(navigate).toHaveBeenCalledWith('/agent-builder/skills', { viewTransition: true });
  });

  it('toasts an error and keeps the dialog open when the DELETE fails', async () => {
    server.use(
      http.delete(`${BASE_URL}/api/stored/skills/skill-123`, () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    );

    render(
      <Wrapper>
        <DeleteSkillPanelButton skillId="skill-123" skillName="My Skill" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('skill-builder-delete-skill'));
    fireEvent.click(screen.getByTestId('skill-builder-delete-skill-confirm'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByTestId('skill-builder-delete-skill-dialog')).toBeTruthy();
  });
});

describe('DeleteSkillMenuItem', () => {
  beforeAll(() => {
    installRadixDomShims();
  });

  beforeEach(() => {
    navigate.mockReset();
    (toast.success as ReturnType<typeof vi.fn>).mockReset();
    (toast.error as ReturnType<typeof vi.fn>).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('opens the confirmation dialog from inside a dropdown menu without auto-closing it', async () => {
    render(
      <Wrapper>
        <DropdownMenu open>
          <DropdownMenu.Trigger data-testid="dropdown-trigger">More</DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DeleteSkillMenuItem skillId="skill-123" skillName="My Skill" />
          </DropdownMenu.Content>
        </DropdownMenu>
      </Wrapper>,
    );

    const item = await screen.findByTestId('skill-builder-mobile-menu-delete');
    fireEvent.click(item);

    const dialog = await screen.findByTestId('skill-builder-delete-skill-dialog');
    expect(dialog.textContent).toContain('My Skill');
  });
});
