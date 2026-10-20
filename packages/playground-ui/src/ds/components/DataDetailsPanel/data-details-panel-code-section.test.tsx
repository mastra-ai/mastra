// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataDetailsPanelCodeSection } from './data-details-panel-code-section';

afterEach(cleanup);

describe('DataDetailsPanelCodeSection', () => {
  it('renders JSON as highlighted tokens instead of a CodeMirror editor', async () => {
    const { container } = render(
      <DataDetailsPanelCodeSection title="Response" codeStr={JSON.stringify({ ok: true }, null, 2)} />,
    );

    await vi.waitFor(() => expect(container.querySelector('.syntax-literal')).not.toBeNull());
    expect(container.querySelector('.cm-editor')).toBeNull();
  });
});
