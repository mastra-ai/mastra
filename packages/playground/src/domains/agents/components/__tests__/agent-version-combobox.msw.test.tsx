import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { AgentVersionCombobox } from '../agent-version-combobox';
import {
  firstVersionControlsPage,
  PAGINATED_OLDER_VERSION_ID,
  PAGINATED_PRODUCTION_VERSION_ID,
  PRODUCTION_VERSION_ID,
  secondVersionControlsPage,
  VERSION_CONTROLS_AGENT_ID,
  versionControlsHistory,
} from './fixtures/agent-version-controls';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

afterEach(() => cleanup());

describe('AgentVersionCombobox', () => {
  it('marks the active stored-agent version as Production without legacy Published copy', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/stored/agents/${VERSION_CONTROLS_AGENT_ID}/versions`, () =>
        HttpResponse.json(versionControlsHistory),
      ),
    );

    renderWithProviders(
      <AgentVersionCombobox agentId={VERSION_CONTROLS_AGENT_ID} activeVersionId={PRODUCTION_VERSION_ID} />,
    );

    const selector = await screen.findByRole('combobox');
    await waitFor(() => expect(selector.hasAttribute('disabled')).toBe(false));
    fireEvent.click(selector);

    expect(await screen.findByText('Production')).not.toBeNull();
    expect(screen.queryByText('Published')).toBeNull();
  });

  it('keeps an older exact preview target selectable when Production is outside page one', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/stored/agents/${VERSION_CONTROLS_AGENT_ID}/versions`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'));
        return HttpResponse.json(page === 0 ? firstVersionControlsPage : secondVersionControlsPage);
      }),
    );
    let selectedVersionId = '';

    renderWithProviders(
      <AgentVersionCombobox
        agentId={VERSION_CONTROLS_AGENT_ID}
        activeVersionId={PAGINATED_PRODUCTION_VERSION_ID}
        onValueChange={versionId => {
          selectedVersionId = versionId;
        }}
      />,
    );

    const selector = await screen.findByRole('combobox');
    await waitFor(() => expect(selector.hasAttribute('disabled')).toBe(false));
    fireEvent.click(selector);
    expect(await screen.findByText('Production')).not.toBeNull();
    fireEvent.change(await screen.findByPlaceholderText('Search versions...'), { target: { value: 'v4' } });
    const olderVersion = await screen.findByRole('option', { name: /^v4/ });
    fireEvent.pointerDown(olderVersion, { pointerType: 'mouse' });
    fireEvent.click(olderVersion, { detail: 1 });

    await waitFor(() => expect(selectedVersionId).toBe(PAGINATED_OLDER_VERSION_ID));
  });
});
