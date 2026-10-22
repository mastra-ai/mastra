import type { DatasetExperimentResult } from '@mastra/client-js';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExperimentResultsList } from '../experiment-results-list';
import { agentFailedResult, agentMarkdownResult } from './fixtures/experiment-results';
import { expectComputedTag } from '@/test/computed-tag';
import { TestLinkProvider } from '@/test/link-provider';
import { renderWithProviders } from '@/test/render';

const makeResult = (id: string, error: DatasetExperimentResult['error'] = null): DatasetExperimentResult => ({
  id,
  experimentId: 'exp-1',
  itemId: `item-${id}`,
  itemDatasetVersion: 1,
  input: 'input',
  output: 'output',
  groundTruth: null,
  error,
  startedAt: '2026-08-25T10:00:00.000Z',
  completedAt: '2026-08-25T10:00:01.000Z',
  retryCount: 0,
  traceId: null,
  status: null,
  tags: null,
  scores: [],
  createdAt: '2026-08-25T10:00:00.000Z',
});

const columns = [{ name: 'id', label: 'Item', size: '1fr' }];

const renderList = (results: DatasetExperimentResult[]) =>
  renderWithProviders(
    <ExperimentResultsList
      results={results}
      isLoading={false}
      featuredResultId={null}
      onResultClick={() => {}}
      columns={columns}
    />,
  );

