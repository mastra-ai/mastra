// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Search } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Activity,
  ActivityContent,
  ActivityDetail,
  ActivityDisclosure,
  ActivityHeader,
  ActivityIcon,
  ActivityLabel,
  ActivityHeadline,
  ActivityItem,
  ActivitySpacer,
  ActivitySummary,
  ActivityTrailing,
  ActivityTrigger,
} from './activity';
import { ArrivalScope } from '@/ds/components/Arrival';
import { ARRIVING_CLASS } from '@/ds/tokens';

const Example = ({
  open,
  defaultOpen,
  onOpenChange,
  status = 'idle',
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  status?: 'idle' | 'running' | 'error';
}) => (
  <Activity
    aria-label="Tool: execute_command"
    className="root-class"
    open={open}
    defaultOpen={defaultOpen}
    onOpenChange={onOpenChange}
    status={status}
  >
    <ActivityTrigger className="trigger-class" data-testid="trigger">
      <ActivityHeader data-testid="header">
        <ActivityIcon data-testid="icon">$</ActivityIcon>
        <ActivityLabel>Ran command</ActivityLabel>
        <ActivityDetail>pnpm test</ActivityDetail>
        <ActivitySummary>2 files</ActivitySummary>
        <ActivitySpacer />
        <ActivityTrailing>Done</ActivityTrailing>
        <ActivityDisclosure data-testid="disclosure" />
      </ActivityHeader>
    </ActivityTrigger>
    <ActivityContent className="body-class" data-testid="content">
      Command output
    </ActivityContent>
  </Activity>
);

afterEach(cleanup);

describe('Activity', () => {
  it('renders composed custom content and forwards semantic props', () => {
    render(<Example defaultOpen />);

    const root = screen.getByRole('group', { name: 'Tool: execute_command' });
    expect(root.className).toContain('max-w-full');
    expect(root.className).toContain('root-class');
    expect(root.getAttribute('aria-busy')).toBe('false');
    expect(root.getAttribute('aria-invalid')).toBeNull();
    expect(root.getAttribute('aria-describedby')).toBeNull();
    expect(root.getAttribute('data-status')).toBe('idle');
    expect(screen.queryByText(/Running|Failed/)).toBeNull();

    const trigger = screen.getByTestId('trigger');
    expect(trigger.className).toContain('group/row');
    expect(trigger.className).toContain('trigger-class');
    expect(screen.getByTestId('header').className).toContain('items-center');
    expect(screen.getByTestId('icon').className).toContain('size-4');
    expect(screen.getByTestId('icon').textContent).toBe('$');
    expect(screen.getByText('Ran command').className).toContain('truncate');
    expect(screen.getByText('pnpm test').classList).toContain('truncate');
    expect(screen.getByText('pnpm test').classList).toContain('font-mono');
    expect(screen.getByText('2 files').className).toContain('items-center');
    expect(screen.getByText('Done').className).toContain('shrink-0');

    const content = document.querySelector<HTMLDivElement>('.body-class');
    expect(content?.textContent).toBe('Command output');
  });

  it('is collapsed by default and exposes disclosure state', () => {
    render(<Example />);

    const trigger = screen.getByRole('button');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Command output')).toBeNull();
    expect(screen.getByTestId('disclosure').firstElementChild?.className).not.toContain('rotate-90');
    expect(screen.getByTestId('disclosure').firstElementChild?.className).toContain('text-muted-foreground/60');
  });

  it('manages uncontrolled expansion', () => {
    render(<Example />);

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Command output')).toBeTruthy();
    expect(screen.getByTestId('disclosure').firstElementChild?.className).toContain('rotate-90');
  });

  it('uses a focusable native button for keyboard disclosure', () => {
    render(<Example />);

    const trigger = screen.getByRole('button');
    trigger.focus();

    expect(trigger.tagName).toBe('BUTTON');
    expect(document.activeElement).toBe(trigger);
    expect(trigger.className).toContain('focus-visible');
  });

  it('reports controlled expansion without changing its own state', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<Example open={false} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false');

    rerender(<Example open onOpenChange={onOpenChange} />);
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Command output')).toBeTruthy();

    rerender(<Example />);
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Command output')).toBeNull();
  });

  it('exposes running state accessibly and renders a shimmering header', () => {
    render(<Example status="running" />);

    const root = screen.getByRole('group', { name: 'Tool: execute_command' });
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(root.getAttribute('data-status')).toBe('running');
    expect(root.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText('Running').className).toContain('sr-only');
    expect(screen.getByText('Ran command').parentElement?.className).toContain('shimmer-text');
  });

  it('exposes failure state accessibly', () => {
    render(<Example status="error" />);

    const root = screen.getByRole('group', { name: 'Tool: execute_command' });
    expect(root.getAttribute('aria-invalid')).toBe('true');
    expect(root.getAttribute('data-status')).toBe('error');
    expect(screen.getByText('Failed').className).toContain('sr-only');
  });

  it('renders optional spacer rules and custom disclosure content', () => {
    render(
      <Activity aria-label="Tool: custom">
        <ActivityTrigger>
          <ActivitySpacer rule data-testid="spacer" />
          <ActivityDisclosure data-testid="custom-disclosure">Toggle</ActivityDisclosure>
        </ActivityTrigger>
      </Activity>,
    );

    expect(screen.getByRole('group', { name: 'Tool: custom' }).getAttribute('data-status')).toBe('idle');
    expect(screen.getByTestId('spacer').className).toContain('min-w-2 flex-1');
    expect(screen.getByTestId('custom-disclosure').className).toContain('justify-center');
    const toggleClasses = screen.getByText('Toggle').className.split(' ');
    expect(toggleClasses).toEqual(
      expect.arrayContaining(['flex', 'shrink-0', 'items-center', 'transition', 'duration-150']),
    );
    expect(screen.getByText('Toggle').textContent).toBe('Toggle');
  });

  it('rejects compounds rendered outside the root', () => {
    expect(() => render(<ActivityDisclosure />)).toThrow('Activity compounds must be rendered within Activity');
  });
});

