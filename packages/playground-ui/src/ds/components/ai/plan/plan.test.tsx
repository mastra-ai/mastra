// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Button } from '../../Button';
import { TooltipProvider } from '../../Tooltip';
import {
  Plan,
  PlanActionGroup,
  PlanBody,
  PlanContent,
  PlanControls,
  PlanCopyButton,
  PlanExpandButton,
  PlanFile,
  PlanHeader,
  PlanHeaderActions,
  PlanIntro,
  PlanLabel,
  PlanMain,
  PlanPath,
  PlanStatus,
  PlanTitle,
} from './plan';
import { toast } from '@/lib/toast';

const renderPlan = (element: ReactNode) => render(<TooltipProvider>{element}</TooltipProvider>);

/** Spied rather than module-mocked: `@/lib/toast` is one of our own services. */
let toastSuccess: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  toastSuccess = vi.spyOn(toast, 'success').mockImplementation(() => '');
});

const mockClipboard = (writeText: ReturnType<typeof vi.fn>) => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
};

// jsdom has no layout engine, so rendered content always measures zero height.
// Stubbing `scrollHeight` simulates content that overflows (or fits) the
// collapsed card so clipping detection can be exercised.
const stubContentHeight = (height: number | (() => number)) => {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => (typeof height === 'function' ? height() : height),
  });
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'clipboard');
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
});

