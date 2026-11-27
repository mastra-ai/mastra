import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { listedRepository } from '../../../../../e2e/ui/factory-projects';
import { server } from '../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../e2e/ui/render';
import type { FactorySkillInfo, StoredPhaseInfo } from '../../../../api/types';
import { boardSkillPath, boardSkillsPath, newSkillPath } from '../../boardConfig/boardConfigPaths';
import type { RuleField } from '../../boardConfig/boardDraft';
import { PhasePanel } from '../components/phasePanel/PhasePanel';

const FACTORY_ID = 'fp-1';

const SKILLS: FactorySkillInfo[] = ['factory-plan', 'factory-build'].map(name => ({
  name,
  description: `The ${name} skill`,
  content: `# ${name}`,
  builtIn: true,
}));

const BOARD: StoredPhaseInfo[] = [
  { key: 'intake', name: 'Intake', kind: 'resting', nextPhases: ['plan', 'done'] },
  {
    key: 'plan',
    name: 'Planning',
    kind: 'working',
    runner: { context: 'work', skill: 'factory-plan' },
    exitTool: { id: 'submit_plan' },
    nextPhases: ['intake', 'build', 'done'],
  },
  { key: 'build', name: 'Building', kind: 'working', runner: { context: 'work' }, nextPhases: ['plan', 'done'] },
  { key: 'review', name: 'Review', kind: 'working', runner: { context: 'review' }, nextPhases: ['build', 'done'] },
  { key: 'done', name: 'Done', kind: 'terminal', nextPhases: [] },
];

/** What the panel last handed the board draft, read after each step. */
const draft: { phases: StoredPhaseInfo[]; unfinished: Partial<Record<RuleField, boolean>>; removed: boolean } = {
  phases: [],
  unfinished: {},
  removed: false,
};

/** The board draft the canvas page keeps, reduced to what one phase's panel edits. */
function Board({
  phaseKey,
  disabled = false,
  kindLocked = false,
  removable = false,
  skillsEditable = true,
}: {
  phaseKey: string;
  disabled?: boolean;
  kindLocked?: boolean;
  removable?: boolean;
  skillsEditable?: boolean;
}) {
  const [phases, setPhases] = useState(BOARD);
  draft.phases = phases;
  const [unfinished, setUnfinished] = useState<Partial<Record<RuleField, boolean>>>({});
  draft.unfinished = unfinished;
  const phase = phases.find(candidate => candidate.key === phaseKey);
  if (!phase) return null;

  return (
    <PhasePanel
      phase={phase}
      phases={phases}
      requiredNextPhases={phaseKey === 'plan' ? ['build'] : []}
      kindLocked={kindLocked}
      skills={SKILLS}
      skillsEditable={skillsEditable}
      factoryId={FACTORY_ID}
      boardId="work"
      disabled={disabled}
      total={111}
      unfinished={RULE_FIELDS.filter(field => unfinished[field])}
      onChange={next => setPhases(current => current.map(other => (other.key === next.key ? next : other)))}
      onUnfinished={(field, value) => setUnfinished(current => ({ ...current, [field]: value }))}
      onRemove={
        removable
          ? () => {
              draft.removed = true;
            }
          : undefined
      }
      onClose={() => {}}
    />
  );
}