describe('ActivityHeadline', () => {
  const Presented = ({ status = 'idle', detail }: { status?: 'idle' | 'running' | 'error'; detail?: string }) => (
    <Activity status={status}>
      <ActivityTrigger>
        <ActivityHeadline icon={<Search aria-hidden />} label="Searched files" detail={detail} />
      </ActivityTrigger>
      <ActivityContent>body</ActivityContent>
    </Activity>
  );

  it('renders the presented label with its detail', () => {
    render(<Presented detail="src/**/*.ts" />);

    expect(screen.getByText('Searched files')).toBeTruthy();
    expect(screen.getByText('src/**/*.ts')).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Failed' })).toBeNull();
  });

  it('marks a failed call', () => {
    render(<Presented status="error" />);

    expect(screen.getByRole('img', { name: 'Failed' })).toBeTruthy();
  });

  it('seats a leading slot ahead of the label', () => {
    render(
      <Activity>
        <ActivityTrigger>
          <ActivityHeadline icon={<Search aria-hidden />} label="Searched files" leading={<time>3:42:05 PM</time>} />
        </ActivityTrigger>
      </Activity>,
    );

    const leading = screen.getByText('3:42:05 PM');
    const label = screen.getByText('Searched files');
    expect(leading.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('ActivityDetail arrival', () => {
  it('fades in a detail that lands after the reader was watching', () => {
    const { rerender } = render(
      <ArrivalScope>
        <Activity>
          <ActivityHeader>
            <ActivityLabel>Ran command</ActivityLabel>
          </ActivityHeader>
        </Activity>
      </ArrivalScope>,
    );

    rerender(
      <ArrivalScope>
        <Activity>
          <ActivityHeader>
            <ActivityLabel>Ran command</ActivityLabel>
            <ActivityDetail>pnpm test</ActivityDetail>
          </ActivityHeader>
        </Activity>
      </ArrivalScope>,
    );

    expect(screen.getByText('pnpm test').classList.contains(ARRIVING_CLASS)).toBe(true);
  });
});

describe('ActivityItem', () => {
  it('folds a body behind a disclosure', () => {
    render(
      <ActivityItem icon={<Search aria-hidden />} label="Searched files" detail="src/**/*.ts" aria-label="Tool: search">
        3 matches
      </ActivityItem>,
    );

    const trigger = screen.getByRole('button', { name: /Searched files/ });
    expect(screen.queryByText('3 matches')).toBeNull();
    expect(screen.getByText('src/**/*.ts').classList).toContain('truncate');

    fireEvent.click(trigger);
    expect(screen.getByText('3 matches')).toBeTruthy();
  });

  it('stays a plain line with nothing to fold, wrapping its detail instead of clipping it', () => {
    render(
      <ActivityItem icon={<Search aria-hidden />} label="Thinking" detail="a long detail" aria-label="Thinking" />,
    );

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('a long detail').classList).toContain('break-words');
    expect(screen.getByText('a long detail').classList).not.toContain('truncate');
  });

  it('shows a body inline when folding is turned off', () => {
    render(
      <ActivityItem icon={<Search aria-hidden />} label="Skill" collapsible={false} aria-label="Skill">
        Instructions
      </ActivityItem>,
    );

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Instructions')).toBeTruthy();
  });
});
