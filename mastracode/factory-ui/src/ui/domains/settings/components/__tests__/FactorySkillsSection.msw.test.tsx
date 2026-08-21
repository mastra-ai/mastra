import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { FactorySkillsResponse, UpdateFactorySkillBody } from '../../../../../api/types';
import { FactorySkillsSection } from '../FactorySkillsSection';

const SKILLS_URL = `${TEST_BASE_URL}/web/factory/skills`;

const catalog: FactorySkillsResponse = {
  skills: [
    {
      name: 'factory-triage',
      description: "Triage a Factory work item's issue — diagnose root cause, then advance the stage",
      content: '# Triage\n\nTrace history and diagnose the root cause.',
      isCustomized: false,
    },
    {
      name: 'factory-plan',
      description: 'Produce a phased implementation plan for a Factory work item',
      content: '# Plan\n\nProduce a phased implementation plan.',
      isCustomized: false,
    },
    {
      name: 'factory-rereview',
      description: 'Re-review a Factory work item PR after changes',
      content: '# Re-review',
      isCustomized: false,
    },
    {
      name: 'factory-review',
      description: 'Review a Factory work item PR',
      content: '# Review',
      isCustomized: false,
    },
    {
      name: 'configure-factory-rules',
      description: 'Configure repository rules for Factory runs',
      content: '# Configure rules',
      isCustomized: false,
    },
  ],
};

/** Catalog served after a triage override is saved. */
function customizedCatalog(description: string, content: string): FactorySkillsResponse {
  return {
    skills: catalog.skills.map(skill =>
      skill.name === 'factory-triage' ? { ...skill, description, content, isCustomized: true } : skill,
    ),
  };
}

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

  it('expands a skill to reveal an editable form with its SKILL.md content', async () => {
    server.use(http.get(SKILLS_URL, () => HttpResponse.json(catalog)));

    const user = userEvent.setup();
    renderWithProviders(<FactorySkillsSection />);

    const trigger = await screen.findByRole('button', { name: /Triage/ });
    expect(screen.queryByLabelText('factory-triage instructions')).not.toBeInTheDocument();

    await user.click(trigger);
    const instructions = await screen.findByLabelText('factory-triage instructions');
    expect(instructions).toHaveValue('# Triage\n\nTrace history and diagnose the root cause.');
    expect(screen.getByLabelText('factory-triage description')).toHaveValue(
      "Triage a Factory work item's issue — diagnose root cause, then advance the stage",
    );
    // Pristine form: save disabled, no customization yet so no reset.
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Reset to default' })).not.toBeInTheDocument();
  });

  it('saves an edited skill and shows the Customized badge', async () => {
    let saved: (UpdateFactorySkillBody & { name: string }) | undefined;
    let currentCatalog = catalog;
    server.use(
      http.get(SKILLS_URL, () => HttpResponse.json(currentCatalog)),
      http.put(`${SKILLS_URL}/factory-triage`, async ({ request }) => {
        const body = (await request.json()) as UpdateFactorySkillBody;
        saved = { name: 'factory-triage', ...body };
        currentCatalog = customizedCatalog(body.description, body.content);
        return HttpResponse.json({
          skill: { name: 'factory-triage', ...body, isCustomized: true },
        });
      }),
    );

    const user = userEvent.setup();
    const { client } = renderWithProviders(<FactorySkillsSection />);

    await user.click(await screen.findByRole('button', { name: /Triage/ }));
    const instructions = await screen.findByLabelText('factory-triage instructions');
    await user.clear(instructions);
    await user.type(instructions, '# Custom triage');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitForMutationsIdle(client);
    expect(saved?.content).toBe('# Custom triage');
    expect(await screen.findByText('Customized')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Reset to default' })).toBeInTheDocument();
  });

  it('resets a customized skill back to the bundled default', async () => {
    let currentCatalog = customizedCatalog('Custom desc', '# Custom triage');
    let resetCalled = false;
    server.use(
      http.get(SKILLS_URL, () => HttpResponse.json(currentCatalog)),
      http.delete(`${SKILLS_URL}/factory-triage`, () => {
        resetCalled = true;
        currentCatalog = catalog;
        return HttpResponse.json({ skill: catalog.skills[0] });
      }),
    );

    const user = userEvent.setup();
    const { client } = renderWithProviders(<FactorySkillsSection />);

    expect(await screen.findByText('Customized')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Triage/ }));
    await user.click(await screen.findByRole('button', { name: 'Reset to default' }));

    await waitForMutationsIdle(client);
    expect(resetCalled).toBe(true);
    await waitFor(() => expect(screen.queryByText('Customized')).not.toBeInTheDocument());
    expect(screen.getByLabelText('factory-triage instructions')).toHaveValue(
      '# Triage\n\nTrace history and diagnose the root cause.',
    );
  });

  it('surfaces a save failure from the server', async () => {
    server.use(
      http.get(SKILLS_URL, () => HttpResponse.json(catalog)),
      http.put(`${SKILLS_URL}/factory-triage`, () => HttpResponse.json({ error: 'invalid_request' }, { status: 400 })),
    );

    const user = userEvent.setup();
    renderWithProviders(<FactorySkillsSection />);

    await user.click(await screen.findByRole('button', { name: /Triage/ }));
    const instructions = await screen.findByLabelText('factory-triage instructions');
    await user.clear(instructions);
    await user.type(instructions, '# Broken edit');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/invalid_request|Failed to save skill/)).toBeInTheDocument();
  });

  it('surfaces a load failure from the server', async () => {
    server.use(http.get(SKILLS_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

    renderWithProviders(<FactorySkillsSection />);

    expect(await screen.findByText(/boom|Failed to load skills/)).toBeInTheDocument();
  });
});
