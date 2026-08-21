import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { FactorySkillsResponse } from '../../../../../api/types';
import { FactorySkillsSection } from '../FactorySkillsSection';

const SKILLS_URL = `${TEST_BASE_URL}/web/factory/skills`;

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

  it('surfaces a load failure from the server', async () => {
    server.use(http.get(SKILLS_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

    renderWithProviders(<FactorySkillsSection />);

    expect(await screen.findByText(/boom|Failed to load skills/)).toBeInTheDocument();
  });
});
