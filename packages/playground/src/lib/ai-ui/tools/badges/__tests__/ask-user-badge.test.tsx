import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AskUserBadge } from '../ask-user-badge';
import type { AskUserResult, AskUserSuspendPayload } from '../types';
import { ToolCallProvider } from '@/services/tool-call-provider';

type ProviderOverrides = {
  approveToolcall?: (toolCallId: string, resumeData?: unknown) => void;
  isRunning?: boolean;
  toolCallApprovals?: { [toolCallId: string]: { status: 'approved' | 'declined' } };
};

const renderBadge = (
  props: { toolCallId: string; suspendPayload: AskUserSuspendPayload; result: AskUserResult | undefined },
  overrides: ProviderOverrides = {},
) => {
  const approveToolcall = overrides.approveToolcall ?? vi.fn();
  const utils = render(
    <TooltipProvider>
      <ToolCallProvider
        approveToolcall={approveToolcall}
        declineToolcall={vi.fn()}
        approveToolcallGenerate={vi.fn()}
        declineToolcallGenerate={vi.fn()}
        approveNetworkToolcall={vi.fn()}
        declineNetworkToolcall={vi.fn()}
        isRunning={overrides.isRunning ?? false}
        toolCallApprovals={overrides.toolCallApprovals ?? {}}
        networkToolCallApprovals={{}}
      >
        <AskUserBadge {...props} />
      </ToolCallProvider>
    </TooltipProvider>,
  );
  return { ...utils, approveToolcall };
};

const badge = () => screen.getByTestId('ask-user-badge') as HTMLElement;

afterEach(() => cleanup());

