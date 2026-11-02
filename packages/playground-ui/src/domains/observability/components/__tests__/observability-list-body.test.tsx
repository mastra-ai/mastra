// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ObservabilityListBody } from '../observability-list-body';

const chart = <section aria-label="Traces over time" />;
const toolbar = <div role="toolbar" aria-label="Filters" />;

describe('ObservabilityListBody', () => {
  afterEach(cleanup);

  describe('when the list renders', () => {
    it('places the chart between the toolbar and the list', () => {
      render(
        <ObservabilityListBody toolbar={toolbar} chart={chart}>
          <ul aria-label="Traces" />
        </ObservabilityListBody>,
      );

      const order = [
        screen.getByRole('toolbar', { name: 'Filters' }),
        screen.getByRole('region', { name: 'Traces over time' }),
        screen.getByRole('list', { name: 'Traces' }),
      ];
      expect(order[0].compareDocumentPosition(order[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(order[1].compareDocumentPosition(order[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe('when an error is shown', () => {
    it('hides the chart', () => {
      render(
        <ObservabilityListBody toolbar={toolbar} chart={chart} error={<p>Failed</p>}>
          <ul aria-label="Traces" />
        </ObservabilityListBody>,
      );

      expect(screen.getByText('Failed')).toBeTruthy();
      expect(screen.queryByRole('region', { name: 'Traces over time' })).toBeNull();
    });
  });

  describe('when the empty state is shown', () => {
    it('hides the chart', () => {
      render(
        <ObservabilityListBody toolbar={toolbar} chart={chart} empty={<p>No traces yet</p>}>
          <ul aria-label="Traces" />
        </ObservabilityListBody>,
      );

      expect(screen.getByText('No traces yet')).toBeTruthy();
      expect(screen.queryByRole('region', { name: 'Traces over time' })).toBeNull();
    });
  });
});
