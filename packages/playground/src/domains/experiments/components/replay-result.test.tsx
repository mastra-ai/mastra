// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { conversationResult, replayResult } from './__tests__/fixtures/replay';
import { ReplayResult } from './replay-result';

// CodeMirror needs browser layout; retain the displayed JSON at this UI boundary.
vi.mock('@mastra/playground-ui/components/CodeEditor', () => ({
  CodeEditor: ({ value }: { value: string }) => <pre>{value}</pre>,
}));

describe('ReplayResult', () => {
  describe('when inspecting a replay that differs from production', () => {
    it('shows the current turn, tool arguments and results, changed memory, and the mock miss', () => {
      render(<ReplayResult result={replayResult} />);
      expect(screen.getByText('Turn 3 of 10')).toBeTruthy();
      expect(screen.getByText('Check my order')).toBeTruthy();
      expect(screen.queryByText('Previous question')).toBeNull();
      const production = within(screen.getByRole('region', { name: 'Production' }));
      const candidate = within(screen.getByRole('region', { name: 'Candidate' }));
      expect(production.getByText('Order ready')).toBeTruthy();
      expect(candidate.getByText('Please confirm the order number')).toBeTruthy();
      expect(candidate.getByText('Ada: awaiting confirmation')).toBeTruthy();
      expect(candidate.getByText('lookupOrder: args-mismatch')).toBeTruthy();
      expect(candidate.getByText(/No recorded result/)).toBeTruthy();
      expect(screen.queryByText(/internal-run-id/)).toBeNull();
    });
  });
  describe('when a conversation stops after a memory regression and missing recording', () => {
    it('keeps earlier scores visible and identifies incomplete evidence on the failed turn', () => {
      render(<ReplayResult result={conversationResult} />);
      expect(screen.getByText('1 of 3 turns completed')).toBeTruthy();
      expect(screen.getByText(/Missing recordings/)).toBeTruthy();
      expect(screen.getByText('Remembered Grace')).toBeTruthy();
      expect(screen.getByText('Similarity: 0')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /Turn 2/ }));
      expect(screen.getByText('Provider disconnected')).toBeTruthy();
      expect(screen.getByText('Similarity: Judge unavailable')).toBeTruthy();
      expect(screen.getByText('Grace')).toBeTruthy();
      expect(screen.getByRole('button', { name: /Turn 3.*Not executed/ }).hasAttribute('disabled')).toBe(true);
    });
  });
});
