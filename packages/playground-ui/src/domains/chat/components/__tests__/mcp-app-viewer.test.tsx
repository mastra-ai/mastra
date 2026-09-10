// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { McpAppViewer } from '../mcp-app-viewer';

afterEach(cleanup);

describe('McpAppViewer', () => {
  describe('when HTML is supplied without application providers or action callbacks', () => {
    it('hosts the application in a sandboxed iframe', async () => {
      const { container } = render(<McpAppViewer html="<p>Tool result</p>" sandboxUrl={new URL('about:blank')} />);
      await waitFor(() => expect(container.querySelector('iframe')).not.toBeNull());
      const iframe = container.querySelector('iframe');
      expect(iframe?.getAttribute('sandbox')).toContain('allow-scripts');
    });
  });
});
