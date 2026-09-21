// @vitest-environment jsdom
import { EntityType } from '@mastra/core/observability';
import { TraceStatus } from '@mastra/core/storage';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TracesDataListStatusCell, TracesDataListTypeCell } from '../traces-data-list-cells';

afterEach(cleanup);

// The observability `EntityType` enum values are lowercase. These guard that the cell follows
// the enum values while still tolerating uppercase strings from stale URLs or fixtures.
describe('TracesDataListTypeCell', () => {
  const renderCell = (entityType?: string | null) => render(<TracesDataListTypeCell entityType={entityType} />);
  const hasIcon = (entityType: string) => renderCell(entityType).container.querySelector('svg') !== null;

  describe('when the entity type is a known enum value', () => {
    it.each([
      [EntityType.AGENT, 'Agent'],
      [EntityType.WORKFLOW_RUN, 'Workflow'],
      [EntityType.WORKFLOW_STEP, 'Step'],
      [EntityType.TOOL, 'Tool'],
      [EntityType.SCORER, 'Scorer'],
      [EntityType.MEMORY, 'Memory'],
      [EntityType.INPUT_PROCESSOR, 'Processor'],
      [EntityType.INPUT_STEP_PROCESSOR, 'Processor'],
      [EntityType.OUTPUT_PROCESSOR, 'Processor'],
      [EntityType.OUTPUT_STEP_PROCESSOR, 'Processor'],
      [EntityType.TOOL_RESULT_PROCESSOR, 'Processor'],
      [EntityType.RAG_INGESTION, 'RAG'],
      [EntityType.TRAJECTORY, 'Trajectory'],
    ])('renders an icon and the "%s" label as %s', (entityType, label) => {
      expect(hasIcon(entityType)).toBe(true);
      expect(screen.getByText(label)).not.toBeNull();
    });
  });

  describe('when the entity type is a legacy uppercase value', () => {
    it('still renders an icon and label', () => {
      expect(hasIcon('AGENT')).toBe(true);
      expect(screen.getByText('Agent')).not.toBeNull();
      cleanup();
      expect(hasIcon('WORKFLOW')).toBe(true);
      expect(screen.getByText('Workflow')).not.toBeNull();
    });
  });

  describe('when the entity type is unknown or missing', () => {
    it('renders a dash and no icon for an unknown type', () => {
      expect(hasIcon('something_else')).toBe(false);
      expect(screen.getByText('-')).not.toBeNull();
    });

    it('renders a dash when the type is null', () => {
      const { container } = renderCell(null);
      expect(container.querySelector('svg')).toBeNull();
      expect(screen.getByText('-')).not.toBeNull();
    });
  });
});

describe('TracesDataListStatusCell', () => {
  describe('when the trace API returns a computed status', () => {
    it('renders a successful trace as a green badge', () => {
      render(<TracesDataListStatusCell status={TraceStatus.SUCCESS} />);
      expect(screen.getByText('OK').className).toContain('text-badge-green-fg');
    });

    it('renders a running trace', () => {
      render(<TracesDataListStatusCell status={TraceStatus.RUNNING} />);
      expect(screen.getByText('RUN')).toBeTruthy();
    });
  });
});
