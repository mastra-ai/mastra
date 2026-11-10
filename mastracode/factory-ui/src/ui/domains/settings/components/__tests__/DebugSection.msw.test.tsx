import { fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { ServerVersions } from '../../../../../hooks/useServerVersions';
import { DebugSection } from '../DebugSection';

const VERSIONS = `${TEST_BASE_URL}/web/config/versions`;
const originalClipboard = navigator.clipboard;

afterEach(() => {
  Object.assign(navigator, { clipboard: originalClipboard });
});

function serveVersions(versions: ServerVersions) {
  server.use(http.get(VERSIONS, () => HttpResponse.json(versions)));
}

describe('Debug settings', () => {
  it('lists the packages the server runs and copies them as plain text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    serveVersions({
      packages: [
        { name: '@mastra/core', version: '1.83.0-alpha.0' },
        { name: '@mastra/factory', version: '0.28.0-alpha.0' },
      ],
      nodeVersion: 'v22.15.0',
    });
    renderWithProviders(<DebugSection />);

    expect(await screen.findByText('@mastra/core')).toBeInTheDocument();
    expect(screen.getByText('1.83.0-alpha.0')).toBeInTheDocument();
    expect(screen.getByText('@mastra/factory')).toBeInTheDocument();
    expect(screen.getByText('v22.15.0')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy versions' }));

    await screen.findByRole('button', { name: 'Copied!' });
    expect(writeText).toHaveBeenCalledWith(
      '@mastra/core@1.83.0-alpha.0\n@mastra/factory@0.28.0-alpha.0\nnode@v22.15.0',
    );
  });

  it('says when the build shipped no package list', async () => {
    serveVersions({ packages: [], nodeVersion: 'v22.15.0' });
    renderWithProviders(<DebugSection />);

    expect(await screen.findByText(/This server's build has no package list/)).toBeInTheDocument();
    expect(screen.getByText('v22.15.0')).toBeInTheDocument();
  });

  it('offers a retry when versions fail to load', async () => {
    server.use(http.get(VERSIONS, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    renderWithProviders(<DebugSection />);

    expect(await screen.findByText("Couldn't load versions.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
