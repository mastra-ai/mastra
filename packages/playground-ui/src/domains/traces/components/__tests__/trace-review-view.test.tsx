// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TraceReviewView } from '../trace-review-view';
import { clinicalLightSpans, clinicalRootSpan } from './fixtures/trace-review-view';

afterEach(cleanup);

describe('TraceReviewView', () => {
  describe('when a completed agent trace is available', () => {
    it('renders the case and response as readable text', () => {
      render(<TraceReviewView rootSpan={clinicalRootSpan} spans={clinicalLightSpans} />);

      expect(screen.getByRole('heading', { name: 'Case' })).not.toBeNull();
      expect(screen.getAllByText(/58-year-old patient/).length).toBeGreaterThan(0);
      expect(screen.getByRole('heading', { name: 'Agent response' })).not.toBeNull();
      expect(screen.getByRole('heading', { name: 'Leading diagnosis' })).not.toBeNull();
      expect(screen.getAllByText(/Acute aortic dissection/).length).toBeGreaterThan(0);
    });

    it('collapses raw message data behind a disclosure', () => {
      render(<TraceReviewView rootSpan={clinicalRootSpan} spans={clinicalLightSpans} />);

      const disclosures = screen.getAllByText('Raw message data');
      expect(disclosures).toHaveLength(2);
      expect(disclosures[0]?.closest('details')?.open).toBe(false);
    });

    it('summarizes technical spans as plain-language steps', () => {
      render(<TraceReviewView rootSpan={clinicalRootSpan} spans={clinicalLightSpans} />);

      expect(screen.getByText('Generated the response')).not.toBeNull();
      expect(screen.getByText('Used Check urgent red flags')).not.toBeNull();
      expect(screen.queryByText('MODEL_GENERATION')).toBeNull();
    });

    it('shows step durations and success indicators', () => {
      render(<TraceReviewView rootSpan={clinicalRootSpan} spans={clinicalLightSpans} />);

      expect(screen.getAllByText('2.0s').length).toBeGreaterThan(0);
    });

    it('renders the feedback slot below the review sections', () => {
      render(
        <TraceReviewView
          rootSpan={clinicalRootSpan}
          spans={clinicalLightSpans}
          feedbackSlot={<div>Feedback form</div>}
        />,
      );

      expect(screen.getByText('Feedback form')).not.toBeNull();
    });

    it('starts a note for the section the reviewer is reading', () => {
      const onReviewTargetChange = vi.fn();
      render(
        <TraceReviewView
          rootSpan={clinicalRootSpan}
          spans={clinicalLightSpans}
          onReviewTargetChange={onReviewTargetChange}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Add note about agent response' }));

      expect(onReviewTargetChange).toHaveBeenCalledWith('response');
    });

    it('starts a note for the case and the reasoning sections', () => {
      const onReviewTargetChange = vi.fn();
      render(
        <TraceReviewView
          rootSpan={clinicalRootSpan}
          spans={clinicalLightSpans}
          onReviewTargetChange={onReviewTargetChange}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Add note about case' }));
      fireEvent.click(screen.getByRole('button', { name: 'Add note about reasoning' }));

      expect(onReviewTargetChange).toHaveBeenNthCalledWith(1, 'case');
      expect(onReviewTargetChange).toHaveBeenNthCalledWith(2, 'reasoning');
    });

    it('hides the note actions when no handler is provided', () => {
      render(<TraceReviewView rootSpan={clinicalRootSpan} spans={clinicalLightSpans} />);

      expect(screen.queryByRole('button', { name: /add note/i })).toBeNull();
    });
  });

  describe('when the reviewer selects response text', () => {
    const selectText = (container: HTMLElement, needle: string) => {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let node: Node | null = walker.nextNode();
      while (node && !node.textContent?.includes(needle)) node = walker.nextNode();
      if (!node?.textContent) throw new Error(`Text not found: ${needle}`);
      const range = document.createRange();
      const start = node.textContent.indexOf(needle);
      range.setStart(node, start);
      range.setEnd(node, start + needle.length);
      const selection = window.getSelection();
      if (!selection) throw new Error('Selection unavailable');
      selection.removeAllRanges();
      selection.addRange(range);
    };

    it('offers to annotate the selection and reports the quote', () => {
      const onAnnotate = vi.fn();
      const { container } = render(
        <TraceReviewView rootSpan={clinicalRootSpan} spans={clinicalLightSpans} onAnnotate={onAnnotate} />,
      );

      selectText(container, 'Acute aortic dissection');
      const [responseText] = screen.getAllByText(/Acute aortic dissection/);
      if (!responseText) throw new Error('Response text not rendered');
      fireEvent.mouseUp(responseText);
      fireEvent.click(screen.getByRole('button', { name: 'Annotate selection in agent response' }));

      expect(onAnnotate).toHaveBeenCalledWith({ target: 'response', quote: 'Acute aortic dissection' });
    });

    it('shows no annotate action without a selection', () => {
      render(<TraceReviewView rootSpan={clinicalRootSpan} spans={clinicalLightSpans} onAnnotate={vi.fn()} />);

      expect(screen.queryByRole('button', { name: /annotate selection/i })).toBeNull();
    });
  });

  describe('when saved annotations exist for a section', () => {
    it('renders the annotations slot inside that section', () => {
      render(
        <TraceReviewView
          rootSpan={clinicalRootSpan}
          spans={clinicalLightSpans}
          annotationsSlot={target => (target === 'response' ? <div>Saved annotation</div> : null)}
        />,
      );

      expect(screen.getByText('Saved annotation')).not.toBeNull();
    });
  });

  describe('when the trace has no intermediate steps', () => {
    it('says no steps were recorded', () => {
      render(<TraceReviewView rootSpan={clinicalRootSpan} spans={[clinicalRootSpan]} />);

      expect(screen.getByText('No intermediate steps were recorded.')).not.toBeNull();
    });
  });

  describe('when the root span has no readable content', () => {
    it('says the section was not recorded', () => {
      render(<TraceReviewView rootSpan={{ ...clinicalRootSpan, input: undefined, output: undefined }} spans={[]} />);

      expect(screen.getByText('No readable case was recorded.')).not.toBeNull();
      expect(screen.getByText('No readable agent response was recorded.')).not.toBeNull();
    });
  });

  describe('when the trace is still loading', () => {
    it('shows a loading message', () => {
      render(<TraceReviewView spans={[]} isLoading />);

      expect(screen.getByText('Loading review…')).not.toBeNull();
    });
  });

  describe('when the root span is unavailable', () => {
    it('says review content is unavailable', () => {
      render(<TraceReviewView spans={[]} />);

      expect(screen.getByText('Review content is unavailable for this trace.')).not.toBeNull();
    });
  });
});