describe('Plan', () => {
  it('renders a composed title, filename, and markdown body', () => {
    renderPlan(
      <Plan>
        <PlanHeader>
          <PlanLabel />
        </PlanHeader>
        <PlanBody>
          <PlanIntro>
            <PlanTitle>Review migration plan</PlanTitle>
            <PlanPath>/workspace/plans/migration.md</PlanPath>
          </PlanIntro>
          <PlanMain>
            <PlanContent>{'## Steps\n\n- Move data\n- Verify output'}</PlanContent>
          </PlanMain>
        </PlanBody>
      </Plan>,
    );

    expect(screen.getByText('Review migration plan')).toBeTruthy();
    expect(screen.getByText('migration.md')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Steps' })).toBeTruthy();
    expect(screen.getByText('Move data')).toBeTruthy();
    expect(screen.queryByText('/workspace/plans/migration.md')).toBeNull();
  });

  it('copies the configured content from a composed header action', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);

    renderPlan(
      <Plan>
        <PlanHeader>
          <PlanLabel />
          <PlanHeaderActions>
            <PlanCopyButton content={'Review migration plan\n\nFile: /workspace/plans/migration.md\n\n## Steps'} />
          </PlanHeaderActions>
        </PlanHeader>
        <PlanBody>
          <PlanContent>{'## Steps'}</PlanContent>
        </PlanBody>
      </Plan>,
    );

    fireEvent.click(screen.getByRole('button', { name: /copy plan/i }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'Review migration plan\n\nFile: /workspace/plans/migration.md\n\n## Steps',
      ),
    );

    // The button says so on its own face; a toast on top would be noise.
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('preserves fixed copy behavior when unsupported button props are provided at runtime', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const overrideClick = vi.fn();
    mockClipboard(writeText);

    renderPlan(
      <Plan>
        <PlanCopyButton content="Review migration plan" {...{ onClick: overrideClick, type: 'submit' as const }} />
      </Plan>,
    );

    const copyButton = screen.getByRole('button', { name: /copy plan/i });
    expect(copyButton.getAttribute('type')).toBe('button');

    fireEvent.click(copyButton);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Review migration plan'));
    expect(overrideClick).not.toHaveBeenCalled();
  });

  it('renders the path fallback when markdown content is unavailable', () => {
    renderPlan(
      <Plan>
        <PlanBody>
          <PlanTitle>Submitted plan</PlanTitle>
          <PlanFile>/workspace/.mastra/plans/review.md</PlanFile>
        </PlanBody>
      </Plan>,
    );

    expect(screen.getByText('Submitted plan')).toBeTruthy();
    expect(screen.getByText('Plan file')).toBeTruthy();
    expect(screen.getByText('/workspace/.mastra/plans/review.md')).toBeTruthy();
  });

  it('renders composed status and action slots', () => {
    renderPlan(
      <Plan>
        <PlanHeader>
          <PlanLabel />
          <PlanHeaderActions>
            <PlanStatus variant="green">Approved</PlanStatus>
          </PlanHeaderActions>
        </PlanHeader>
        <PlanBody>
          <PlanMain>
            <PlanContent>{'Plan'}</PlanContent>
            <PlanControls>
              <PlanActionGroup className="justify-end">
                <Button aria-label="Reject plan">Reject</Button>
              </PlanActionGroup>
              <PlanExpandButton />
              <PlanActionGroup>
                <Button aria-label="Approve plan">Approve</Button>
              </PlanActionGroup>
            </PlanControls>
          </PlanMain>
        </PlanBody>
      </Plan>,
    );

    expect(screen.getByText('Approved')).toBeTruthy();
    expect(screen.getByText('Approved').classList.contains('bg-badge-green/20')).toBe(true);
    expect(screen.getByRole('button', { name: /reject plan/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /approve plan/i })).toBeTruthy();
  });

  it('gives a status no tone of its own unless one is asked for', () => {
    renderPlan(
      <Plan>
        <PlanHeader>
          <PlanHeaderActions>
            <PlanStatus>Draft</PlanStatus>
          </PlanHeaderActions>
        </PlanHeader>
        <PlanBody>
          <PlanContent>{'Plan'}</PlanContent>
        </PlanBody>
      </Plan>,
    );

    expect(screen.getByText('Draft').classList.contains('bg-neutral6/5')).toBe(true);
  });

  it('hints that an overflowing plan is clipped and clears the hint when expanded', () => {
    stubContentHeight(1000);

    renderPlan(
      <Plan>
        <PlanBody>
          <PlanMain>
            <PlanContent>{`## Steps\n\n${'step '.repeat(150)}`}</PlanContent>
            <PlanControls />
          </PlanMain>
        </PlanBody>
      </Plan>,
    );

    const clipped = document.querySelector<HTMLElement>('[data-slot="plan-content"][data-clipped]');
    expect(clipped).toBeTruthy();
    // A bare marker attribute, so `[data-clipped]` styling matches on it.
    expect(clipped?.getAttribute('data-clipped')).toBe('');
    expect(clipped?.classList.contains('mask-b-from-60%')).toBe(true);
    expect(clipped?.classList.contains('mask-b-to-100%')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /expand plan/i }));

    const expanded = document.querySelector<HTMLElement>('[data-slot="plan-content"]');
    expect(expanded?.getAttribute('data-clipped')).toBeNull();
    expect(expanded?.classList.contains('mask-b-from-60%')).toBe(false);
    expect(expanded?.classList.contains('mask-b-to-100%')).toBe(false);
  });

  it('shows no clip hint or expand control when the plan fits the collapsed card', () => {
    stubContentHeight(120);

    renderPlan(
      <Plan>
        <PlanBody>
          <PlanMain>
            <PlanContent>{'## Steps\n\n- Move data'}</PlanContent>
            <PlanControls />
          </PlanMain>
        </PlanBody>
      </Plan>,
    );

    expect(document.querySelector('[data-slot="plan-content"][data-clipped]')).toBeNull();
    expect(screen.queryByRole('button', { name: /expand plan/i })).toBeNull();
    expect(document.querySelector('[data-slot="plan-controls"]')?.classList.contains('empty:hidden')).toBe(true);
  });

  it('treats content at exactly the collapsed height as fitting', () => {
    stubContentHeight(220);

    renderPlan(
      <Plan>
        <PlanBody>
          <PlanMain>
            <PlanContent>{'## Steps\n\n- Move data'}</PlanContent>
            <PlanControls />
          </PlanMain>
        </PlanBody>
      </Plan>,
    );

    expect(document.querySelector('[data-slot="plan-content"][data-clipped]')).toBeNull();
    expect(screen.queryByRole('button', { name: /expand plan/i })).toBeNull();
  });

  it('measures against a custom collapsed height', () => {
    stubContentHeight(150);

    renderPlan(
      <Plan collapsedHeight={100}>
        <PlanBody>
          <PlanMain>
            <PlanContent>{'## Steps\n\n- Move data'}</PlanContent>
            <PlanControls />
          </PlanMain>
        </PlanBody>
      </Plan>,
    );

    expect(document.querySelector('[data-slot="plan-content"][data-clipped]')).toBeTruthy();
    expect(screen.getByRole('button', { name: /expand plan/i })).toBeTruthy();
  });

  it('remeasures when the collapsed height changes', () => {
    stubContentHeight(150);

    const { rerender } = renderPlan(
      <Plan collapsedHeight={220}>
        <PlanContent>{'## Steps\n\n- Move data'}</PlanContent>
        <PlanControls />
      </Plan>,
    );

    expect(screen.queryByRole('button', { name: 'Expand plan' })).toBeNull();

    rerender(
      <TooltipProvider>
        <Plan collapsedHeight={100}>
          <PlanContent>{'## Steps\n\n- Move data'}</PlanContent>
          <PlanControls />
        </Plan>
      </TooltipProvider>,
    );

    expect(screen.getByRole('button', { name: 'Expand plan' })).toBeTruthy();
  });

  it('observes content resizing and disconnects the observer on unmount', () => {
    let height = 120;
    let notifyResize: (() => void) | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    stubContentHeight(() => height);

    class ResizeObserverStub implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        notifyResize = () => callback([], this);
      }

      observe = observe;
      unobserve = vi.fn();
      disconnect = disconnect;
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverStub);

    const { unmount } = renderPlan(
      <Plan>
        <PlanContent>{'## Steps\n\n- Move data'}</PlanContent>
        <PlanControls />
      </Plan>,
    );

    const measuredContent = document.querySelector('[data-slot="plan-content"] > div');
    expect(observe).toHaveBeenCalledWith(measuredContent);
    expect(screen.queryByRole('button', { name: 'Expand plan' })).toBeNull();

    height = 500;
    act(() => notifyResize?.());

    expect(screen.getByRole('button', { name: 'Expand plan' })).toBeTruthy();

    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('expands from the composed expand button', () => {
    stubContentHeight(1000);

    renderPlan(
      <Plan>
        <PlanBody>
          <PlanMain>
            <PlanContent>{'## Steps\n\n- Move data'}</PlanContent>
            <PlanControls />
          </PlanMain>
        </PlanBody>
      </Plan>,
    );

    const content = document.querySelector<HTMLElement>('[data-slot="plan-content"]');
    if (!content) throw new Error('Expected plan content to render.');

    expect(content.style.maxHeight).toBe('220px');
    expect(content.classList.contains('overflow-hidden')).toBe(true);

    const expandButton = screen.getByRole('button', { name: 'Expand plan' });
    expect(expandButton.getAttribute('aria-label')).toBe('Expand plan');
    expect(expandButton.textContent).toContain('Expand plan');
    fireEvent.click(expandButton);

    const collapseButton = screen.getByRole('button', { name: 'Collapse plan' });
    expect(collapseButton.getAttribute('aria-label')).toBe('Collapse plan');
    expect(collapseButton.textContent).toContain('Collapse plan');
    expect(content.style.maxHeight).toBe('');
    expect(content.classList.contains('overflow-hidden')).toBe(false);
  });

  it('keeps the expand and collapse action on one line without shrinking', () => {
    stubContentHeight(1000);

    renderPlan(
      <Plan>
        <PlanContent>{'## Steps\n\n- Move data'}</PlanContent>
        <PlanExpandButton />
      </Plan>,
    );

    const expandButton = screen.getByRole('button', { name: /expand plan/i });
    expect(expandButton.classList.contains('shrink-0')).toBe(true);
    expect(expandButton.classList.contains('whitespace-nowrap')).toBe(true);

    fireEvent.click(expandButton);

    const collapseButton = screen.getByRole('button', { name: /collapse plan/i });
    expect(collapseButton.classList.contains('shrink-0')).toBe(true);
    expect(collapseButton.classList.contains('whitespace-nowrap')).toBe(true);
  });

  it('preserves fixed expand behavior when unsupported button props are provided at runtime', () => {
    const overrideClick = vi.fn();
    stubContentHeight(1000);

    renderPlan(
      <Plan>
        <PlanContent>{'## Steps\n\n- Move data'}</PlanContent>
        <PlanExpandButton {...{ onClick: overrideClick, type: 'submit' as const }} />
      </Plan>,
    );

    const content = document.querySelector<HTMLElement>('[data-slot="plan-content"]');
    if (!content) throw new Error('Expected plan content to render.');

    const expandButton = screen.getByRole('button', { name: /expand plan/i });
    expect(expandButton.getAttribute('data-variant')).toBe('default');
    expect(expandButton.getAttribute('type')).toBe('button');

    fireEvent.click(expandButton);

    expect(screen.getByRole('button', { name: /collapse plan/i })).toBeTruthy();
    expect(content.style.maxHeight).toBe('');
    expect(overrideClick).not.toHaveBeenCalled();
  });
});

