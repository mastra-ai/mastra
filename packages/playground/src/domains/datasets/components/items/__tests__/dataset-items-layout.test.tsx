// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DatasetItemsLayout } from '../dataset-items-layout';

describe('DatasetItemsLayout', () => {
  afterEach(cleanup);

  it('renders the list slot', () => {
    render(<DatasetItemsLayout listSlot={<div data-testid="list">list</div>} />);
    expect(screen.getByTestId('list')).toBeDefined();
  });

  it('renders the detail panel when provided', () => {
    render(<DatasetItemsLayout listSlot={<div data-testid="list" />} detailPanelSlot={<div data-testid="detail" />} />);
    expect(screen.queryByTestId('detail')).not.toBeNull();
  });

  it('shows the detail panel and suppresses the versions panel when both are present', () => {
    render(
      <DatasetItemsLayout
        listSlot={<div />}
        detailPanelSlot={<div data-testid="detail" />}
        versionsPanelSlot={<div data-testid="versions" />}
      />,
    );
    expect(screen.queryByTestId('detail')).not.toBeNull();
    expect(screen.queryByTestId('versions')).toBeNull();
  });

  it('falls back to versions panel when there is no detail panel', () => {
    render(<DatasetItemsLayout listSlot={<div />} versionsPanelSlot={<div data-testid="versions" />} />);
    expect(screen.queryByTestId('versions')).not.toBeNull();
  });

  it('renders only the list when no side panel is requested', () => {
    render(<DatasetItemsLayout listSlot={<div data-testid="list" />} />);
    expect(screen.queryByTestId('detail')).toBeNull();
    expect(screen.queryByTestId('versions')).toBeNull();
  });
});