function renderPanel(props: Parameters<typeof Board>[0]) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/work/config/${props.phaseKey}`]}>
      <Board {...props} />
    </MemoryRouter>,
  );
}

const RULE_FIELDS: readonly RuleField[] = ['autoStartWhen', 'autoApproveWhen'];
const phaseOf = (key: string) => draft.phases.find(phase => phase.key === key);
const panel = (name: string) => within(screen.getByRole('complementary', { name }));

beforeEach(() => {
  draft.removed = false;
  // The condition editors suggest the project's repositories.
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [{ id: FACTORY_ID, name: 'Acme Factory', repositories: [listedRepository('repo-1', 'acme/app')] }],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
  );
});

describe('Given a working phase selected on the canvas', () => {
  it('shows its name, kind, card count and every step a card meets', async () => {
    renderPanel({ phaseKey: 'plan' });

    const planning = panel('Planning');
    expect(planning.getByRole('textbox', { name: 'Phase name' })).toHaveValue('Planning');
    expect(planning.getByText('111')).toBeInTheDocument();
    for (const step of ['Starts', 'Agent runs', 'Ends', 'Allowed moves', 'Outcomes']) {
      expect(planning.getByRole('region', { name: step })).toBeInTheDocument();
    }
    expect(planning.getByRole('textbox', { name: 'Planning exit tool' })).toHaveValue('submit_plan');
  });

  it('when its kind changes to Resting, then only its moves stay and half-filled conditions go', async () => {
    const user = userEvent.setup();
    renderPanel({ phaseKey: 'plan' });

    const planning = panel('Planning');
    await user.click(planning.getByRole('switch', { name: 'Planning: start on its own' }));
    await user.click(planning.getByRole('button', { name: 'Add condition' }));
    expect(draft.unfinished.autoStartWhen).toBe(true);

    await user.click(planning.getByRole('combobox', { name: 'Phase kind' }));
    await user.click(await screen.findByRole('option', { name: /^Resting/ }));

    expect(phaseOf('plan')).toEqual({
      key: 'plan',
      name: 'Planning',
      description: undefined,
      kind: 'resting',
      nextPhases: ['intake', 'build', 'done'],
    });
    expect(draft.unfinished).toEqual({ autoStartWhen: false, autoApproveWhen: false });
    expect(planning.queryByRole('region', { name: 'Starts' })).not.toBeInTheDocument();
    expect(planning.queryByRole('region', { name: 'Outcomes' })).not.toBeInTheDocument();
    expect(planning.getByRole('region', { name: 'Allowed moves' })).toBeInTheDocument();
  });

  it('when the phase keeps its kind, then the kind shows locked and cannot change', () => {
    renderPanel({ phaseKey: 'plan', kindLocked: true });

    expect(screen.queryByRole('combobox', { name: 'Phase kind' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Working\. .*keeps its kind/ })).toBeInTheDocument();
  });

  it('when it starts on its own and then stops, then the conditions it was limited to are dropped', async () => {
    const user = userEvent.setup();
    renderPanel({ phaseKey: 'plan' });

    const starts = within(screen.getByRole('region', { name: 'Starts' }));
    const toggle = starts.getByRole('switch', { name: 'Planning: start on its own' });
    await user.click(toggle);
    expect(phaseOf('plan')?.autoStart).toBe(true);
    expect(starts.getByText('Leave empty to start every card on its own.')).toBeInTheDocument();

    await user.click(starts.getByRole('button', { name: 'Add condition' }));
    await user.click(starts.getByRole('combobox', { name: 'Field' }));
    await user.click(await screen.findByRole('option', { name: 'Title' }));
    await user.type(starts.getByRole('textbox', { name: 'Value' }), 'flaky');
    expect(phaseOf('plan')?.autoStartWhen).toEqual({
      operator: 'AND',
      conditions: [expect.objectContaining({ field: 'item.title', value: 'flaky' })],
    });

    await user.click(toggle);
    expect(phaseOf('plan')).toMatchObject({ autoStart: false, autoStartWhen: null });
    expect(draft.unfinished.autoStartWhen).toBe(false);
    expect(starts.queryByRole('group', { name: 'Only when' })).not.toBeInTheDocument();
  });

  it('when a condition is only half filled in, then the drafted rule stays the last whole one', async () => {
    const user = userEvent.setup();
    renderPanel({ phaseKey: 'plan' });

    const starts = within(screen.getByRole('region', { name: 'Starts' }));
    await user.click(starts.getByRole('switch', { name: 'Planning: start on its own' }));
    await user.click(starts.getByRole('button', { name: 'Add condition' }));

    expect(draft.unfinished.autoStartWhen).toBe(true);
    expect(phaseOf('plan')?.autoStartWhen).toBeUndefined();
    expect(starts.getByText('Finish or remove unfinished conditions to save.')).toBeInTheDocument();
  });

  it('when its finished conditions would be refused, then the panel says why until a row is half filled again', async () => {
    const user = userEvent.setup();
    renderPanel({ phaseKey: 'plan' });

    const starts = within(screen.getByRole('region', { name: 'Starts' }));
    await user.click(starts.getByRole('switch', { name: 'Planning: start on its own' }));
    await user.click(starts.getByRole('button', { name: 'Add condition' }));
    await user.click(starts.getByRole('combobox', { name: 'Field' }));
    await user.click(await screen.findByRole('option', { name: 'Title' }));
    await user.click(starts.getByRole('textbox', { name: 'Value' }));
    await user.paste('x'.repeat(501));

    expect(starts.getByRole('alert')).toHaveTextContent(/conditions\.0\.value: .*500/);

    await user.click(starts.getByRole('button', { name: 'Add condition' }));
    expect(starts.queryByRole('alert')).not.toBeInTheDocument();
    expect(starts.getByText('Finish or remove unfinished conditions to save.')).toBeInTheDocument();
  });

  it('when its auto-approve conditions would be refused, then the panel says why under them', async () => {
    const user = userEvent.setup();
    renderPanel({ phaseKey: 'plan' });

    const ends = within(screen.getByRole('region', { name: 'Ends' }));
    await user.click(ends.getByRole('switch', { name: 'Planning: approve submit_plan on its own' }));
    expect(ends.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(ends.getByRole('button', { name: 'Add condition' }));
    await user.click(ends.getByRole('combobox', { name: 'Field' }));
    await user.click(await screen.findByRole('option', { name: 'Title' }));
    await user.click(ends.getByRole('textbox', { name: 'Value' }));
    await user.paste('x'.repeat(501));

    expect(ends.getByRole('alert')).toHaveTextContent(/conditions\.0\.value: .*500/);
  });

  it('when its instructions run over 1000 characters, then the count and the panel say it cannot save', async () => {
    const user = userEvent.setup();
    renderPanel({ phaseKey: 'build' });

    await user.click(screen.getByRole('button', { name: 'Instructions, goal, session, tools' }));
    const runs = panel('Building agent runs');
    expect(runs.getByText('0 / 1000')).toBeInTheDocument();
    const instructions = runs.getByRole('textbox', { name: 'Building instructions' });
    await user.click(instructions);
    await user.paste('x'.repeat(1042));
    expect(runs.getByText('1,042 / 1000')).toBeInTheDocument();
    expect(runs.getByText('Too long to save.')).toBeInTheDocument();
    expect(phaseOf('build')?.runner).toEqual({ context: 'work', instructions: 'x'.repeat(1042) });
    expect(runs.getByText('Shared with Planning, one per card')).toBeInTheDocument();

    await user.click(runs.getByRole('button', { name: 'Back to Building' }));
    const building = panel('Building');
    expect(
      building.getByRole('button', { name: /^Instructions, goal, session, tools\s*\(can't save\)$/ }),
    ).toBeInTheDocument();
    expect(building.getByText('1,042 / 1000')).toBeInTheDocument();
  });

  it('when its goal and tools change, then the draft keeps them, and a goal run count out of range is refused', async () => {
    const user = userEvent.setup();
    renderPanel({ phaseKey: 'review' });

    await user.click(screen.getByRole('button', { name: 'Instructions, goal, session, tools' }));
    const runs = panel('Review agent runs');
    await user.type(runs.getByRole('textbox', { name: 'Review goal' }), 'Every test passes.');
    const count = runs.getByRole('textbox', { name: 'Pause goal after' });
    await user.type(count, '51');
    expect(runs.getByText('Use a whole number from 1 to 50.')).toBeInTheDocument();
    await user.clear(count);
    await user.type(count, '5');
    await user.click(runs.getByRole('switch', { name: 'Review: Record a review verdict' }));
    expect(runs.getByText('One per card')).toBeInTheDocument();

    expect(phaseOf('review')).toMatchObject({
      runner: { context: 'review', goal: { objective: 'Every test passes.', maxRuns: 5 } },
      tools: ['factory_record_review_verdict'],
    });
  });

  it('when the skill is cleared or another is picked, then the runner keeps the pick and links to its skill', async () => {
    const user = userEvent.setup();
    renderPanel({ phaseKey: 'plan' });

    await user.click(screen.getByRole('combobox', { name: 'Planning skill' }));
    await user.click(await screen.findByRole('option', { name: 'No skill' }));
    expect(phaseOf('plan')?.runner).toEqual({ context: 'work' });

    await user.click(screen.getByRole('combobox', { name: 'Planning skill' }));
    await user.click(await screen.findByRole('option', { name: 'factory-build' }));
    expect(phaseOf('plan')?.runner).toEqual({ context: 'work', skill: 'factory-build' });
    expect(screen.getByRole('link', { name: 'Edit factory-build' })).toHaveAttribute(
      'href',
      boardSkillPath(FACTORY_ID, 'work', 'factory-build'),
    );
  });

  it('when no phase picks a skill, then the panel still links to every skill and to writing a new one', () => {
    renderPanel({ phaseKey: 'build' });

    const building = panel('Building');
    expect(building.getByRole('link', { name: 'All skills' })).toHaveAttribute(
      'href',
      boardSkillsPath(FACTORY_ID, 'work'),
    );
    expect(building.getByRole('link', { name: 'New skill' })).toHaveAttribute('href', newSkillPath(FACTORY_ID, 'work'));
  });

  it('when the user may not edit skills, then the panel links to every skill but offers no new one', () => {
    renderPanel({ phaseKey: 'plan', disabled: true, skillsEditable: false });

    const planning = panel('Planning');
    expect(planning.getByRole('link', { name: 'All skills' })).toHaveAttribute(
      'href',
      boardSkillsPath(FACTORY_ID, 'work'),
    );
    expect(planning.queryByRole('link', { name: 'New skill' })).not.toBeInTheDocument();
    expect(planning.getByRole('link', { name: 'View factory-plan' })).toBeInTheDocument();
  });
});

describe('Given the allowed moves of a phase', () => {
  it("lists every phase in the picker, keeps Factory's required move locked on, and toggles the rest", async () => {
    const user = userEvent.setup();
    renderPanel({ phaseKey: 'plan' });

    const chips = () => within(screen.getByRole('list', { name: 'Allowed moves from Planning' }));
    const locked = chips()
      .getAllByRole('listitem')
      .filter(item => within(item).queryByText('(locked)'));
    expect(locked).toHaveLength(1);
    expect(within(locked[0]).getByText('Building')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Change moves from Planning' }));
    const picker = within(await screen.findByRole('list', { name: 'Moves from Planning' }));
    expect(picker.getByText('this phase')).toBeInTheDocument();
    const building = picker.getByRole('button', { name: 'Building (locked)', pressed: true });
    expect(building).toHaveAttribute('aria-disabled', 'true');
    await user.click(building);
    expect(phaseOf('plan')?.nextPhases).toEqual(['intake', 'build', 'done']);

    await user.click(picker.getByRole('button', { name: 'Review', pressed: false }));
    await user.click(picker.getByRole('button', { name: 'Intake', pressed: true }));
    // Board order, whatever order they were picked in.
    expect(phaseOf('plan')?.nextPhases).toEqual(['build', 'review', 'done']);
    expect(chips().getByText('Review')).toBeInTheDocument();
    expect(chips().queryByText('Intake')).not.toBeInTheDocument();
  });
});

describe("Given a phase's outcomes", () => {
  it('shows one per move until customized, then keeps the outcomes a person wrote and drops one with its move', async () => {
    const user = userEvent.setup();
    renderPanel({ phaseKey: 'build' });

    const outcomes = within(screen.getByRole('region', { name: 'Outcomes' }));
    expect(
      within(outcomes.getByRole('list', { name: 'Building outcomes' }))
        .getAllByRole('listitem')
        .map(item => item.textContent),
    ).toEqual(['plan moves the card to Planning', 'done moves the card to Done']);

    await user.click(outcomes.getByRole('button', { name: 'Customize outcomes' }));
    const key = outcomes.getByRole('textbox', { name: 'Building outcome 2 key' });
    await user.clear(key);
    await user.type(key, 'ship');
    const label = outcomes.getByRole('textbox', { name: 'Building outcome 2 label' });
    await user.clear(label);
    await user.type(label, 'Fix shipped');
    expect(phaseOf('build')?.outcomes).toEqual([
      { key: 'plan', label: 'Planning', to: 'plan' },
      { key: 'ship', label: 'Fix shipped', to: 'done' },
    ]);

    await user.clear(key);
    await user.type(key, 'plan');
    expect(outcomes.getAllByText('This key is already in use.')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Change moves from Building' }));
    const picker = within(await screen.findByRole('list', { name: 'Moves from Building' }));
    await user.click(picker.getByRole('button', { name: 'Planning', pressed: true }));
    expect(phaseOf('build')?.outcomes).toEqual([{ key: 'plan', label: 'Fix shipped', to: 'done' }]);
  });
});

describe('Given who may change the phase', () => {
  it('when the phase cannot go, then Remove is not offered', () => {
    renderPanel({ phaseKey: 'build' });

    expect(screen.queryByRole('button', { name: 'Remove Building' })).not.toBeInTheDocument();
  });

  it('when the phase can go, then Remove removes it', async () => {
    const user = userEvent.setup();
    renderPanel({ phaseKey: 'build', removable: true });

    await user.click(screen.getByRole('button', { name: 'Remove Building' }));

    expect(draft.removed).toBe(true);
  });

  it('shows a view-only phase without anything to change', async () => {
    const user = userEvent.setup();
    renderPanel({ phaseKey: 'plan', disabled: true, removable: false });

    const planning = panel('Planning');
    expect(planning.queryByRole('textbox', { name: 'Phase name' })).not.toBeInTheDocument();
    expect(planning.getByText('Planning')).toBeInTheDocument();
    expect(planning.queryByRole('combobox', { name: 'Phase kind' })).not.toBeInTheDocument();
    expect(planning.getByRole('switch', { name: 'Planning: start on its own' })).toBeDisabled();
    expect(planning.getByRole('textbox', { name: 'Planning exit tool' })).toBeDisabled();
    expect(planning.getByRole('switch', { name: 'Planning: approve submit_plan on its own' })).toBeDisabled();
    expect(planning.queryByRole('button', { name: 'Add condition' })).not.toBeInTheDocument();
    expect(planning.queryByRole('button', { name: 'Change moves from Planning' })).not.toBeInTheDocument();
    expect(planning.queryByRole('button', { name: 'Customize outcomes' })).not.toBeInTheDocument();

    await user.click(planning.getByRole('button', { name: 'Instructions, goal, session, tools' }));
    const runs = panel('Planning agent runs');
    expect(runs.getByRole('textbox', { name: 'Planning instructions' })).toHaveAttribute('aria-readonly', 'true');
    expect(runs.getByRole('textbox', { name: 'Planning goal' })).toHaveAttribute('aria-readonly', 'true');
  });
});
