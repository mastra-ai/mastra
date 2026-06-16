// @vitest-environment jsdom
import { EntityType } from '@mastra/core/observability';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TracesDataListEntityCell } from '../traces-data-list-cells';

afterEach(cleanup);

// The observability `EntityType` enum values are lowercase. These guard that the icon helper follows
// the enum values while still tolerating uppercase strings from stale URLs or fixtures.
describe('TracesDataListEntityCell entity icon', () => {
  const renderCell = (entityType: string) =>
    render(<TracesDataListEntityCell entityType={entityType} entityName="x" />);

  it('renders an icon for the lowercase stored value "agent"', () => {
    expect(renderCell(EntityType.AGENT).container.querySelector('svg')).not.toBeNull();
  });

  it('renders an icon for the lowercase stored value "workflow_run"', () => {
    expect(renderCell(EntityType.WORKFLOW_RUN).container.querySelector('svg')).not.toBeNull();
  });

  it('still renders an icon for legacy uppercase values', () => {
    expect(renderCell('AGENT').container.querySelector('svg')).not.toBeNull();
    expect(renderCell('WORKFLOW').container.querySelector('svg')).not.toBeNull();
  });

  it('renders no icon for entity types that are neither agent nor workflow', () => {
    expect(renderCell('memory').container.querySelector('svg')).toBeNull();
  });
});
