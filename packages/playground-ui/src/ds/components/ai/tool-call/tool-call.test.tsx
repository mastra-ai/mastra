// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Search } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ToolCall,
  ToolCallContent,
  ToolCallDetail,
  ToolCallDisclosure,
  ToolCallHeader,
  ToolCallIcon,
  ToolCallLabel,
  ToolCallPresentedHeader,
  ToolCallSpacer,
  ToolCallSummary,
  ToolCallTrailing,
  ToolCallTrigger,
} from './tool-call';
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
  <ToolCall
    aria-label="Tool: execute_command"
    className="root-class"
    open={open}
    defaultOpen={defaultOpen}
    onOpenChange={onOpenChange}
    status={status}
  >
    <ToolCallTrigger className="trigger-class" data-testid="trigger">
      <ToolCallHeader data-testid="header">
        <ToolCallIcon data-testid="icon">$</ToolCallIcon>
        <ToolCallLabel>Ran command</ToolCallLabel>
        <ToolCallDetail>pnpm test</ToolCallDetail>
        <ToolCallSummary>2 files</ToolCallSummary>
        <ToolCallSpacer />
        <ToolCallTrailing>Done</ToolCallTrailing>
        <ToolCallDisclosure data-testid="disclosure" />
      </ToolCallHeader>
    </ToolCallTrigger>
    <ToolCallContent className="body-class" data-testid="content">
      Command output
    </ToolCallContent>
  </ToolCall>
);

afterEach(cleanup);

describe('ToolCall', () => {
  it('renders composed custom content and forwards semantic props', () => {
    render(<Example defaultOpen />);

    const root = screen.getByRole('group', { name: 'Tool: execute_command' });
    expect(root.className).toContain('max-w-full');
    expect(root.className).toContain('root-class');
    expect(root.getAttribute('aria-busy')).toBe('false');
    expect(root.getAttribute('aria-invalid')).toBeNull();
    expect(root.getAttribute('aria-describedby')).toBeNull();
    expect(root.getAttribute('data-status')).toBe('idle');
    expect(screen.queryByText(/Tool call (running|failed)/)).toBeNull();

    const trigger = screen.getByTestId('trigger');
    expect(trigger.className).toContain('group/row');
    expect(trigger.className).toContain('trigger-class');
    expect(screen.getByTestId('header').className).toContain('items-center');
    expect(screen.getByTestId('icon').className).toContain('size-4');
    expect(screen.getByTestId('icon').textContent).toBe('$');
    expect(screen.getByText('Ran command').className).toContain('truncate');
    expect(screen.getByText('pnpm test').className).toContain('text-icon3 min-w-0 truncate');
    expect(screen.getByText('pnpm test').className).toContain('font-mono');
    expect(screen.getByText('2 files').className).toContain('items-center');
    expect(screen.getByText('Done').className).toContain('shrink-0');
    expect(screen.getByTestId('disclosure').firstElementChild?.className).toContain(
      'group-focus-visible/row:opacity-100',
    );

    const content = document.querySelector<HTMLDivElement>('.body-class');
    expect(content?.className).toContain('before:bg-border1');
    expect(content?.textContent).toBe('Command output');
  });

  it('is collapsed by default and exposes disclosure state', () => {
    render(<Example />);

    const trigger = screen.getByRole('button');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Command output')).toBeNull();
    expect(screen.getByTestId('disclosure').firstElementChild?.className).not.toContain('rotate-90');
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
    expect(screen.getByText('Tool call running').className).toContain('sr-only');
    expect(screen.getByText('Ran command').parentElement?.className).toContain('shimmer-text');
  });

  it('exposes failure state accessibly', () => {
    render(<Example status="error" />);

    const root = screen.getByRole('group', { name: 'Tool: execute_command' });
    expect(root.getAttribute('aria-invalid')).toBe('true');
    expect(root.getAttribute('data-status')).toBe('error');
    expect(screen.getByText('Tool call failed').className).toContain('sr-only');
  });

  it('renders optional spacer rules and custom disclosure content', () => {
    render(
      <ToolCall aria-label="Tool: custom">
        <ToolCallTrigger>
          <ToolCallSpacer rule data-testid="spacer" />
          <ToolCallDisclosure data-testid="custom-disclosure">Toggle</ToolCallDisclosure>
        </ToolCallTrigger>
      </ToolCall>,
    );

    expect(screen.getByRole('group', { name: 'Tool: custom' }).getAttribute('data-status')).toBe('idle');
    expect(screen.getByTestId('spacer').className).toContain('min-w-2 flex-1');
    expect(screen.getByTestId('spacer').className).toContain('bg-border1');
    expect(screen.getByTestId('custom-disclosure').className).toContain('justify-center');
    expect(screen.getByText('Toggle').className).toContain(
      'text-icon3 flex shrink-0 items-center opacity-0 transition duration-150',
    );
    expect(screen.getByText('Toggle').textContent).toBe('Toggle');
  });

  it('rejects compounds rendered outside the root', () => {
    expect(() => render(<ToolCallDisclosure />)).toThrow('ToolCall compounds must be rendered within ToolCall');
  });
});

describe('ToolCallPresentedHeader', () => {
  const Presented = ({ status = 'idle', detail }: { status?: 'idle' | 'running' | 'error'; detail?: string }) => (
    <ToolCall status={status}>
      <ToolCallTrigger>
        <ToolCallPresentedHeader icon={Search} label="Searched files" detail={detail} />
      </ToolCallTrigger>
      <ToolCallContent>body</ToolCallContent>
    </ToolCall>
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
});

describe('ToolCallDetail arrival', () => {
  it('fades in a detail that lands after the reader was watching', () => {
    const { rerender } = render(
      <ArrivalScope>
        <ToolCall>
          <ToolCallHeader>
            <ToolCallLabel>Ran command</ToolCallLabel>
          </ToolCallHeader>
        </ToolCall>
      </ArrivalScope>,
    );

    rerender(
      <ArrivalScope>
        <ToolCall>
          <ToolCallHeader>
            <ToolCallLabel>Ran command</ToolCallLabel>
            <ToolCallDetail>pnpm test</ToolCallDetail>
          </ToolCallHeader>
        </ToolCall>
      </ArrivalScope>,
    );

    expect(screen.getByText('pnpm test').classList.contains(ARRIVING_CLASS)).toBe(true);
  });
});
