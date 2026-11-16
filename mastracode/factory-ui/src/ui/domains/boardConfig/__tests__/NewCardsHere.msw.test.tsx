import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { workBoardInfo } from '../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../e2e/ui/msw-server';
import { renderWithProviders } from '../../../../../e2e/ui/render';
import { FACTORY_ID, PROJECT_URL, rule, ruleId, serveRules } from '../../boardRules/__tests__/fixtures/rulesServer';
import { NewCardsHere } from '../components/NewCardsHere';

function renderSummary() {
  return renderWithProviders(
    <MemoryRouter>
      <NewCardsHere factoryId={FACTORY_ID} board={workBoardInfo} />
    </MemoryRouter>,
  );
}

describe('Board config summary of new items', () => {
  it('counts the rules a new item can reach and where the board is checked', async () => {
    serveRules({
      rules: [
        rule({
          id: ruleId('bugs'),
          name: 'Bugs go to Triage',
          when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'bug' }] },
        }),
        rule({ id: ruleId('off'), name: 'Switched off', enabled: false }),
        rule({ id: ruleId('everything'), name: 'Everything else' }),
        rule({ id: ruleId('late'), name: 'Never reached' }),
        rule({ id: ruleId('closed'), name: 'Closed', on: ['work_item.closed'] }),
      ],
      order: ['release', 'work'],
    });
    renderSummary();

    expect(await screen.findByText('2 rules for new items')).toBeVisible();
    expect(screen.getByText('Checked 2nd')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Edit rules' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/work/rules`,
    );
  });

  it('says when the board takes no new items and is left out of the intake order', async () => {
    serveRules({ rules: [], order: ['release'] });
    renderSummary();

    expect(await screen.findByText('No rules for new items')).toBeVisible();
    expect(screen.getByText('Not in the intake order')).toBeVisible();
  });

  it('says when the rules did not load', async () => {
    serveRules({ rules: [] });
    server.use(
      http.get(`${PROJECT_URL}/intake-routes`, () =>
        HttpResponse.json({ error: { code: 'boom', message: 'Down.' } }, { status: 500 }),
      ),
    );
    renderSummary();

    expect(await screen.findByRole('alert')).toHaveTextContent('Rules didn’t load.');
  });
});
