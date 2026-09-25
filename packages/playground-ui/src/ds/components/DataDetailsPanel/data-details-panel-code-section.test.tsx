// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { highlight } from '../CodeEditor/highlight';
import { DataDetailsPanelCodeSection } from './data-details-panel-code-section';

vi.mock('../CodeEditor/highlight', () => ({ highlight: vi.fn() }));

beforeEach(() => {
  vi.mocked(highlight).mockImplementation(async code => code.split('\n').map(line => [{ content: line }]));
});

afterEach(() => {
  cleanup();
  vi.mocked(highlight).mockReset();
});

describe('DataDetailsPanelCodeSection', () => {
  it('renders JSON as Shiki tokens instead of a CodeMirror editor', async () => {
    const { container } = render(
      <DataDetailsPanelCodeSection title="Response" codeStr={JSON.stringify({ ok: true }, null, 2)} />,
    );

    await vi.waitFor(() => expect(container.querySelector('.shiki-token')).not.toBeNull());
    expect(container.querySelector('.cm-editor')).toBeNull();
  });
});
