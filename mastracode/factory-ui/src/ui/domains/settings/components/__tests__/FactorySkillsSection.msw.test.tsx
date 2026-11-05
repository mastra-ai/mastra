import { screen, waitFor, within } from '@testing-library/react';
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

  it('marks a skill the runtime cannot load as failed and shows the parse error', async () => {
    const error = 'Invalid frontmatter: incomplete explicit mapping pair; a key node is missed';
    server.use(
      http.get(SKILLS_URL, () =>
        HttpResponse.json({
          skills: catalog.skills.map(skill =>
            skill.name === 'factory-triage' ? { ...skill, description: '', error } : skill,
          ),
        } satisfies FactorySkillsResponse),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<FactorySkillsSection />);

    const trigger = await screen.findByRole('button', { name: /Triage/ });
    expect(within(trigger).getByText('Failed to load')).toBeInTheDocument();
    expect(within(trigger).getByText(`Agents cannot load this skill: ${error}`)).toBeInTheDocument();
    // Healthy skills render normally.
    const planning = screen.getByRole('button', { name: /Planning/ });
    expect(within(planning).queryByText('Failed to load')).not.toBeInTheDocument();
    expect(within(planning).getByText(/phased implementation plan/)).toBeInTheDocument();

    // The SKILL.md body stays readable so the user can find and fix the file.
    await user.click(trigger);
    expect(await screen.findByText(/Trace history and diagnose/)).toBeInTheDocument();
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
    expect(within(release).getByText(/defined in code by the board definition/)).toBeInTheDocument();
    expect(within(release).queryByText(/factory-/)).not.toBeInTheDocument();

    // Built-ins come first regardless of registry order.
    const regions = screen.getAllByRole('region', { name: / board$/ }).map(region => region.getAttribute('aria-label'));
    expect(regions).toEqual(['Work board', 'Review board', 'Release Preview board']);
  });

  it('shows the app skill each custom phase runs, flags a missing one, and lists unused app skills', async () => {
    const notesBoard: BoardCatalogResponse['boards'][number] = {
      id: 'notes',
      name: 'Notes',
      title: 'Notes',
      initialPhase: 'queued',
      phases: [
        { id: 'queued', title: 'Queued', kind: 'resting', transitions: [{ outcome: null, to: 'drafting' }] },
        {
          id: 'drafting',
          name: 'Drafting',
          title: 'Drafting',
          kind: 'working',
          context: 'build',
          skill: 'release-notes',
          transitions: [{ outcome: null, to: 'publishing' }],
        },
        {
          id: 'publishing',
          name: 'Publishing',
          title: 'Publishing',
          kind: 'working',
          context: 'build',
          skill: 'publish-notes',
          transitions: [{ outcome: null, to: 'linting' }],
        },
        { id: 'linting', title: 'Linting', kind: 'working', context: 'lint', transitions: [] },
      ],
    };
    server.use(
      http.get(SKILLS_URL, () =>
        HttpResponse.json({
          skills: [
            ...catalog.skills.map(skill =>
              skill.name === 'factory-plan'
                ? { ...skill, content: '# Our plan', origin: 'folder' as const, builtIn: true }
                : { ...skill, origin: 'bundled' as const, builtIn: true },
            ),
            {
              name: 'release-notes',
              description: 'Draft the release notes',
              content: '# Release notes\n\nGroup changes by package.',
              origin: 'code',
              builtIn: false,
            },
            {
              name: 'changelog-lint',
              description: 'Lint changelogs',
              content: '# Lint',
              origin: 'folder',
              builtIn: false,
            },
          ],
        } satisfies FactorySkillsResponse),
      ),
      http.get(BOARDS_URL, () =>
        HttpResponse.json({ boards: [notesBoard, ...builtinBoardCatalog.boards] } satisfies BoardCatalogResponse),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<FactorySkillsSection factoryId="fp-1" />);

    const notes = await screen.findByRole('region', { name: 'Notes board' });
    const drafting = within(notes).getByRole('button', { name: /Drafting/ });
    expect(within(drafting).getByText('release-notes')).toBeInTheDocument();
    expect(within(drafting).getByText('Draft the release notes')).toBeInTheDocument();
    await user.click(drafting);
    expect(await within(notes).findByText(/Group changes by package/)).toBeInTheDocument();

    expect(within(notes).getByText('publish-notes')).toBeInTheDocument();
    expect(within(notes).getByText('Not found')).toBeInTheDocument();
    // The phase without a skill still lists its role.
    expect(within(notes).getByText('lint')).toBeInTheDocument();

    const work = screen.getByRole('region', { name: 'Work board' });
    expect(within(work).getByRole('button', { name: /Planning/ })).toHaveTextContent('Overridden by app');
    expect(within(work).getByRole('button', { name: /Triage/ })).not.toHaveTextContent('Overridden by app');

    const appSkills = screen.getByRole('region', { name: 'App skills' });
    expect(within(appSkills).getAllByText('changelog-lint').length).toBeGreaterThan(0);
    expect(within(appSkills).queryByText('release-notes')).not.toBeInTheDocument();
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

  it('reports an empty catalog instead of pretending built-in boards exist, and still lists app skills', async () => {
    server.use(
      http.get(SKILLS_URL, () =>
        HttpResponse.json({
          skills: [
            ...catalog.skills,
            {
              name: 'changelog-lint',
              description: 'Lint changelogs',
              content: '# Lint',
              origin: 'folder',
              builtIn: false,
            },
          ],
        } satisfies FactorySkillsResponse),
      ),
      http.get(BOARDS_URL, () => HttpResponse.json({ boards: [] } satisfies BoardCatalogResponse)),
    );

    renderWithProviders(<FactorySkillsSection factoryId="fp-1" />);

    expect(await screen.findByText('No boards are installed, so no board skills apply.')).toBeInTheDocument();
    expect(screen.queryByText('factory-triage')).not.toBeInTheDocument();
    const appSkills = await screen.findByRole('region', { name: 'App skills' });
    expect(within(appSkills).getAllByText('changelog-lint').length).toBeGreaterThan(0);
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

  it('does not call a phase skill missing when the skills catalog failed to load', async () => {
    const notesBoard: BoardCatalogResponse['boards'][number] = {
      id: 'notes',
      name: 'Notes',
      title: 'Notes',
      initialPhase: 'queued',
      phases: [
        { id: 'queued', title: 'Queued', kind: 'resting', transitions: [{ outcome: null, to: 'drafting' }] },
        {
          id: 'drafting',
          name: 'Drafting',
          title: 'Drafting',
          kind: 'working',
          context: 'build',
          skill: 'release-notes',
          transitions: [],
        },
      ],
    };
    server.use(
      http.get(SKILLS_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })),
      http.get(BOARDS_URL, () => HttpResponse.json({ boards: [notesBoard] } satisfies BoardCatalogResponse)),
    );

    renderWithProviders(<FactorySkillsSection factoryId="fp-1" />);

    expect(await screen.findByText(/boom|Failed to load skills/)).toBeInTheDocument();
    const notes = await screen.findByRole('region', { name: 'Notes board' });
    expect(within(notes).getByText('release-notes')).toBeInTheDocument();
    expect(within(notes).queryByText('Not found')).not.toBeInTheDocument();
  });

  describe('when a skill is opened in the editor', () => {
    const SKILL_URL = `${TEST_BASE_URL}/web/factory/projects/fp-1/skills/:name`;

    /** A server holding one Factory's skill edits, answering like the real routes. */
    function serveFactory({ canEdit = true, skills = catalog.skills } = {}) {
      let current = skills.map(skill => ({ ...skill }));
      const writes: { method: string; name: string; content?: string }[] = [];
      const queries: (string | null)[] = [];
      server.use(
        http.get(BOARDS_URL, () => HttpResponse.json(builtinBoardCatalog)),
        http.get(SKILLS_URL, ({ request }) => {
          queries.push(new URL(request.url).searchParams.get('projectId'));
          return HttpResponse.json({ skills: current, canEdit } satisfies FactorySkillsResponse);
        }),
        http.put(SKILL_URL, async ({ request, params }) => {
          const { content } = (await request.json()) as { content: string };
          const name = String(params.name);
          writes.push({ method: 'PUT', name, content });
          if (!content.includes(`name: ${name}\n`)) {
            return HttpResponse.json({ error: 'invalid_skill', message: 'name must match' }, { status: 400 });
          }
          const description = JSON.parse(/^description: (.*)$/m.exec(content)![1]) as string;
          const body = content.slice(content.indexOf('\n---\n') + 5).trim();
          current = current.map(skill =>
            skill.name === name
              ? {
                  ...skill,
                  description,
                  content: body,
                  edited: { updatedBy: 'admin-1', updatedAt: '2026-10-29T00:00:00.000Z' },
                  originalChanged: false,
                }
              : skill,
          );
          return HttpResponse.json({ skill: current.find(skill => skill.name === name) });
        }),
        http.delete(SKILL_URL, ({ params }) => {
          const name = String(params.name);
          writes.push({ method: 'DELETE', name });
          const original = skills.find(skill => skill.name === name)!;
          current = current.map(skill =>
            skill.name === name ? { ...original, edited: undefined, originalChanged: undefined } : skill,
          );
          return HttpResponse.json({ skill: original });
        }),
      );
      return { writes, queries };
    }

    function triageCard() {
      return screen.getByRole('button', { name: /Triage/ }).parentElement!;
    }

    it("saves an admin's edit for this Factory and marks the skill edited", async () => {
      const { writes, queries } = serveFactory();
      const user = userEvent.setup();
      renderWithProviders(<FactorySkillsSection factoryId="fp-1" />);

      await user.click(await screen.findByRole('button', { name: 'Edit factory-triage' }));
      const dialog = await screen.findByRole('dialog', { name: 'Edit skill' });
      expect(within(dialog).getByDisplayValue('factory-triage')).toBeDisabled();
      const save = within(dialog).getByRole('button', { name: 'Save' });
      expect(save).toBeDisabled();
      const description = within(dialog).getByRole('textbox', { name: 'Description' });
      await user.clear(description);
      await user.type(description, 'Our triage: find the cause # first');
      await user.click(save);

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(queries[0]).toBe('fp-1');
      expect(writes).toEqual([
        {
          method: 'PUT',
          name: 'factory-triage',
          content:
            '---\nname: factory-triage\ndescription: "Our triage: find the cause # first"\n---\n\n# Triage\n\nTrace history and diagnose the root cause.\n',
        },
      ]);
      expect(await within(triageCard()).findByText('Edited')).toBeInTheDocument();
      expect(within(triageCard()).getByText('Our triage: find the cause # first')).toBeInTheDocument();
    });

    it('keeps frontmatter fields the editor does not show when saving', async () => {
      const { writes } = serveFactory({
        skills: catalog.skills.map(skill =>
          skill.name === 'factory-triage'
            ? { ...skill, frontmatter: { license: 'MIT', 'user-invocable': false } }
            : skill,
        ),
      });
      const user = userEvent.setup();
      renderWithProviders(<FactorySkillsSection factoryId="fp-1" />);

      await user.click(await screen.findByRole('button', { name: 'Edit factory-triage' }));
      const dialog = await screen.findByRole('dialog', { name: 'Edit skill' });
      await user.type(within(dialog).getByRole('textbox', { name: 'Description' }), '!');
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0].content).toContain('\nlicense: "MIT"\nuser-invocable: false\n---\n');
    });

    it('shows why the server rejected a save and keeps the editor open', async () => {
      serveFactory();
      server.use(
        http.put(SKILL_URL, () =>
          HttpResponse.json(
            { error: 'invalid_skill', message: 'description: Description must be 1024 characters or less' },
            { status: 400 },
          ),
        ),
      );
      const user = userEvent.setup();
      renderWithProviders(<FactorySkillsSection factoryId="fp-1" />);

      await user.click(await screen.findByRole('button', { name: 'Edit factory-plan' }));
      const dialog = await screen.findByRole('dialog', { name: 'Edit skill' });
      await user.type(within(dialog).getByRole('textbox', { name: 'Description' }), ' and more');
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Description must be 1024 characters or less');
      expect(screen.getByRole('dialog', { name: 'Edit skill' })).toBeInTheDocument();
    });

    it('reverts an edited skill to the original', async () => {
      const { writes } = serveFactory({
        skills: catalog.skills.map(skill =>
          skill.name === 'factory-triage'
            ? { ...skill, edited: { updatedBy: 'admin-1', updatedAt: '2026-10-29T00:00:00.000Z' } }
            : skill,
        ),
      });
      const user = userEvent.setup();
      renderWithProviders(<FactorySkillsSection factoryId="fp-1" />);

      expect(
        await within(await screen.findByRole('button', { name: /Triage/ })).findByText('Edited'),
      ).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Edit factory-triage' }));
      const dialog = await screen.findByRole('dialog', { name: 'Edit skill' });
      await user.click(within(dialog).getByRole('button', { name: 'Revert to original' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(writes).toEqual([{ method: 'DELETE', name: 'factory-triage' }]);
      await waitFor(() => expect(within(triageCard()).queryByText('Edited')).not.toBeInTheDocument());
    });

    it('offers no revert for a skill this Factory has not edited', async () => {
      serveFactory();
      const user = userEvent.setup();
      renderWithProviders(<FactorySkillsSection factoryId="fp-1" />);

      await user.click(await screen.findByRole('button', { name: 'Edit factory-plan' }));
      const dialog = await screen.findByRole('dialog', { name: 'Edit skill' });
      expect(within(dialog).queryByRole('button', { name: 'Revert to original' })).not.toBeInTheDocument();
    });

    it('says when the original changed since the edit', async () => {
      serveFactory({
        skills: catalog.skills.map(skill =>
          skill.name === 'factory-plan'
            ? {
                ...skill,
                edited: { updatedBy: 'admin-1', updatedAt: '2026-10-29T00:00:00.000Z' },
                originalChanged: true,
              }
            : skill,
        ),
      });
      const user = userEvent.setup();
      renderWithProviders(<FactorySkillsSection factoryId="fp-1" />);

      await user.click(await screen.findByRole('button', { name: 'Edit factory-plan' }));
      const dialog = await screen.findByRole('dialog', { name: 'Edit skill' });
      expect(within(dialog).getByRole('note')).toHaveTextContent('The original changed since this was edited');
    });

    it('shows members who are not admins the skill read-only with the reason', async () => {
      const { writes } = serveFactory({ canEdit: false });
      const user = userEvent.setup();
      renderWithProviders(<FactorySkillsSection factoryId="fp-1" />);

      expect(await screen.findByRole('button', { name: 'View factory-plan' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit factory-plan' })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'View factory-plan' }));
      const dialog = await screen.findByRole('dialog', { name: 'View skill' });
      expect(within(dialog).getByText('Only organization admins can edit skills.')).toBeInTheDocument();
      expect(within(dialog).getByDisplayValue(catalog.skills[1].description)).toBeDisabled();
      expect(within(dialog).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('button', { name: 'Revert to original' })).not.toBeInTheDocument();
      expect(writes).toEqual([]);
    });

    it('discards unsaved edits when the editor is closed and reopened', async () => {
      serveFactory();
      const user = userEvent.setup();
      renderWithProviders(<FactorySkillsSection factoryId="fp-1" />);

      await user.click(await screen.findByRole('button', { name: 'Edit factory-review' }));
      let dialog = await screen.findByRole('dialog', { name: 'Edit skill' });
      await user.type(within(dialog).getByRole('textbox', { name: 'Description' }), ' locally');
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: 'Edit factory-review' }));
      dialog = await screen.findByRole('dialog', { name: 'Edit skill' });
      expect(within(dialog).getByDisplayValue('Review a Factory work item PR')).toBeInTheDocument();
    });
  });

  it('surfaces a load failure from the server', async () => {
    server.use(http.get(SKILLS_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

    renderWithProviders(<FactorySkillsSection />);

    expect(await screen.findByText(/boom|Failed to load skills/)).toBeInTheDocument();
  });
});
