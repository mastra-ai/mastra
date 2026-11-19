import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { builtinBoardCatalog } from '../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, waitForMutationsIdle } from '../../../../../e2e/ui/render';
import type { BoardCatalogResponse, FactorySkillInfo, FactorySkillsResponse } from '../../../../api/types';
import { FACTORY_ID, PROJECT_URL, renderAt, serveBoard, stubFactory } from './fixtures/factory-app';
import { storedWorkBoard } from './fixtures/work-board';

const SKILLS_URL = `${TEST_BASE_URL}/web/factory/skills`;
const BOARDS_URL = `${PROJECT_URL}/boards`;
const SKILL_URL = `${PROJECT_URL}/skills/:name`;
const CREATE_URL = `${PROJECT_URL}/skills`;

const SKILLS_PAGE = `/factories/${FACTORY_ID}/work/skills`;
const NEW_SKILL_PAGE = `/factories/${FACTORY_ID}/work/new-skill`;

const bundled = { origin: 'bundled', builtIn: true } as const;

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

const releaseNotes: FactorySkillInfo = {
  name: 'release-notes',
  description: 'Write release notes',
  content: '# Notes',
  origin: 'project',
  builtIn: false,
  created: { updatedBy: 'admin-1', updatedAt: '2026-11-17T00:00:00.000Z' },
};

const edited = { edited: { updatedBy: 'admin-1', updatedAt: '2026-10-29T00:00:00.000Z' } };

function parsedSkill(content: string): { description: string; body: string } {
  const line = /^description: (.*)$/m.exec(content)?.[1];
  if (line === undefined) throw new Error(`No description in ${content}`);
  const description: unknown = JSON.parse(line);
  if (typeof description !== 'string') throw new Error(`Description is not a string in ${content}`);
  return { description, body: content.slice(content.indexOf('\n---\n') + 5).trim() };
}

function openAt(
  path: string,
  {
    catalog = skills,
    boards = builtinBoardCatalog,
    canEdit = true,
  }: { catalog?: FactorySkillInfo[]; boards?: BoardCatalogResponse; canEdit?: boolean } = {},
) {
  stubFactory();
  serveBoard(storedWorkBoard());
  let current = catalog.map(skill => ({ ...skill }));
  const writes: { method: string; name: string; content?: string }[] = [];
  server.use(
    http.get(BOARDS_URL, () => HttpResponse.json(boards)),
    http.get(SKILLS_URL, () => HttpResponse.json({ skills: current, canEdit } satisfies FactorySkillsResponse)),
    http.put<{ name: string }, { content: string }>(SKILL_URL, async ({ request, params }) => {
      const { content } = await request.json();
      const { name } = params;
      writes.push({ method: 'PUT', name, content });
      if (!content.includes(`name: ${JSON.stringify(name)}\n`)) {
        return HttpResponse.json({ error: 'invalid_skill', message: 'name must match' }, { status: 400 });
      }
      const { description, body } = parsedSkill(content);
      current = current.map(skill =>
        skill.name === name ? { ...skill, description, content: body, ...edited, originalChanged: false } : skill,
      );
      return HttpResponse.json({ skill: current.find(skill => skill.name === name) });
    }),
    http.post<never, { name: string; content: string }>(CREATE_URL, async ({ request }) => {
      const { name, content } = await request.json();
      writes.push({ method: 'POST', name, content });
      if (current.some(skill => skill.name === name)) {
        return HttpResponse.json(
          { error: 'skill_exists', message: `A skill named "${name}" already exists. Edit it instead.` },
          { status: 409 },
        );
      }
      const { description, body } = parsedSkill(content);
      const created: FactorySkillInfo = {
        name,
        description,
        content: body,
        origin: 'project',
        builtIn: false,
        created: { updatedBy: 'admin-1', updatedAt: '2026-11-17T00:00:00.000Z' },
      };
      current = [...current, created];
      return HttpResponse.json({ skill: created }, { status: 201 });
    }),
    http.delete<{ name: string }>(SKILL_URL, ({ params }) => {
      const { name } = params;
      writes.push({ method: 'DELETE', name });
      if (current.find(skill => skill.name === name)?.origin === 'project') {
        current = current.filter(skill => skill.name !== name);
        return HttpResponse.json({ skill: null });
      }
      const original = skills.find(skill => skill.name === name);
      if (!original) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
      current = current.map(skill => (skill.name === name ? original : skill));
      return HttpResponse.json({ skill: original });
    }),
  );
  return { writes, ...renderAt(path) };
}

