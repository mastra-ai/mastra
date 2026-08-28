import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatasetExperiments } from '../dataset-experiments';
import { namedExperiment } from './fixtures/experiments';
import { LinkComponentProvider } from '@/lib/framework';
import { StubLink, stubLinkPaths } from '@/test/link-provider';

describe('DatasetExperiments', () => {
  afterEach(cleanup);

  describe('when an experiment row is clicked', () => {
    it('navigates to the global experiment page', () => {
      const navigate = vi.fn();
      render(
        <LinkComponentProvider Link={StubLink} navigate={navigate} paths={stubLinkPaths}>
          <DatasetExperiments
            experiments={[namedExperiment]}
            isLoading={false}
            datasetId="dataset-1"
            filters={{}}
            onFiltersChange={() => {}}
          />
        </LinkComponentProvider>,
      );

      fireEvent.click(screen.getByText('entity-extraction / model-a'));

      expect(navigate).toHaveBeenCalledWith(`/experiments/${namedExperiment.id}`);
    });
  });
});
