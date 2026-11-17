import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { builtinBoardCatalog } from '../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../e2e/ui/render';
import type { BoardCatalogResponse, FactorySkillInfo, FactorySkillsResponse } from '../../../../api/types';
import { FactorySkillsSection } from '../components/FactorySkillsSection';

const SKILLS_URL = `${TEST_BASE_URL}/web/factory/skills`;
const BOARDS_URL = `${TEST_BASE_URL}/web/factory/projects/fp-1/boards`;
const SKILL_URL = `${TEST_BASE_URL}/web/factory/projects/fp-1/skills/:name`;
const CREATE_URL = `${TEST_BASE_URL}/web/factory/projects/fp-1/skills`;

const bundled = { origin: 'bundled', builtIn: true } as const;

/** Skills the Work board's phases run (their settings show them), plus two no board runs. */
const skills: FactorySkillInfo[] = [
  { name: 'factory-triage', description: 'Triage an issue', content: '# Triage', ...bundled },
  { name: 'factory-plan', description: 'Plan the work', content: '# Plan', ...bundled },
  { name: 'factory-review', description: 'Review a pull request', content: '# Review', ...bundled },
  {
    name: 'configure-factory-rules',
    description: 'Configure board rules',
    content: '# Configure rules\n\nWrite the rules a board follows.',
    ...bundled,
  },
  {
    name: 'changelog-lint',
    description: 'Lint changelogs',
    content: '# Lint',
    origin: 'folder',
    builtIn: false,
  },
];