function card(name: string) {
  return screen.getByRole('link', { name: new RegExp(`^${name}`) });
}

describe('the skills page', () => {
  it('lists only the skills no board phase runs', async () => {
    openAt(SKILLS_PAGE);

    expect(await screen.findByRole('link', { name: /^configure-factory-rules/ })).toBeInTheDocument();
    expect(card('changelog-lint')).toBeInTheDocument();
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
    openAt(SKILLS_PAGE, { boards: { boards: [notes, ...builtinBoardCatalog.boards] } });

    expect(await screen.findByRole('link', { name: /^configure-factory-rules/ })).toBeInTheDocument();
    expect(screen.queryByText('changelog-lint')).not.toBeInTheDocument();
  });

  it('says so when every skill runs in a board phase', async () => {
    openAt(SKILLS_PAGE, { catalog: skills.filter(skill => skill.name.startsWith('factory-')) });

    expect(await screen.findByText('Every skill runs in a board phase.')).toBeInTheDocument();
  });

  it("lists every skill, saying why, when the installed boards can't be loaded", async () => {
    openAt(SKILLS_PAGE);
    server.use(http.get(BOARDS_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

    expect(await screen.findByText(/Installed boards could not be loaded/)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /^configure-factory-rules/ })).toBeInTheDocument();
    expect(card('factory-plan')).toBeInTheDocument();
  });

  it('marks a skill the runtime cannot load as failed and keeps its body readable on its page', async () => {
    const error = 'Invalid frontmatter: incomplete explicit mapping pair; a key node is missed';
    const { router } = openAt(SKILLS_PAGE, {
      catalog: skills.map(skill =>
        skill.name === 'configure-factory-rules' ? { ...skill, description: '', error } : skill,
      ),
    });
    const user = userEvent.setup();

    const failed = await screen.findByRole('link', { name: /^configure-factory-rules/ });
    expect(within(failed).getByText('Failed to load')).toBeInTheDocument();
    expect(within(failed).getByText(`Agents cannot load this skill: ${error}`)).toBeInTheDocument();
    expect(within(card('changelog-lint')).queryByText('Failed to load')).not.toBeInTheDocument();

    await user.click(failed);
    await waitFor(() => expect(router.state.location.pathname).toBe(`${SKILLS_PAGE}/configure-factory-rules`));
    expect(await screen.findByRole('alert')).toHaveTextContent(`Agents cannot load this skill: ${error}`);
    expect(screen.getByRole('textbox', { name: 'Instructions' })).toHaveTextContent(/Write the rules a board follows/);
  });

  it('flags a built-in skill the app overrides', async () => {
    openAt(SKILLS_PAGE, {
      catalog: skills.map(skill =>
        skill.name === 'configure-factory-rules' ? { ...skill, origin: 'folder' as const } : skill,
      ),
    });

    expect(await screen.findByRole('link', { name: /^configure-factory-rules/ })).toHaveTextContent(
      'Overridden by app',
    );
    expect(card('changelog-lint')).not.toHaveTextContent('Overridden by app');
  });

  it('surfaces a load failure from the server', async () => {
    openAt(SKILLS_PAGE);
    server.use(http.get(SKILLS_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

    expect(await screen.findByText(/boom|Failed to load skills/)).toBeInTheDocument();
  });
});

describe("a skill's page", () => {
  it("saves an admin's edit for this Factory in place, and the list shows it edited", async () => {
    const { writes, router, client } = openAt(SKILLS_PAGE);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('link', { name: /^changelog-lint/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${SKILLS_PAGE}/changelog-lint`));
    expect(await screen.findByRole('heading', { name: 'changelog-lint' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    const description = screen.getByRole('textbox', { name: 'Description' });
    await user.clear(description);
    await user.type(description, 'Our lint: check # first');
    expect(screen.getByText(/^Unsaved changes for this Factory\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument());
    expect(writes).toEqual([
      {
        method: 'PUT',
        name: 'changelog-lint',
        content: '---\nname: "changelog-lint"\ndescription: "Our lint: check # first"\n---\n\n# Lint\n',
      },
    ]);
    expect(router.state.location.pathname).toBe(`${SKILLS_PAGE}/changelog-lint`);
    expect(screen.getByText('Edited')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('Our lint: check # first');

    await user.click(
      within(screen.getByRole('navigation', { name: 'Board configuration' })).getByRole('link', { name: 'Skills' }),
    );
    expect(
      await within(await screen.findByRole('link', { name: /^changelog-lint/ })).findByText('Edited'),
    ).toBeInTheDocument();
    expect(within(card('changelog-lint')).getByText('Our lint: check # first')).toBeInTheDocument();
    await waitForMutationsIdle(client);
  });

  it('keeps frontmatter fields the editor does not show', async () => {
    const { writes, client } = openAt(`${SKILLS_PAGE}/changelog-lint`, {
      catalog: skills.map(skill =>
        skill.name === 'changelog-lint'
          ? { ...skill, frontmatter: { license: 'MIT', 'user-invocable': false } }
          : skill,
      ),
    });
    const user = userEvent.setup();

    await user.type(await screen.findByRole('textbox', { name: 'Description' }), '!');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].content).toContain('\nlicense: "MIT"\nuser-invocable: false\n---\n');
    await waitForMutationsIdle(client);
  });

  it('shows why the server rejected a save and keeps the edit', async () => {
    const { router, client } = openAt(`${SKILLS_PAGE}/configure-factory-rules`);
    server.use(
      http.put(SKILL_URL, () =>
        HttpResponse.json(
          { error: 'invalid_skill', message: 'description: Description must be 1024 characters or less' },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();

    await user.type(await screen.findByRole('textbox', { name: 'Description' }), ' and more');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Description must be 1024 characters or less');
    expect(router.state.location.pathname).toBe(`${SKILLS_PAGE}/configure-factory-rules`);
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('Configure board rules and more');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    await waitForMutationsIdle(client);
  });

  it('keeps what an admin types while the save is on its way', async () => {
    const { writes, client } = openAt(`${SKILLS_PAGE}/changelog-lint`);
    let answer = () => {};
    const answered = new Promise<void>(resolve => {
      answer = resolve;
    });
    server.use(http.put(SKILL_URL, () => answered));
    const user = userEvent.setup();

    const description = await screen.findByRole('textbox', { name: 'Description' });
    await user.type(description, '!');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled();
    await user.type(description, '?');
    answer();

    await waitFor(() => expect(writes).toHaveLength(1));
    await waitForMutationsIdle(client);
    expect(writes[0].content).toContain('description: "Lint changelogs!"');
    expect(description).toHaveValue('Lint changelogs!?');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('keeps an edit typed back to the old text while the save is on its way', async () => {
    const { writes, client } = openAt(`${SKILLS_PAGE}/changelog-lint`);
    let answer = () => {};
    const answered = new Promise<void>(resolve => {
      answer = resolve;
    });
    server.use(http.put(SKILL_URL, () => answered));
    const user = userEvent.setup();

    const description = await screen.findByRole('textbox', { name: 'Description' });
    await user.type(description, '!');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled();
    await user.type(description, '{Backspace}');
    answer();

    await waitFor(() => expect(writes).toHaveLength(1));
    await waitForMutationsIdle(client);
    expect(writes[0].content).toContain('description: "Lint changelogs!"');
    expect(description).toHaveValue('Lint changelogs');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it("follows newer saves from elsewhere without dropping this admin's edits", async () => {
    const { client } = openAt(`${SKILLS_PAGE}/changelog-lint`);
    const serveChangelogLint = (changes: Partial<FactorySkillInfo>) =>
      server.use(
        http.get(SKILLS_URL, () =>
          HttpResponse.json({
            skills: skills.map(skill => (skill.name === 'changelog-lint' ? { ...skill, ...changes } : skill)),
            canEdit: true,
          } satisfies FactorySkillsResponse),
        ),
      );
    const user = userEvent.setup();

    const description = await screen.findByRole('textbox', { name: 'Description' });
    await user.type(description, '!{Backspace}');
    serveChangelogLint({ description: 'Lint every changelog' });
    await client.refetchQueries();
    await waitFor(() => expect(description).toHaveValue('Lint every changelog'));
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    await user.type(description, ' locally');
    serveChangelogLint({ description: 'Lint every changelog', content: '# Lint all' });
    await client.refetchQueries();
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Instructions' })).toHaveTextContent('Lint all'));
    expect(description).toHaveValue('Lint every changelog locally');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('keeps unsaved edits when refreshing the skills fails', async () => {
    const { client } = openAt(`${SKILLS_PAGE}/changelog-lint`);
    const user = userEvent.setup();

    const description = await screen.findByRole('textbox', { name: 'Description' });
    await user.type(description, ' locally');
    server.use(http.get(SKILLS_URL, () => HttpResponse.json({ error: 'unavailable' }, { status: 503 })));
    await client.refetchQueries();
    await user.type(description, ' still');

    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('Lint changelogs locally still');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('asks before a reload or tab close drops unsaved edits', async () => {
    openAt(`${SKILLS_PAGE}/changelog-lint`);
    const unloadBlocked = () => !window.dispatchEvent(new Event('beforeunload', { cancelable: true }));
    const user = userEvent.setup();

    const description = await screen.findByRole('textbox', { name: 'Description' });
    expect(unloadBlocked()).toBe(false);
    await user.type(description, '!');
    expect(unloadBlocked()).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(unloadBlocked()).toBe(false);
  });

  it('goes Back to where the skill was first opened from after browser back returns to it', async () => {
    const boardConfigPage = `/factories/${FACTORY_ID}/work/config`;
    const { router } = openAt(boardConfigPage);
    const user = userEvent.setup();

    await router.navigate(`${SKILLS_PAGE}/changelog-lint`);
    await router.navigate(SKILLS_PAGE);
    await router.navigate(-1);
    await user.click(await screen.findByRole('button', { name: 'Back' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(boardConfigPage));
  });

  it('reverts an edited skill to the original in place', async () => {
    const { writes, router, client } = openAt(SKILLS_PAGE, {
      catalog: skills.map(skill =>
        skill.name === 'configure-factory-rules' ? { ...skill, ...edited, description: 'Our own rules' } : skill,
      ),
    });
    const user = userEvent.setup();

    const editedCard = await screen.findByRole('link', { name: /^configure-factory-rules/ });
    expect(within(editedCard).getByText('Edited')).toBeInTheDocument();
    await user.click(editedCard);
    expect(await screen.findByRole('textbox', { name: 'Description' })).toHaveValue('Our own rules');
    await user.click(screen.getByRole('button', { name: 'Revert to original' }));

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('Configure board rules'),
    );
    expect(writes).toEqual([{ method: 'DELETE', name: 'configure-factory-rules' }]);
    expect(router.state.location.pathname).toBe(`${SKILLS_PAGE}/configure-factory-rules`);
    expect(screen.queryByText('Edited')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revert to original' })).not.toBeInTheDocument();
    await waitForMutationsIdle(client);
  });

  it('offers no revert for a skill this Factory has not edited', async () => {
    openAt(`${SKILLS_PAGE}/configure-factory-rules`);

    expect(await screen.findByRole('heading', { name: 'configure-factory-rules' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revert to original' })).not.toBeInTheDocument();
  });

  it('says when the original changed since the edit', async () => {
    openAt(`${SKILLS_PAGE}/configure-factory-rules`, {
      catalog: skills.map(skill =>
        skill.name === 'configure-factory-rules' ? { ...skill, ...edited, originalChanged: true } : skill,
      ),
    });

    expect(await screen.findByRole('note')).toHaveTextContent('The original changed since this was edited');
  });

  it('shows members who are not admins the skill read-only, its instructions rendered, with the reason', async () => {
    const { writes } = openAt(SKILLS_PAGE, { canEdit: false });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('link', { name: /^configure-factory-rules/ }));
    expect(await screen.findByText('Only organization admins can edit skills.')).toBeInTheDocument();
    expect(screen.getByText('Configure board rules')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Configure rules' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /^(Name|Description|Instructions)$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revert to original' })).not.toBeInTheDocument();
    expect(writes).toEqual([]);
  });

  it('drops unsaved edits on Discard', async () => {
    const { writes } = openAt(`${SKILLS_PAGE}/changelog-lint`);
    const user = userEvent.setup();

    await user.type(await screen.findByRole('textbox', { name: 'Description' }), ' locally');
    await user.click(screen.getByRole('button', { name: 'Discard' }));

    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('Lint changelogs');
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(writes).toEqual([]);
  });

  it('asks before leaving with unsaved edits, and drops them only when told to', async () => {
    const { router } = openAt(`${SKILLS_PAGE}/changelog-lint`);
    const user = userEvent.setup();
    const skillsLink = () =>
      within(screen.getByRole('navigation', { name: 'Board configuration' })).getByRole('link', { name: 'Skills' });

    await user.type(await screen.findByRole('textbox', { name: 'Description' }), ' locally');
    await user.click(skillsLink());
    const ask = await screen.findByRole('alertdialog', { name: 'Discard changes to changelog-lint?' });
    await user.click(within(ask).getByRole('button', { name: 'Keep editing' }));
    expect(router.state.location.pathname).toBe(`${SKILLS_PAGE}/changelog-lint`);
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('Lint changelogs locally');

    await user.click(skillsLink());
    await user.click(
      within(await screen.findByRole('alertdialog', { name: 'Discard changes to changelog-lint?' })).getByRole(
        'button',
        { name: 'Discard' },
      ),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(SKILLS_PAGE));
    await user.click(await screen.findByRole('link', { name: /^changelog-lint/ }));
    expect(await screen.findByRole('textbox', { name: 'Description' })).toHaveValue('Lint changelogs');
  });

  it('says so when the factory has no skill by that name, with a way back to the list', async () => {
    const { router } = openAt(`${SKILLS_PAGE}/gone-skill`);
    const user = userEvent.setup();

    expect(await screen.findByRole('alert')).toHaveTextContent('This factory has no gone-skill skill.');
    await user.click(screen.getByRole('link', { name: 'Back to skills' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(SKILLS_PAGE));
  });

  it('goes back to the skills list from a page opened by a link', async () => {
    const { router } = openAt(`${SKILLS_PAGE}/changelog-lint`);
    const user = userEvent.setup();

    await screen.findByRole('heading', { name: 'changelog-lint' });
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(SKILLS_PAGE));
  });

  it('deletes a skill this Factory created once confirmed, and offers no revert for it', async () => {
    const { writes, router, client } = openAt(SKILLS_PAGE, { catalog: [...skills, releaseNotes] });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('link', { name: /^release-notes/ }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(screen.queryByRole('button', { name: 'Revert to original' })).not.toBeInTheDocument();
    expect(screen.getByText('Delete release-notes?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep' })).toHaveFocus();
    expect(writes).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Keep' }));
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete skill' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(SKILLS_PAGE));
    expect(writes).toEqual([{ method: 'DELETE', name: 'release-notes' }]);
    await waitFor(() => expect(screen.queryByRole('link', { name: /^release-notes/ })).not.toBeInTheDocument());
    await waitForMutationsIdle(client);
  });
});

describe('the new skill page', () => {
  it('creates a skill for this Factory and opens its page', async () => {
    const { writes, router, client } = openAt(SKILLS_PAGE);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('link', { name: 'New skill' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(NEW_SKILL_PAGE));
    const name = await screen.findByRole('textbox', { name: 'Name' });
    expect(name).toHaveFocus();
    await user.type(name, 'release-notes');
    expect(screen.getByText('Add a description to create it.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Write notes: what # changed');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`${SKILLS_PAGE}/release-notes`));
    expect(writes).toEqual([
      {
        method: 'POST',
        name: 'release-notes',
        content: '---\nname: "release-notes"\ndescription: "Write notes: what # changed"\n---\n\n\n',
      },
    ]);
    expect(await screen.findByText('Custom')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'release-notes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument();
    await waitForMutationsIdle(client);
  });

  it('keeps an all-digit name a string in the SKILL.md it sends', async () => {
    const { writes, client } = openAt(NEW_SKILL_PAGE);
    const user = userEvent.setup();

    await user.type(await screen.findByRole('textbox', { name: 'Name' }), '123');
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Numbered');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({ method: 'POST', name: '123' });
    expect(writes[0].content).toMatch(/^---\nname: "123"\n/);
    await waitForMutationsIdle(client);
  });

  it('explains a name agents cannot use and keeps Create disabled', async () => {
    const { writes } = openAt(NEW_SKILL_PAGE);
    const user = userEvent.setup();

    await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'Release_Notes');
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Write release notes');

    expect(screen.getByText(/lowercase letters, digits, and single hyphens/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
    expect(writes).toEqual([]);
  });

  it('shows why the server refused it and stays on the page', async () => {
    const { router, client } = openAt(NEW_SKILL_PAGE);
    const user = userEvent.setup();

    await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'changelog-lint');
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Mine');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A skill named "changelog-lint" already exists. Edit it instead.',
    );
    expect(router.state.location.pathname).toBe(NEW_SKILL_PAGE);
    await waitForMutationsIdle(client);
  });

  it('locks the draft while creating it, and unlocks it when the server refuses', async () => {
    const { client } = openAt(NEW_SKILL_PAGE);
    let answer = () => {};
    const answered = new Promise<void>(resolve => {
      answer = resolve;
    });
    server.use(
      http.post(CREATE_URL, async () => {
        await answered;
        return HttpResponse.json(
          { error: 'skill_exists', message: 'A skill named "changelog-lint" already exists. Edit it instead.' },
          { status: 409 },
        );
      }),
    );
    const user = userEvent.setup();

    await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'changelog-lint');
    const description = screen.getByRole('textbox', { name: 'Description' });
    await user.type(description, 'Mine');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByRole('button', { name: 'Creating…' })).toBeDisabled();
    expect(description.closest('[inert]')).not.toBeNull();
    answer();

    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
    expect(screen.getByRole('textbox', { name: 'Description' }).closest('[inert]')).toBeNull();
    await waitForMutationsIdle(client);
  });

  it('is not offered to members who are not admins', async () => {
    openAt(SKILLS_PAGE, { canEdit: false });

    expect(await screen.findByRole('link', { name: /^configure-factory-rules/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New skill' })).not.toBeInTheDocument();
  });

  it('tells members who are not admins, opening it from a link, that only admins create skills', async () => {
    openAt(NEW_SKILL_PAGE, { canEdit: false });

    expect(await screen.findByText('Only organization admins can create skills.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();
  });
});
