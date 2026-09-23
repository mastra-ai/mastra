import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { builtinBoardCatalog, releaseBoard } from '../../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { BoardCatalogResponse, FactorySkillsResponse } from '../../../../../api/types';
import { FactorySkillsSection } from '../FactorySkillsSection';

const SKILLS_URL = `${TEST_BASE_URL}/web/factory/skills`;
const BOARDS_URL = `${TEST_BASE_URL}/web/factory/projects/fp-1/boards`;

const catalog: FactorySkillsResponse = {
  skills: [
    {
      name: 'factory-triage',
      description: "Triage a Factory work item's issue — diagnose root cause, then advance the stage",
      content: '# Triage\n\nTrace history and diagnose the root cause.',
    },
    {
      name: 'factory-plan',
      description: 'Produce a phased implementation plan for a Factory work item',
      content: '# Plan\n\nProduce a phased implementation plan.',
    },
    {
      name: 'factory-rereview',
      description: 'Re-review a Factory work item PR after changes',
      content: '# Re-review',
    },
    {
      name: 'factory-review',
      description: 'Review a Factory work item PR',
      content: '# Review',
    },
    {
      name: 'configure-factory-rules',
      description: 'Configure repository rules for Factory runs',
      content: '# Configure rules',
    },
  ],
};

describe('FactorySkillsSection', () => {
  it('shows the pipeline stage skills from the catalog', async () => {
    server.use(http.get(SKILLS_URL, () => HttpResponse.json(catalog)));

    renderWithProviders(<FactorySkillsSection />);

    expect(await screen.findByText('Triage')).toBeInTheDocument();
    expect(screen.getByText('factory-triage')).toBeInTheDocument();
    expect(screen.getByText(/diagnose root cause/)).toBeInTheDocument();
    expect(screen.getByText('Planning')).toBeInTheDocument();
    expect(screen.getByText('factory-plan')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('factory-review')).toBeInTheDocument();
    expect(screen.getByText('Re-review')).toBeInTheDocument();
    expect(screen.getByText('factory-rereview')).toBeInTheDocument();
    // Skills not in the displayed set are not rendered.
    expect(screen.queryByText('configure-factory-rules')).not.toBeInTheDocument();
  });

  it('expands a skill to reveal its SKILL.md content', async () => {
    server.use(http.get(SKILLS_URL, () => HttpResponse.json(catalog)));

    const user = userEvent.setup();
    renderWithProviders(<FactorySkillsSection />);

    const trigger = await screen.findByRole('button', { name: /Triage/ });
    expect(screen.queryByText(/Trace history and diagnose/)).not.toBeInTheDocument();

    await user.click(trigger);
    expect(await screen.findByText(/Trace history and diagnose/)).toBeInTheDocument();
  });

  it('toggles the expanded skill between rendered markdown and its raw source', async () => {
    server.use(http.get(SKILLS_URL, () => HttpResponse.json(catalog)));

    const user = userEvent.setup();
    renderWithProviders(<FactorySkillsSection />);

    await user.click(await screen.findByRole('button', { name: /Triage/ }));
    expect(screen.getByRole('heading', { name: 'Triage' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show raw' }));
    expect(screen.queryByRole('heading', { name: 'Triage' })).not.toBeInTheDocument();
    expect(screen.getByText(/# Triage/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show formatted' }));
    expect(screen.getByRole('heading', { name: 'Triage' })).toBeInTheDocument();
  });

  it('reopens a skill on the formatted view after it was left on raw', async () => {
    server.use(http.get(SKILLS_URL, () => HttpResponse.json(catalog)));

    const user = userEvent.setup();
    renderWithProviders(<FactorySkillsSection />);

    const trigger = await screen.findByRole('button', { name: /Triage/ });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Show raw' }));
    await user.click(trigger);
    await user.click(trigger);

    expect(await screen.findByRole('heading', { name: 'Triage' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show raw' })).toBeInTheDocument();
  });

  it('groups built-in skills under their boards and lists declared roles for custom boards', async () => {
    server.use(
      http.get(SKILLS_URL, () => HttpResponse.json(catalog)),
      http.get(BOARDS_URL, () =>
        HttpResponse.json({ boards: [releaseBoard, ...builtinBoardCatalog.boards] } satisfies BoardCatalogResponse),
      ),
    );

    renderWithProviders(<FactorySkillsSection factoryId="fp-1" />);

    const work = await screen.findByRole('region', { name: 'Work board' });
    expect(within(work).getByText('factory-triage')).toBeInTheDocument();
    expect(within(work).getByText('factory-plan')).toBeInTheDocument();
    expect(within(work).queryByText('factory-review')).not.toBeInTheDocument();

    const review = screen.getByRole('region', { name: 'Review board' });
    expect(within(review).getByText('factory-review')).toBeInTheDocument();
    expect(within(review).getByText('factory-rereview')).toBeInTheDocument();

    const release = screen.getByRole('region', { name: 'Release Preview board' });
    expect(within(release).getByText('release-preparer')).toBeInTheDocument();
    expect(within(release).getByText('release-publisher')).toBeInTheDocument();
    expect(within(release).getByText(/defined in code by its board definition/)).toBeInTheDocument();
    expect(within(release).queryByText(/factory-/)).not.toBeInTheDocument();

    // Built-ins come first regardless of registry order.
    const regions = screen.getAllByRole('region', { name: / board$/ }).map(region => region.getAttribute('aria-label'));
    expect(regions).toEqual(['Work board', 'Review board', 'Release Preview board']);
  });

  it('says so when a custom-only deployment has no board skills to show', async () => {
    server.use(
      http.get(SKILLS_URL, () => HttpResponse.json(catalog)),
      http.get(BOARDS_URL, () => HttpResponse.json({ boards: [releaseBoard] } satisfies BoardCatalogResponse)),
    );

    renderWithProviders(<FactorySkillsSection factoryId="fp-1" />);

    expect(await screen.findByRole('region', { name: 'Release Preview board' })).toBeInTheDocument();
    expect(screen.queryByText('factory-triage')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Work board' })).not.toBeInTheDocument();
  });

  it('reports an empty catalog instead of pretending built-in boards exist', async () => {
    server.use(
      http.get(SKILLS_URL, () => HttpResponse.json(catalog)),
      http.get(BOARDS_URL, () => HttpResponse.json({ boards: [] } satisfies BoardCatalogResponse)),
    );

    renderWithProviders(<FactorySkillsSection factoryId="fp-1" />);

    expect(await screen.findByText('No boards are installed, so no board skills apply.')).toBeInTheDocument();
    expect(screen.queryByText('factory-triage')).not.toBeInTheDocument();
  });

  it('falls back to the ungrouped list and says why when the catalog fails', async () => {
    server.use(
      http.get(SKILLS_URL, () => HttpResponse.json(catalog)),
      http.get(BOARDS_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })),
    );

    renderWithProviders(<FactorySkillsSection factoryId="fp-1" />);

    expect(await screen.findByText(/Installed boards could not be loaded/)).toBeInTheDocument();
    expect(screen.getByText('factory-triage')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: / board$/ })).not.toBeInTheDocument();
  });

  it('surfaces a load failure from the server', async () => {
    server.use(http.get(SKILLS_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

    renderWithProviders(<FactorySkillsSection />);

    expect(await screen.findByText(/boom|Failed to load skills/)).toBeInTheDocument();
  });
});