describe('AskUserBadge', () => {
  describe('when the payload offers single-select options', () => {
    const suspendPayload: AskUserSuspendPayload = {
      question: 'Pick a fruit',
      options: [{ label: 'Apple', description: 'A red fruit' }, { label: 'Banana' }],
      selectionMode: 'single_select',
    };

    it('renders the question and the options', () => {
      renderBadge({ toolCallId: 'call-1', suspendPayload, result: undefined });

      expect(screen.getByText('Pick a fruit')).toBeTruthy();
      expect(screen.getByText('Apple')).toBeTruthy();
      expect(screen.getByText('A red fruit')).toBeTruthy();
      expect(screen.getByText('Banana')).toBeTruthy();
    });

    it('submits the chosen label immediately on click', () => {
      const { approveToolcall } = renderBadge({ toolCallId: 'call-1', suspendPayload, result: undefined });

      fireEvent.click(screen.getByText('Apple'));

      expect(approveToolcall).toHaveBeenCalledTimes(1);
      expect(approveToolcall).toHaveBeenCalledWith('call-1', 'Apple');
    });
  });

  describe('when the payload offers multi-select options', () => {
    const suspendPayload: AskUserSuspendPayload = {
      question: 'Pick toppings',
      options: [{ label: 'Cheese' }, { label: 'Olives' }],
      selectionMode: 'multi_select',
    };

    it('does not submit when toggling a selection', () => {
      const { approveToolcall } = renderBadge({ toolCallId: 'call-2', suspendPayload, result: undefined });

      fireEvent.click(screen.getByText('Cheese'));

      expect(approveToolcall).not.toHaveBeenCalled();
    });

    it('keeps the submit button disabled until something is selected', () => {
      renderBadge({ toolCallId: 'call-2', suspendPayload, result: undefined });

      expect((within(badge()).getByRole('button', { name: /submit/i }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('submits the selected labels as an array', () => {
      const { approveToolcall } = renderBadge({ toolCallId: 'call-2', suspendPayload, result: undefined });

      fireEvent.click(screen.getByText('Cheese'));
      fireEvent.click(screen.getByText('Olives'));
      fireEvent.click(within(badge()).getByRole('button', { name: /submit/i }));

      expect(approveToolcall).toHaveBeenCalledTimes(1);
      expect(approveToolcall).toHaveBeenCalledWith('call-2', ['Cheese', 'Olives']);
    });
  });

  describe('when the payload offers no options (free text)', () => {
    const suspendPayload: AskUserSuspendPayload = { question: 'What is your name?' };

    it('submits the trimmed text on Enter', () => {
      const { approveToolcall } = renderBadge({ toolCallId: 'call-3', suspendPayload, result: undefined });

      const input = within(badge()).getByPlaceholderText('Type your answer...');
      fireEvent.change(input, { target: { value: '  Ada  ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(approveToolcall).toHaveBeenCalledTimes(1);
      expect(approveToolcall).toHaveBeenCalledWith('call-3', 'Ada');
    });

    it('submits the trimmed text via the send button', () => {
      const { approveToolcall } = renderBadge({ toolCallId: 'call-3', suspendPayload, result: undefined });

      const input = within(badge()).getByPlaceholderText('Type your answer...');
      fireEvent.change(input, { target: { value: 'Grace' } });

      const sendButton = within(badge())
        .getAllByRole('button')
        .find(button => button.getAttribute('disabled') === null && !within(button).queryByText('Question for you'));
      fireEvent.click(sendButton!);

      expect(approveToolcall).toHaveBeenCalledWith('call-3', 'Grace');
    });

    it('does not submit whitespace-only input', () => {
      const { approveToolcall } = renderBadge({ toolCallId: 'call-3', suspendPayload, result: undefined });

      const input = within(badge()).getByPlaceholderText('Type your answer...');
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(approveToolcall).not.toHaveBeenCalled();
    });
  });

  describe('when the tool call has already been answered', () => {
    const suspendPayload: AskUserSuspendPayload = {
      question: 'Pick a fruit',
      options: [{ label: 'Apple' }],
      selectionMode: 'single_select',
    };

    it('renders the answer content and hides the option inputs when a result is present', () => {
      renderBadge({
        toolCallId: 'call-4',
        suspendPayload,
        result: { content: 'User answered: Apple', isError: false },
      });

      expect(within(badge()).getAllByText('User answered: Apple')).toHaveLength(1);
      expect(badge().textContent).not.toContain('{"content"');
      expect(within(badge()).queryByRole('button', { name: 'Apple' })).toBeNull();
    });

    it('hides the inputs when the approval status is approved', () => {
      renderBadge(
        { toolCallId: 'call-4', suspendPayload, result: undefined },
        { toolCallApprovals: { 'call-4': { status: 'approved' } } },
      );

      expect(within(badge()).queryByRole('button', { name: 'Apple' })).toBeNull();
    });
  });

  describe('when a tool call is already running', () => {
    it('disables the option buttons and does not submit on click', () => {
      const suspendPayload: AskUserSuspendPayload = {
        question: 'Pick a fruit',
        options: [{ label: 'Apple' }],
        selectionMode: 'single_select',
      };
      const { approveToolcall } = renderBadge(
        { toolCallId: 'call-5', suspendPayload, result: undefined },
        { isRunning: true },
      );

      const optionButton = within(badge()).getByRole('button', { name: 'Apple' }) as HTMLButtonElement;
      expect(optionButton.disabled).toBe(true);

      fireEvent.click(optionButton);
      expect(approveToolcall).not.toHaveBeenCalled();
    });

    it('disables the free-text input', () => {
      renderBadge(
        { toolCallId: 'call-6', suspendPayload: { question: 'Name?' }, result: undefined },
        { isRunning: true },
      );

      expect((within(badge()).getByPlaceholderText('Type your answer...') as HTMLInputElement).disabled).toBe(true);
    });
  });

  describe('when the badge header is clicked', () => {
    const suspendPayload: AskUserSuspendPayload = { question: 'Pick a fruit' };

    it('collapses the content and expands it again on a second click', () => {
      renderBadge({ toolCallId: 'call-7', suspendPayload, result: undefined });

      expect(screen.queryByText('Pick a fruit')).not.toBeNull();

      const header = within(badge()).getByRole('button', { name: /question for you/i });

      fireEvent.click(header);
      expect(screen.queryByText('Pick a fruit')).toBeNull();

      fireEvent.click(header);
      expect(screen.queryByText('Pick a fruit')).not.toBeNull();
    });
  });
});