function serve({
  catalog = skills,
  boards = builtinBoardCatalog,
  canEdit = true,
}: { catalog?: FactorySkillInfo[]; boards?: BoardCatalogResponse; canEdit?: boolean } = {}) {
  let current = catalog.map(skill => ({ ...skill }));
  const writes: { method: string; name: string; content?: string }[] = [];
  server.use(
    http.get(BOARDS_URL, () => HttpResponse.json(boards)),
    http.get(SKILLS_URL, () => HttpResponse.json({ skills: current, canEdit } satisfies FactorySkillsResponse)),
    http.put(SKILL_URL, async ({ request, params }) => {
      const { content } = (await request.json()) as { content: string };
      const name = String(params.name);
      writes.push({ method: 'PUT', name, content });
      if (!content.includes(`name: ${JSON.stringify(name)}\n`)) {
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
    http.post(CREATE_URL, async ({ request }) => {
      const { name, content } = (await request.json()) as { name: string; content: string };
      writes.push({ method: 'POST', name, content });
      if (current.some(skill => skill.name === name)) {
        return HttpResponse.json(
          { error: 'skill_exists', message: `A skill named "${name}" already exists. Edit it instead.` },
          { status: 409 },
        );
      }
      const description = JSON.parse(/^description: (.*)$/m.exec(content)![1]) as string;
      const created: FactorySkillInfo = {
        name,
        description,
        content: content.slice(content.indexOf('\n---\n') + 5).trim(),
        origin: 'project',
        builtIn: false,
        created: { updatedBy: 'admin-1', updatedAt: '2026-11-17T00:00:00.000Z' },
      };
      current = [...current, created];
      return HttpResponse.json({ skill: created }, { status: 201 });
    }),
    http.delete(SKILL_URL, ({ params }) => {
      const name = String(params.name);
      writes.push({ method: 'DELETE', name });
      if (current.find(skill => skill.name === name)?.origin === 'project') {
        current = current.filter(skill => skill.name !== name);
        return HttpResponse.json({ skill: null });
      }
      const original = catalog.find(skill => skill.name === name)!;
      current = current.map(skill =>
        skill.name === name ? { ...original, edited: undefined, originalChanged: undefined } : skill,
      );
      return HttpResponse.json({ skill: original });
    }),
  );
  return { writes };
}

function renderSection(factoryId: string | undefined = 'fp-1') {
  return renderWithProviders(<FactorySkillsSection factoryId={factoryId} />);
}

function card(name: string) {
  return screen.getByRole('button', { name: new RegExp(`^${name}`) });
}

describe('FactorySkillsSection', () => {
  it('lists only the skills no board phase runs', async () => {
    serve();
    renderSection();

    expect(await screen.findByRole('button', { name: /^configure-factory-rules/ })).toBeInTheDocument();
    expect(card('changelog-lint')).toBeInTheDocument();
    // Board phases' skills are on their phase pages.
    for (const name of ['factory-triage', 'factory-plan', 'factory-review']) {
      expect(screen.queryByText(name)).not.toBeInTheDocument();
    }
  });

  it('leaves out a skill a custom board phase runs', async () => {
    const notes: BoardCatalogResponse['boards'][number] = {
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
          skill: 'changelog-lint',
          transitions: [],
        },
      ],
    };
    serve({ boards: { boards: [notes, ...builtinBoardCatalog.boards] } });
    renderSection();

    expect(await screen.findByRole('button', { name: /^configure-factory-rules/ })).toBeInTheDocument();
    expect(screen.queryByText('changelog-lint')).not.toBeInTheDocument();
  });

  it('says so when every skill runs in a board phase', async () => {
    serve({ catalog: skills.filter(skill => skill.name.startsWith('factory-')) });
    renderSection();

    expect(await screen.findByText('Every skill runs in a board phase.')).toBeInTheDocument();
  });

  it("lists every skill, saying why, when the installed boards can't be loaded", async () => {
    serve();
    server.use(http.get(BOARDS_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    renderSection();

    expect(await screen.findByText(/Installed boards could not be loaded/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /^configure-factory-rules/ })).toBeInTheDocument();
    expect(card('factory-plan')).toBeInTheDocument();
  });

  it('marks a skill the runtime cannot load as failed and keeps its body readable', async () => {
    const error = 'Invalid frontmatter: incomplete explicit mapping pair; a key node is missed';
    serve({
      catalog: skills.map(skill =>
        skill.name === 'configure-factory-rules' ? { ...skill, description: '', error } : skill,
      ),
    });
    const user = userEvent.setup();
    renderSection();

    const trigger = await screen.findByRole('button', { name: /^configure-factory-rules/ });
    expect(within(trigger).getByText('Failed to load')).toBeInTheDocument();
    expect(within(trigger).getByText(`Agents cannot load this skill: ${error}`)).toBeInTheDocument();
    expect(within(card('changelog-lint')).queryByText('Failed to load')).not.toBeInTheDocument();

    await user.click(trigger);
    expect(await screen.findByText(/Write the rules a board follows/)).toBeInTheDocument();
  });

  it('flags a built-in skill the app overrides', async () => {
    serve({
      catalog: skills.map(skill =>
        skill.name === 'configure-factory-rules' ? { ...skill, origin: 'folder' as const } : skill,
      ),
    });
    renderSection();

    expect(await screen.findByRole('button', { name: /^configure-factory-rules/ })).toHaveTextContent(
      'Overridden by app',
    );
    expect(card('changelog-lint')).not.toHaveTextContent('Overridden by app');
  });

  it('expands a skill and toggles between rendered markdown and raw source, reopening formatted', async () => {
    serve();
    const user = userEvent.setup();
    renderSection();

    const trigger = await screen.findByRole('button', { name: /^configure-factory-rules/ });
    expect(screen.queryByText(/Write the rules a board follows/)).not.toBeInTheDocument();
    await user.click(trigger);
    expect(await screen.findByRole('heading', { name: 'Configure rules' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show raw' }));
    expect(screen.queryByRole('heading', { name: 'Configure rules' })).not.toBeInTheDocument();
    expect(screen.getByText(/# Configure rules/)).toBeInTheDocument();

    await user.click(trigger);
    await user.click(trigger);
    expect(await screen.findByRole('heading', { name: 'Configure rules' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show raw' })).toBeInTheDocument();
  });

  describe('when a skill is opened in the editor', () => {
    it("saves an admin's edit for this Factory and marks the skill edited", async () => {
      const { writes } = serve();
      const user = userEvent.setup();
      renderSection();

      await user.click(await screen.findByRole('button', { name: 'Edit changelog-lint' }));
      const dialog = await screen.findByRole('dialog', { name: 'Edit skill' });
      expect(within(dialog).getByRole('group', { name: 'Name' })).toHaveTextContent('changelog-lint');
      expect(within(dialog).queryByDisplayValue('changelog-lint')).not.toBeInTheDocument();
      const save = within(dialog).getByRole('button', { name: 'Save' });
      expect(save).toBeDisabled();
      const description = within(dialog).getByRole('textbox', { name: 'Description' });
      await user.clear(description);
      await user.type(description, 'Our lint: check # first');
      await user.click(save);

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(writes).toEqual([
        {
          method: 'PUT',
          name: 'changelog-lint',
          content: '---\nname: "changelog-lint"\ndescription: "Our lint: check # first"\n---\n\n# Lint\n',
        },
      ]);
      expect(await within(card('changelog-lint')).findByText('Edited')).toBeInTheDocument();
      expect(within(card('changelog-lint')).getByText('Our lint: check # first')).toBeInTheDocument();
    });

    it('keeps frontmatter fields the editor does not show when saving', async () => {
      const { writes } = serve({
        catalog: skills.map(skill =>
          skill.name === 'changelog-lint'
            ? { ...skill, frontmatter: { license: 'MIT', 'user-invocable': false } }
            : skill,
        ),
      });
      const user = userEvent.setup();
      renderSection();

      await user.click(await screen.findByRole('button', { name: 'Edit changelog-lint' }));
      const dialog = await screen.findByRole('dialog', { name: 'Edit skill' });
      await user.type(within(dialog).getByRole('textbox', { name: 'Description' }), '!');
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0].content).toContain('\nlicense: "MIT"\nuser-invocable: false\n---\n');
    });

    it('shows why the server rejected a save and keeps the editor open', async () => {
      serve();
      server.use(
        http.put(SKILL_URL, () =>
          HttpResponse.json(
            { error: 'invalid_skill', message: 'description: Description must be 1024 characters or less' },
            { status: 400 },
          ),
        ),
      );
      const user = userEvent.setup();
      renderSection();

      await user.click(await screen.findByRole('button', { name: 'Edit configure-factory-rules' }));
      const dialog = await screen.findByRole('dialog', { name: 'Edit skill' });
      await user.type(within(dialog).getByRole('textbox', { name: 'Description' }), ' and more');
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Description must be 1024 characters or less');
      expect(screen.getByRole('dialog', { name: 'Edit skill' })).toBeInTheDocument();
    });

    it('reverts an edited skill to the original', async () => {
      const { writes } = serve({
        catalog: skills.map(skill =>
          skill.name === 'configure-factory-rules'
            ? { ...skill, edited: { updatedBy: 'admin-1', updatedAt: '2026-10-29T00:00:00.000Z' } }
            : skill,
        ),
      });
      const user = userEvent.setup();
      renderSection();

      expect(
        await within(await screen.findByRole('button', { name: /^configure-factory-rules/ })).findByText('Edited'),
      ).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Edit configure-factory-rules' }));
      const dialog = await screen.findByRole('dialog', { name: 'Edit skill' });
      await user.click(within(dialog).getByRole('button', { name: 'Revert to original' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(writes).toEqual([{ method: 'DELETE', name: 'configure-factory-rules' }]);
      await waitFor(() =>
        expect(within(card('configure-factory-rules')).queryByText('Edited')).not.toBeInTheDocument(),
      );
    });

    it('offers no revert for a skill this Factory has not edited', async () => {
      serve();
      const user = userEvent.setup();
      renderSection();

      await user.click(await screen.findByRole('button', { name: 'Edit configure-factory-rules' }));
      const dialog = await screen.findByRole('dialog', { name: 'Edit skill' });
      expect(within(dialog).queryByRole('button', { name: 'Revert to original' })).not.toBeInTheDocument();
    });

    it('says when the original changed since the edit', async () => {
      serve({
        catalog: skills.map(skill =>
          skill.name === 'configure-factory-rules'
            ? {
                ...skill,
                edited: { updatedBy: 'admin-1', updatedAt: '2026-10-29T00:00:00.000Z' },
                originalChanged: true,
              }
            : skill,
        ),
      });
      const user = userEvent.setup();
      renderSection();

      await user.click(await screen.findByRole('button', { name: 'Edit configure-factory-rules' }));
      const dialog = await screen.findByRole('dialog', { name: 'Edit skill' });
      expect(within(dialog).getByRole('note')).toHaveTextContent('The original changed since this was edited');
    });

    it('shows members who are not admins the skill read-only with the reason', async () => {
      const { writes } = serve({ canEdit: false });
      const user = userEvent.setup();
      renderSection();

      expect(await screen.findByRole('button', { name: 'View configure-factory-rules' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit configure-factory-rules' })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'View configure-factory-rules' }));
      const dialog = await screen.findByRole('dialog', { name: 'View skill' });
      expect(within(dialog).getByText('Only organization admins can edit skills.')).toBeInTheDocument();
      expect(within(dialog).getByRole('group', { name: 'Description' })).toHaveTextContent('Configure board rules');
      expect(within(dialog).queryAllByRole('textbox')).toEqual([]);
      expect(within(dialog).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('button', { name: 'Revert to original' })).not.toBeInTheDocument();
      expect(writes).toEqual([]);
    });

    it('discards unsaved edits when the editor is closed and reopened', async () => {
      serve();
      const user = userEvent.setup();
      renderSection();

      await user.click(await screen.findByRole('button', { name: 'Edit changelog-lint' }));
      let dialog = await screen.findByRole('dialog', { name: 'Edit skill' });
      await user.type(within(dialog).getByRole('textbox', { name: 'Description' }), ' locally');
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: 'Edit changelog-lint' }));
      dialog = await screen.findByRole('dialog', { name: 'Edit skill' });
      expect(within(dialog).getByDisplayValue('Lint changelogs')).toBeInTheDocument();
    });
  });

  describe('creating a skill', () => {
    it('creates a skill for this Factory and lists it as custom', async () => {
      const { writes } = serve();
      const user = userEvent.setup();
      const { client } = renderSection();

      await user.click(await screen.findByRole('button', { name: 'New skill' }));
      const dialog = await screen.findByRole('dialog', { name: 'New skill' });
      const create = within(dialog).getByRole('button', { name: 'Create' });
      expect(create).toBeDisabled();
      await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'release-notes');
      expect(create).toBeDisabled();
      await user.type(within(dialog).getByRole('textbox', { name: 'Description' }), 'Write notes: what # changed');
      await user.click(create);

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(writes).toEqual([
        {
          method: 'POST',
          name: 'release-notes',
          content: '---\nname: "release-notes"\ndescription: "Write notes: what # changed"\n---\n\n\n',
        },
      ]);
      const created = await screen.findByRole('button', { name: /^release-notes/ });
      expect(within(created).getByText('Custom')).toBeInTheDocument();
      expect(within(card('changelog-lint')).queryByText('Custom')).not.toBeInTheDocument();
      await waitForMutationsIdle(client);
    });

    it('keeps an all-digit name a string in the SKILL.md it sends', async () => {
      const { writes } = serve();
      const user = userEvent.setup();
      const { client } = renderSection();

      await user.click(await screen.findByRole('button', { name: 'New skill' }));
      const dialog = await screen.findByRole('dialog', { name: 'New skill' });
      await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), '123');
      await user.type(within(dialog).getByRole('textbox', { name: 'Description' }), 'Numbered');
      await user.click(within(dialog).getByRole('button', { name: 'Create' }));

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]).toMatchObject({ method: 'POST', name: '123' });
      expect(writes[0].content).toMatch(/^---\nname: "123"\n/);
      await waitForMutationsIdle(client);
    });

    it('explains a name agents cannot use and keeps Create disabled', async () => {
      const { writes } = serve();
      const user = userEvent.setup();
      renderSection();

      await user.click(await screen.findByRole('button', { name: 'New skill' }));
      const dialog = await screen.findByRole('dialog', { name: 'New skill' });
      await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Release_Notes');
      await user.type(within(dialog).getByRole('textbox', { name: 'Description' }), 'Write release notes');

      expect(within(dialog).getByText(/lowercase letters, digits, and single hyphens/)).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Create' })).toBeDisabled();
      expect(writes).toEqual([]);
    });

    it('shows why the server refused it and keeps the editor open', async () => {
      serve();
      const user = userEvent.setup();
      const { client } = renderSection();

      await user.click(await screen.findByRole('button', { name: 'New skill' }));
      const dialog = await screen.findByRole('dialog', { name: 'New skill' });
      await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'changelog-lint');
      await user.type(within(dialog).getByRole('textbox', { name: 'Description' }), 'Mine');
      await user.click(within(dialog).getByRole('button', { name: 'Create' }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'A skill named "changelog-lint" already exists. Edit it instead.',
      );
      expect(screen.getByRole('dialog', { name: 'New skill' })).toBeInTheDocument();
      await waitForMutationsIdle(client);
    });

    it('offers no New skill to members who are not admins', async () => {
      serve({ canEdit: false });
      renderSection();

      expect(await screen.findByRole('button', { name: 'View configure-factory-rules' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'New skill' })).not.toBeInTheDocument();
    });
  });

  it('deletes a skill this Factory created once confirmed, and offers no revert for it', async () => {
    const releaseNotes: FactorySkillInfo = {
      name: 'release-notes',
      description: 'Write release notes',
      content: '# Notes',
      origin: 'project',
      builtIn: false,
      created: { updatedBy: 'admin-1', updatedAt: '2026-11-17T00:00:00.000Z' },
    };
    const { writes } = serve({ catalog: [...skills, releaseNotes] });
    const user = userEvent.setup();
    const { client } = renderSection();

    await user.click(await screen.findByRole('button', { name: 'Edit release-notes' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit skill' });
    expect(within(dialog).queryByRole('button', { name: 'Revert to original' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(within(dialog).getByText(/Delete release-notes\?/)).toBeInTheDocument();
    expect(writes).toEqual([]);

    // Keep backs out without deleting.
    await user.click(within(dialog).getByRole('button', { name: 'Keep' }));
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await user.click(within(dialog).getByRole('button', { name: 'Delete skill' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes).toEqual([{ method: 'DELETE', name: 'release-notes' }]);
    await waitFor(() => expect(screen.queryByRole('button', { name: /^release-notes/ })).not.toBeInTheDocument());
    await waitForMutationsIdle(client);
  });

  it('surfaces a load failure from the server', async () => {
    serve();
    server.use(http.get(SKILLS_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    renderSection();

    expect(await screen.findByText(/boom|Failed to load skills/)).toBeInTheDocument();
  });
});