describe('Plan pieces on their own', () => {
  it('refuses to render outside a Plan', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<PlanExpandButton />)).toThrow('Plan compound components must be rendered inside <Plan>.');

    consoleError.mockRestore();
  });

  it('labels itself Plan unless the caller says otherwise', () => {
    renderPlan(
      <Plan>
        <PlanHeader>
          <PlanLabel />
        </PlanHeader>
      </Plan>,
    );

    expect(screen.getByText('Plan')).toBeTruthy();
  });

  it('takes the label the caller gives it', () => {
    renderPlan(
      <Plan>
        <PlanHeader>
          <PlanLabel>Migration plan</PlanLabel>
        </PlanHeader>
      </Plan>,
    );

    expect(screen.getByText('Migration plan')).toBeTruthy();
    expect(screen.queryByText('Plan')).toBeNull();
  });

  it('names the plan file it came from', () => {
    renderPlan(
      <Plan>
        <PlanBody>
          <PlanFile>docs/plans/2026-06-migration.md</PlanFile>
        </PlanBody>
      </Plan>,
    );

    expect(screen.getByText('Plan file')).toBeTruthy();
    expect(screen.getByText('docs/plans/2026-06-migration.md')).toBeTruthy();
  });
});

describe('PlanPath', () => {
  const pathOf = (path: string) => {
    const { container } = renderPlan(
      <Plan>
        <PlanBody>
          <PlanPath>{path}</PlanPath>
        </PlanBody>
      </Plan>,
    );
    return container.querySelector('p');
  };

  it('shows the file name and keeps the whole path on hover', () => {
    const path = pathOf('docs/plans/2026-06-migration.md');

    expect(path?.textContent).toBe('2026-06-migration.md');
    expect(path?.getAttribute('title')).toBe('docs/plans/2026-06-migration.md');
  });

  it('reads a Windows path the same way', () => {
    expect(pathOf('docs\\plans\\migration.md')?.textContent).toBe('migration.md');
  });

  it('ignores a trailing separator', () => {
    expect(pathOf('docs/plans/')?.textContent).toBe('plans');
  });

  it('shows a bare file name as it stands', () => {
    expect(pathOf('migration.md')?.textContent).toBe('migration.md');
  });

  it('falls back to the path itself when there is nothing to take from it', () => {
    expect(pathOf('/')?.getAttribute('title')).toBe('/');
    expect(pathOf('/')?.textContent).toBe('/');
  });
});

