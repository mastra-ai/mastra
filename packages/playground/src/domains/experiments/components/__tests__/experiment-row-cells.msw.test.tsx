import { DataList } from '@mastra/playground-ui/components/DataList';
import { cleanup, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExperimentRowCells } from '../experiment-row-cells';
import { experiments } from './fixtures/experiments';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const base = experiments[0];

beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/agents`, () =>
      HttpResponse.json({ 'agent-1': { name: 'Support Agent', instructions: '', tools: {}, workflows: {} } }),
    ),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json({})),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json({})),
  );
});

afterEach(cleanup);

const renderCells = (experiment = base) =>
  renderWithProviders(
    <DataList>
      <DataList.RowStatic>
        <ExperimentRowCells experiment={experiment} />
      </DataList.RowStatic>
    </DataList>,
  );

describe('ExperimentRowCells target column', () => {
  it('shows the resolved target name with its type icon', async () => {
    renderCells({ ...base, targetType: 'agent', targetId: 'agent-1' });
    expect(await screen.findByText('Support Agent')).toBeDefined();
    expect(screen.getByRole('img', { name: 'Agent' })).toBeDefined();
    expect(screen.queryByText('agent agent-1')).toBeNull();
  });

  it('labels caller-run experiments as external', () => {
    renderCells({ ...base, targetType: null, targetId: null });
    expect(screen.getByText('External (caller-run)')).toBeDefined();
  });
});