describe('ExperimentResultsList', () => {
  afterEach(cleanup);

  describe('for a result without an error', () => {
    it('renders no success or status indicator and keeps the default row tone', () => {
      const { container } = renderList([makeResult('r-1')]);

      expect(container.querySelector('[data-variant="error"]')).toBeNull();
      expect(screen.queryByText('Success')).toBeNull();
      expect(screen.queryByText('Status')).toBeNull();
    });
  });

  describe('for a result with an error', () => {
    it('tints the row with the error tone instead of rendering an icon', () => {
      const { container } = renderList([makeResult('r-1', { message: 'boom' })]);

      expect(container.querySelector('[data-variant="error"]')).not.toBeNull();
      expect(screen.queryByRole('img', { name: 'Error' })).toBeNull();
    });
  });

  describe('tags column', () => {
    const tagColumns = [...columns, { name: 'tags', label: 'Tags', size: '10rem' }];

    it('renders each tag of the result in the tags cell', () => {
      renderWithProviders(
        <ExperimentResultsList
          results={[{ ...makeResult('r-1'), tags: ['alpha', 'beta'] }]}
          isLoading={false}
          featuredResultId={null}
          onResultClick={() => {}}
          columns={tagColumns}
        />,
      );

      expect(screen.getByText('alpha')).toBeDefined();
      expect(screen.getByText('beta')).toBeDefined();
    });

    it('renders each tag with colors computed from its value', () => {
      renderWithProviders(
        <ExperimentResultsList
          results={[{ ...makeResult('r-1'), tags: ['alpha', 'beta'] }]}
          isLoading={false}
          featuredResultId={null}
          onResultClick={() => {}}
          columns={tagColumns}
        />,
      );

      expectComputedTag(screen.getByText('alpha'), 'alpha');
      expectComputedTag(screen.getByText('beta'), 'beta');
    });

    it('renders an empty tags cell when the result has no tags', () => {
      renderWithProviders(
        <ExperimentResultsList
          results={[makeResult('r-1')]}
          isLoading={false}
          featuredResultId={null}
          onResultClick={() => {}}
          columns={tagColumns}
        />,
      );

      expect(screen.getByText('Tags')).toBeDefined();
      expect(screen.getByTestId('result-tags-r-1').textContent).toBe('');
    });
  });

  describe('when the output column is requested', () => {
    const outputColumns = [...columns, { name: 'output', label: 'Output', size: '1fr' }];

    it('renders the Output header', () => {
      renderWithProviders(
        <ExperimentResultsList
          results={[agentMarkdownResult]}
          isLoading={false}
          featuredResultId={null}
          onResultClick={() => {}}
          columns={outputColumns}
        />,
      );

      expect(screen.getByText('Output')).toBeDefined();
    });

    it('renders the raw agent text without rendering markdown', () => {
      renderWithProviders(
        <ExperimentResultsList
          results={[agentMarkdownResult]}
          isLoading={false}
          featuredResultId={null}
          onResultClick={() => {}}
          columns={outputColumns}
        />,
      );

      expect(screen.getByTestId('result-output-res-agent-ok').textContent).toBe('# Title\n\n**bold**');
      expect(screen.queryByRole('heading', { name: 'Title' })).toBeNull();
    });
  });

  describe('when the error column is requested', () => {
    const errorColumns = [...columns, { name: 'error', label: 'Error', size: '1fr' }];

    it('renders the error message in the destructive color', () => {
      renderWithProviders(
        <ExperimentResultsList
          results={[agentFailedResult]}
          isLoading={false}
          featuredResultId={null}
          onResultClick={() => {}}
          columns={errorColumns}
        />,
      );

      const cell = screen.getByTestId('result-error-res-agent-fail');
      expect(cell.textContent).toBe('model exploded');
      expect(cell.className).toContain('text-destructive-foreground');
    });
  });

  describe('scorer columns', () => {
    it('links the column header to the scorer page in the same tab', () => {
      renderWithProviders(
        <TestLinkProvider>
          <ExperimentResultsList
            results={[makeResult('r-1')]}
            isLoading={false}
            featuredResultId={null}
            onResultClick={() => {}}
            columns={[...columns, { name: 'answer-relevancy', label: 'Answer relevancy', size: '1fr' }]}
            scorerIds={['answer-relevancy']}
          />
        </TestLinkProvider>,
      );

      const link = screen.getByText('Answer relevancy').closest('a');
      expect(link?.getAttribute('href')).toBe('/scorers/answer-relevancy');
      expect(link?.hasAttribute('target')).toBe(false);
    });
  });

  describe('scorer cell reason', () => {
    const renderWithScores = (scoresByItemId: ComponentProps<typeof ExperimentResultsList>['scoresByItemId']) =>
      renderWithProviders(
        <TestLinkProvider>
          <ExperimentResultsList
            results={[makeResult('r-1')]}
            isLoading={false}
            featuredResultId={null}
            onResultClick={() => {}}
            columns={[...columns, { name: 'answer-relevancy', label: 'Answer relevancy', size: '1fr' }]}
            scorerIds={['answer-relevancy']}
            scoresByItemId={scoresByItemId}
          />
        </TestLinkProvider>,
      );

    describe('when the score has a reason', () => {
      const scoresByItemId = {
        'item-r-1': [{ scorerId: 'answer-relevancy', score: 0.5, reason: 'Because **bold**' }],
      };

      it('renders the reason as markdown when the info icon is hovered', async () => {
        renderWithScores(scoresByItemId);

        fireEvent.mouseEnter(screen.getByTestId('score-reason-answer-relevancy'));

        expect((await screen.findByText('bold')).tagName).toBe('STRONG');
      });

      it('does not open the result when the reason card is clicked', async () => {
        const onResultClick = vi.fn();
        renderWithProviders(
          <ExperimentResultsList
            results={[makeResult('r-1')]}
            isLoading={false}
            featuredResultId={null}
            onResultClick={onResultClick}
            columns={[...columns, { name: 'answer-relevancy', label: 'Answer relevancy', size: '1fr' }]}
            scorerIds={['answer-relevancy']}
            scoresByItemId={scoresByItemId}
          />,
        );

        fireEvent.mouseEnter(screen.getByTestId('score-reason-answer-relevancy'));
        fireEvent.click(await screen.findByText('bold'));

        expect(onResultClick).not.toHaveBeenCalled();
      });

      it('does not nest a button inside the row button', () => {
        const { container } = renderWithScores(scoresByItemId);

        expect(container.querySelector('button button')).toBeNull();
      });
    });

    describe('when the score has no reason', () => {
      it('renders only the score value', () => {
        renderWithScores({ 'item-r-1': [{ scorerId: 'answer-relevancy', score: 0.5, reason: null }] });

        expect(screen.getByText('0.500')).toBeDefined();
        expect(screen.queryByTestId('score-reason-answer-relevancy')).toBeNull();
      });
    });

    describe('when the score carries a categorical label', () => {
      it('renders the label as a tag next to the number', () => {
        renderWithScores({ 'item-r-1': [{ scorerId: 'answer-relevancy', score: 0.5, label: 'exemplary' }] });

        expect(screen.getByText('0.500')).toBeDefined();
        expectComputedTag(screen.getByText('exemplary'), 'exemplary');
      });
    });

    describe('when the score has no label', () => {
      it('renders no tag', () => {
        renderWithScores({ 'item-r-1': [{ scorerId: 'answer-relevancy', score: 0.5, label: null }] });

        expect(screen.getByText('0.500')).toBeDefined();
        expect(screen.queryByTestId('computed-tag')).toBeNull();
      });
    });
  });
});