describe('PlanControls', () => {
  const clippedPlan = (controls: ReactNode) => {
    stubContentHeight(400);
    return renderPlan(
      <Plan>
        <PlanMain>
          <PlanContent>plan body</PlanContent>
          <PlanControls>{controls}</PlanControls>
        </PlanMain>
      </Plan>,
    );
  };

  it('offers the expand control on its own when nothing else was put in it', () => {
    clippedPlan(null);

    expect(screen.getByRole('button', { name: 'Expand plan' })).toBeTruthy();
  });

  it('lays out what the caller put in it, and drops the lone expand control', () => {
    const { container } = clippedPlan(
      <>
        <PlanActionGroup>
          <Button>Apply</Button>
        </PlanActionGroup>
        <PlanExpandButton />
        <PlanActionGroup />
      </>,
    );

    expect(screen.getByRole('button', { name: 'Apply' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Expand plan' })).toBeTruthy();
    // Three columns, so the expand control stays centred between the groups.
    expect(container.querySelector('[class*="grid-cols-[1fr_auto_1fr]"]')).not.toBeNull();
  });
});

describe('PlanContent without a ResizeObserver', () => {
  it('still measures the plan once', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    stubContentHeight(400);

    renderPlan(
      <Plan>
        <PlanMain>
          <PlanContent>plan body</PlanContent>
          <PlanControls />
        </PlanMain>
      </Plan>,
    );

    expect(screen.getByRole('button', { name: 'Expand plan' })).toBeTruthy();
  });
});
