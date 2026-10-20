// @vitest-environment jsdom
import { EntityType } from '@mastra/core/observability';
import { TraceStatus } from '@mastra/core/storage';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TracesDataListOutputCell, TracesDataListStatusCell, TracesDataListTypeCell } from '../traces-data-list-cells';

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
      [EntityType.CLASSIFIER, 'Classifier'],
      [EntityType.MEMORY, 'Memory'],
      [EntityType.MCP_SERVER, 'MCP Server'],
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
    it('renders a running trace', () => {
      render(<TracesDataListStatusCell status={TraceStatus.RUNNING} />);
      expect(screen.getByText('RUN')).toBeTruthy();
    });
  });
});

describe('TracesDataListOutputCell', () => {
  const ERROR_COLOR = '.text-destructive-foreground';

  it('shows the output of a successful trace in the normal color', () => {
    const { container } = render(<TracesDataListOutputCell status="success" output="Sunny" error="stray" />);
    expect(screen.getByText('Sunny')).not.toBeNull();
    expect(screen.queryByText('stray')).toBeNull();
    expect(container.querySelector(ERROR_COLOR)).toBeNull();
  });

  it('shows the error of a failed trace in the error color', () => {
    const { container } = render(<TracesDataListOutputCell status="error" output="partial" error="Rate limit" />);
    expect(container.querySelector(ERROR_COLOR)?.textContent).toBe('Rate limit');
    expect(screen.queryByText('partial')).toBeNull();
  });

  it('marks a failed trace with no error preview with a dash in the error color', () => {
    const { container } = render(<TracesDataListOutputCell status="error" output="partial" />);
    expect(container.querySelector(ERROR_COLOR)?.textContent).toBe('-');
    expect(screen.queryByText('partial')).toBeNull();
  });

  it('shows a plain dash when a successful trace has no output preview', () => {
    const { container } = render(<TracesDataListOutputCell status="success" />);
    expect(screen.getByText('-')).not.toBeNull();
    expect(container.querySelector(ERROR_COLOR)).toBeNull();
  });
});
