// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { PropertyFilterCreator } from './property-filter-creator';
import type { PropertyFilterField, PropertyFilterToken } from './types';

beforeAll(() => {
  // jsdom ships no PointerEvent, and Base UI constructs one when a choice is clicked.
  if (typeof window.PointerEvent === 'undefined') {
    class PointerEventStub extends MouseEvent {}
    window.PointerEvent = PointerEventStub as unknown as typeof PointerEvent;
  }
});

afterEach(() => {
  cleanup();
});

const FIELDS: PropertyFilterField[] = [
  {
    id: 'rootEntityType',
    label: 'Primitive Type',
    kind: 'pick-multi',
    options: [
      { label: 'Agent', value: 'agent' },
      { label: 'Workflow', value: 'workflow_run' },
    ],
  },
  { id: 'entityId', label: 'Primitive ID', kind: 'text' },
  { id: 'entityName', label: 'Primitive Name', kind: 'text' },
  { id: 'traceId', label: 'Trace ID', kind: 'text' },
];

describe('PropertyFilterCreator', () => {
  describe('hiddenFieldIds', () => {
    it('omits hidden field ids from the dropdown menu', () => {
      const tokens: PropertyFilterToken[] = [];
      const onTokensChange = vi.fn();
      render(
        <PropertyFilterCreator
          fields={FIELDS}
          tokens={tokens}
          onTokensChange={onTokensChange}
          hiddenFieldIds={['rootEntityType', 'entityId', 'entityName']}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /Add Filter/i }));

      expect(screen.queryByRole('menuitem', { name: /Primitive Type/i })).toBeNull();
      expect(screen.queryByRole('menuitem', { name: /Primitive ID/i })).toBeNull();
      expect(screen.queryByRole('menuitem', { name: /Primitive Name/i })).toBeNull();
      expect(screen.getByRole('menuitem', { name: /Trace ID/i })).toBeDefined();
    });

    it('shows all fields when hiddenFieldIds is empty or unset', () => {
      const tokens: PropertyFilterToken[] = [];
      const onTokensChange = vi.fn();
      render(<PropertyFilterCreator fields={FIELDS} tokens={tokens} onTokensChange={onTokensChange} />);

      fireEvent.click(screen.getByRole('button', { name: /Add Filter/i }));

      expect(screen.getByRole('menuitem', { name: /Primitive Type/i })).toBeDefined();
      expect(screen.getByRole('menuitem', { name: /Primitive ID/i })).toBeDefined();
      expect(screen.getByRole('menuitem', { name: /Trace ID/i })).toBeDefined();
    });

    it('shows the empty state when every field is hidden', () => {
      const tokens: PropertyFilterToken[] = [];
      const onTokensChange = vi.fn();
      render(
        <PropertyFilterCreator
          fields={FIELDS}
          tokens={tokens}
          onTokensChange={onTokensChange}
          hiddenFieldIds={FIELDS.map(f => f.id)}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /Add Filter/i }));

      expect(screen.getByText(/No matching property\./i)).toBeDefined();
    });
  });
});

const MULTI_FIELDS: PropertyFilterField[] = [
  { id: 'entityId', label: 'Primitive ID', kind: 'text' },
  {
    id: 'tags',
    label: 'Tags',
    kind: 'multi-select',
    options: [
      { label: 'Prod', value: 'prod' },
      { label: 'Staging', value: 'staging' },
    ],
  },
];

const PICK_MULTI_FIELDS: PropertyFilterField[] = [
  { id: 'entityId', label: 'Primitive ID', kind: 'text' },
  {
    id: 'tags',
    label: 'Tags',
    kind: 'pick-multi',
    multi: true,
    options: [
      { label: 'Alpha', value: 'alpha' },
      { label: 'Beta', value: 'beta' },
    ],
  },
];

const openMenu = () => fireEvent.click(screen.getByRole('button', { name: /Add Filter/i }));

describe('PropertyFilterCreator — the trigger', () => {
  it('names itself Add Filter unless the caller says otherwise', () => {
    render(<PropertyFilterCreator fields={FIELDS} tokens={[]} onTokensChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Add Filter' })).toBeTruthy();
  });

  it('takes the label the caller gives it', () => {
    render(<PropertyFilterCreator fields={FIELDS} tokens={[]} onTokensChange={vi.fn()} label="Filter traces" />);

    expect(screen.getByRole('button', { name: 'Filter traces' })).toBeTruthy();
  });

  it('cannot be opened while it is disabled', () => {
    render(<PropertyFilterCreator fields={FIELDS} tokens={[]} onTokensChange={vi.fn()} disabled />);

    const trigger = screen.getByRole('button', { name: 'Add Filter' });
    expect(trigger.hasAttribute('disabled')).toBe(true);

    fireEvent.click(trigger);
    expect(screen.queryByRole('menuitem')).toBeNull();
  });
});

describe('PropertyFilterCreator — picking a text property', () => {
  it('creates an empty pill and hands the typing over', () => {
    const onTokensChange = vi.fn();
    const onStartTextFilter = vi.fn();
    render(
      <PropertyFilterCreator
        fields={FIELDS}
        tokens={[{ fieldId: 'traceId', value: 'abc' }]}
        onTokensChange={onTokensChange}
        onStartTextFilter={onStartTextFilter}
      />,
    );

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Primitive ID/i }));

    expect(onTokensChange).toHaveBeenCalledWith([
      { fieldId: 'traceId', value: 'abc' },
      { fieldId: 'entityId', value: '' },
    ]);
    expect(onStartTextFilter).toHaveBeenCalledWith('entityId');
  });

  it('creates the pill even without anyone to hand the typing to', () => {
    const onTokensChange = vi.fn();
    render(<PropertyFilterCreator fields={FIELDS} tokens={[]} onTokensChange={onTokensChange} />);

    openMenu();
    expect(() => fireEvent.click(screen.getByRole('menuitem', { name: /Primitive ID/i }))).not.toThrow();

    expect(onTokensChange).toHaveBeenCalledWith([{ fieldId: 'entityId', value: '' }]);
  });

  it('closes the popover on the way out', async () => {
    render(<PropertyFilterCreator fields={FIELDS} tokens={[]} onTokensChange={vi.fn()} />);

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Primitive ID/i }));

    await waitFor(() => expect(screen.queryByRole('menuitem')).toBeNull());
  });
});

describe('PropertyFilterCreator — a property already in use', () => {
  it('marks it as in use and refuses the click', () => {
    const onTokensChange = vi.fn();
    render(
      <PropertyFilterCreator
        fields={FIELDS}
        tokens={[{ fieldId: 'entityId', value: 'abc' }]}
        onTokensChange={onTokensChange}
      />,
    );

    openMenu();
    const item = screen.getByRole('menuitem', { name: /Primitive ID/i });

    expect(item.hasAttribute('disabled')).toBe(true);
    expect(item.textContent).toContain('In use');

    fireEvent.click(item);
    expect(onTokensChange).not.toHaveBeenCalled();
  });

  it('lets a pick-multi property be used more than once', () => {
    render(
      <PropertyFilterCreator
        fields={FIELDS}
        tokens={[{ fieldId: 'rootEntityType', value: ['agent'] }]}
        onTokensChange={vi.fn()}
      />,
    );

    openMenu();

    expect(screen.getByRole('menuitem', { name: /Primitive Type/i }).hasAttribute('disabled')).toBe(false);
  });

  it('ignores a token whose property it does not know', () => {
    render(
      <PropertyFilterCreator fields={FIELDS} tokens={[{ fieldId: 'gone', value: 'x' }]} onTokensChange={vi.fn()} />,
    );

    openMenu();

    expect(screen.getByRole('menuitem', { name: /Primitive ID/i }).hasAttribute('disabled')).toBe(false);
  });
});

describe('PropertyFilterCreator — choosing a multi-select value', () => {
  it('walks from the property list to the value step and back', () => {
    render(<PropertyFilterCreator fields={MULTI_FIELDS} tokens={[]} onTokensChange={vi.fn()} />);

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Tags/i }));

    expect(screen.getByText('Tags · is')).toBeTruthy();
    expect(screen.queryByRole('menuitem')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Back to properties' }));

    expect(screen.getByRole('menuitem', { name: /Tags/i })).toBeTruthy();
    expect(screen.queryByText('Tags · is')).toBeNull();
  });

  it('invites a choice in its own words', async () => {
    render(<PropertyFilterCreator fields={MULTI_FIELDS} tokens={[]} onTokensChange={vi.fn()} />);

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Tags/i }));
    expect(screen.getByRole('combobox').textContent).toContain('Choose Tags');

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.change(await screen.findByPlaceholderText('Search tags...'), { target: { value: 'no such tag' } });

    expect(await screen.findByText('No option found.')).toBeTruthy();
  });

  it('invites a choice in the caller’s words when there are any', async () => {
    const wordy: PropertyFilterField[] = [
      {
        id: 'tags',
        label: 'Tags',
        kind: 'multi-select',
        placeholder: 'Pick some tags',
        emptyText: 'No tags yet',
        options: [{ label: 'Prod', value: 'prod' }],
      },
    ];
    render(<PropertyFilterCreator fields={wordy} tokens={[]} onTokensChange={vi.fn()} />);

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Tags/i }));
    expect(screen.getByRole('combobox').textContent).toContain('Pick some tags');

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.change(await screen.findByPlaceholderText('Search tags...'), { target: { value: 'zzz' } });

    expect(await screen.findByText('No tags yet')).toBeTruthy();
  });

  it('will not commit without a value chosen', () => {
    const onTokensChange = vi.fn();
    render(<PropertyFilterCreator fields={MULTI_FIELDS} tokens={[]} onTokensChange={onTokensChange} />);

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Tags/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Add filter' }));

    expect(screen.getByText('Choose at least one tags value.')).toBeTruthy();
    expect(onTokensChange).not.toHaveBeenCalled();
  });

  it('closes without adding anything on Cancel', async () => {
    const onTokensChange = vi.fn();
    render(<PropertyFilterCreator fields={MULTI_FIELDS} tokens={[]} onTokensChange={onTokensChange} />);

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Tags/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByText('Tags · is')).toBeNull());
    expect(onTokensChange).not.toHaveBeenCalled();
  });

  it('adds the filter once a value has been chosen', async () => {
    const onTokensChange = vi.fn();
    render(<PropertyFilterCreator fields={MULTI_FIELDS} tokens={[]} onTokensChange={onTokensChange} />);

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Tags/i }));
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByRole('option', { name: 'Prod' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add filter' }));

    expect(onTokensChange).toHaveBeenCalledWith([{ fieldId: 'tags', value: ['prod'] }]);
    await waitFor(() => expect(screen.queryByText('Tags · is')).toBeNull());
  });

  it('forgets an earlier complaint as soon as a value is chosen', async () => {
    render(<PropertyFilterCreator fields={MULTI_FIELDS} tokens={[]} onTokensChange={vi.fn()} />);

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Tags/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Add filter' }));
    expect(screen.getByText('Choose at least one tags value.')).toBeTruthy();

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByRole('option', { name: 'Prod' }));

    expect(screen.queryByText('Choose at least one tags value.')).toBeNull();
  });

  it('gives focus back to its own button when it closes', async () => {
    render(<PropertyFilterCreator fields={MULTI_FIELDS} tokens={[]} onTokensChange={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: /Add Filter/i });

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Tags/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('leaves focus alone when it hands the typing to a new pill', async () => {
    render(<PropertyFilterCreator fields={FIELDS} tokens={[]} onTokensChange={vi.fn()} onStartTextFilter={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: /Add Filter/i });

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Primitive ID/i }));

    await waitFor(() => expect(screen.queryByRole('menuitem')).toBeNull());
    expect(document.activeElement).not.toBe(trigger);
  });

  it('goes back to giving focus once the hand-off is done', async () => {
    render(
      <PropertyFilterCreator fields={MULTI_FIELDS} tokens={[]} onTokensChange={vi.fn()} onStartTextFilter={vi.fn()} />,
    );
    const trigger = screen.getByRole('button', { name: /Add Filter/i });

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Primitive ID/i }));
    await waitFor(() => expect(screen.queryByRole('menuitem')).toBeNull());

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Tags/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('starts over the next time it is opened', async () => {
    render(<PropertyFilterCreator fields={MULTI_FIELDS} tokens={[]} onTokensChange={vi.fn()} />);

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Tags/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Add filter' }));
    expect(screen.getByText('Choose at least one tags value.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByText('Tags · is')).toBeNull());

    openMenu();

    // Back at the property list, with last time's complaint forgotten.
    expect(screen.getByRole('menuitem', { name: /Tags/i })).toBeTruthy();
    expect(screen.queryByText('Choose at least one tags value.')).toBeNull();
  });
});

describe('PropertyFilterCreator — a pick-multi property', () => {
  const openPanel = () => {
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Primitive Type/i }));
  };

  it('opens its own panel beside the property list, and closes it again', async () => {
    render(<PropertyFilterCreator fields={FIELDS} tokens={[]} onTokensChange={vi.fn()} />);

    openPanel();
    expect(await screen.findByRole('radio', { name: /Agent/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('menuitem', { name: /Primitive Type/i }));

    await waitFor(() => expect(screen.queryByRole('radio', { name: /Agent/i })).toBeNull());
  });

  it('turns its chevron to the front while the panel is open', async () => {
    render(<PropertyFilterCreator fields={FIELDS} tokens={[]} onTokensChange={vi.fn()} />);
    openMenu();

    const item = screen.getByRole('menuitem', { name: /Primitive Type/i });
    // Closed, the chevron trails the label as an invitation to open it.
    expect(item.lastElementChild?.tagName).toBe('svg');

    fireEvent.click(item);
    await screen.findByRole('radio', { name: /Agent/i });

    expect(item.firstElementChild?.tagName).toBe('svg');
  });

  it('adds the value that was chosen', async () => {
    const onTokensChange = vi.fn();
    render(<PropertyFilterCreator fields={FIELDS} tokens={[]} onTokensChange={onTokensChange} />);

    openPanel();
    fireEvent.click(await screen.findByRole('radio', { name: /Workflow/i }));

    expect(onTokensChange).toHaveBeenCalledWith([{ fieldId: 'rootEntityType', value: 'workflow_run' }]);
  });

  it('replaces the value it already had', async () => {
    const onTokensChange = vi.fn();
    render(
      <PropertyFilterCreator
        fields={FIELDS}
        tokens={[
          { fieldId: 'entityId', value: 'kept' },
          { fieldId: 'rootEntityType', value: 'agent' },
        ]}
        onTokensChange={onTokensChange}
      />,
    );

    openPanel();
    fireEvent.click(await screen.findByRole('radio', { name: /Workflow/i }));

    expect(onTokensChange).toHaveBeenCalledWith([
      { fieldId: 'entityId', value: 'kept' },
      { fieldId: 'rootEntityType', value: 'workflow_run' },
    ]);
  });

  it('drops the filter when the last value is unpicked', async () => {
    const onTokensChange = vi.fn();
    render(
      <PropertyFilterCreator
        fields={PICK_MULTI_FIELDS}
        tokens={[
          { fieldId: 'entityId', value: 'kept' },
          { fieldId: 'tags', value: ['alpha'] },
        ]}
        onTokensChange={onTokensChange}
      />,
    );

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Tags/i }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /Alpha/i }));

    expect(onTokensChange).toHaveBeenCalledWith([{ fieldId: 'entityId', value: 'kept' }]);
  });

  it('adds the first value that is ticked', async () => {
    const onTokensChange = vi.fn();
    render(<PropertyFilterCreator fields={PICK_MULTI_FIELDS} tokens={[]} onTokensChange={onTokensChange} />);

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Tags/i }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /Alpha/i }));

    expect(onTokensChange).toHaveBeenCalledWith([{ fieldId: 'tags', value: ['alpha'] }]);
  });

  it('closes its panel along with the property list', async () => {
    render(<PropertyFilterCreator fields={FIELDS} tokens={[]} onTokensChange={vi.fn()} />);

    openPanel();
    await screen.findByRole('radio', { name: /Agent/i });

    // Closing the property list takes its side panel with it.
    openMenu();
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: /Primitive Type/i })).toBeNull());

    openMenu();

    expect(screen.queryByRole('radio', { name: /Agent/i })).toBeNull();
  });

  it('adds to a selection it has already made', async () => {
    const Harness = () => {
      const [tokens, setTokens] = useState<PropertyFilterToken[]>([]);
      return <PropertyFilterCreator fields={PICK_MULTI_FIELDS} tokens={tokens} onTokensChange={setTokens} />;
    };
    render(<Harness />);

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Tags/i }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /Alpha/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Beta/i }));

    // The second tick keeps the first rather than replacing it.
    expect(screen.getByRole('checkbox', { name: /Alpha/i }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('checkbox', { name: /Beta/i }).getAttribute('aria-checked')).toBe('true');
  });

  it('opens the panel and steps into it with the right arrow', async () => {
    render(<PropertyFilterCreator fields={FIELDS} tokens={[]} onTokensChange={vi.fn()} />);
    openMenu();

    fireEvent.keyDown(screen.getByRole('menuitem', { name: /Primitive Type/i }), { key: 'ArrowRight' });

    const search = await screen.findByPlaceholderText('Search primitive type...');
    await waitFor(() => expect(document.activeElement).toBe(search));
  });

  it('leaves other keys on the property row alone', () => {
    render(<PropertyFilterCreator fields={FIELDS} tokens={[]} onTokensChange={vi.fn()} />);
    openMenu();

    fireEvent.keyDown(screen.getByRole('menuitem', { name: /Primitive Type/i }), { key: 'a' });

    expect(screen.queryByRole('radio', { name: /Agent/i })).toBeNull();
  });

  it('walks through the values with the arrow keys', async () => {
    render(<PropertyFilterCreator fields={FIELDS} tokens={[]} onTokensChange={vi.fn()} />);
    openPanel();

    const panel = (await screen.findByRole('radio', { name: /Agent/i })).closest('[data-pick-multi-panel]');
    if (!(panel instanceof HTMLElement)) throw new Error('pick-multi panel not rendered');

    fireEvent.keyDown(panel, { key: 'End' });
    expect((document.activeElement as HTMLElement | null)?.closest('label')?.textContent).toContain('Any');

    fireEvent.keyDown(panel, { key: 'Home' });
    expect((document.activeElement as HTMLElement | null)?.closest('label')?.textContent).toContain('Agent');

    fireEvent.keyDown(panel, { key: 'ArrowDown' });
    expect((document.activeElement as HTMLElement | null)?.closest('label')?.textContent).toContain('Workflow');

    fireEvent.keyDown(panel, { key: 'ArrowUp' });
    expect((document.activeElement as HTMLElement | null)?.closest('label')?.textContent).toContain('Agent');

    fireEvent.keyDown(panel, { key: 'ArrowUp' });
    expect((document.activeElement as HTMLElement | null)?.closest('label')?.textContent).toContain('Any');
  });

  it('leaves other keys in the panel alone', async () => {
    render(<PropertyFilterCreator fields={FIELDS} tokens={[]} onTokensChange={vi.fn()} />);
    openPanel();

    const agent = await screen.findByRole('radio', { name: /Agent/i });
    const panel = agent.closest('[data-pick-multi-panel]');
    if (!(panel instanceof HTMLElement)) throw new Error('pick-multi panel not rendered');

    fireEvent.keyDown(panel, { key: 'a' });

    expect(document.activeElement).not.toBe(agent);
  });
});

describe('PropertyFilterCreator — moving through the property list', () => {
  /** The row the keyboard is on. Reading `document.body` would match anything. */
  const focusedRow = () => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || active.getAttribute('role') !== 'menuitem') {
      throw new Error(`Expected a menu row to hold focus, found <${active?.nodeName.toLowerCase()}>`);
    }
    return active.textContent;
  };

  it('walks down and wraps around', () => {
    render(<PropertyFilterCreator fields={MULTI_FIELDS} tokens={[]} onTokensChange={vi.fn()} />);
    openMenu();
    const menu = screen.getByRole('menu');

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(focusedRow()).toContain('Primitive ID');

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(focusedRow()).toContain('Tags');

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(focusedRow()).toContain('Primitive ID');
  });

  it('walks up from the end', () => {
    render(<PropertyFilterCreator fields={MULTI_FIELDS} tokens={[]} onTokensChange={vi.fn()} />);
    openMenu();
    const menu = screen.getByRole('menu');

    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(focusedRow()).toContain('Tags');

    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(focusedRow()).toContain('Primitive ID');
  });

  it('jumps to either end', () => {
    render(<PropertyFilterCreator fields={MULTI_FIELDS} tokens={[]} onTokensChange={vi.fn()} />);
    openMenu();
    const menu = screen.getByRole('menu');

    fireEvent.keyDown(menu, { key: 'End' });
    expect(focusedRow()).toContain('Tags');

    fireEvent.keyDown(menu, { key: 'Home' });
    expect(focusedRow()).toContain('Primitive ID');
  });

  it('jumps to either end of a longer list', () => {
    render(<PropertyFilterCreator fields={FIELDS} tokens={[]} onTokensChange={vi.fn()} />);
    openMenu();
    const menu = screen.getByRole('menu');

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(focusedRow()).toContain('Primitive ID');

    fireEvent.keyDown(menu, { key: 'End' });
    expect(focusedRow()).toContain('Trace ID');

    fireEvent.keyDown(menu, { key: 'Home' });
    expect(focusedRow()).toContain('Primitive Type');
  });

  it('wraps back round to the end from the first row', () => {
    render(<PropertyFilterCreator fields={FIELDS} tokens={[]} onTokensChange={vi.fn()} />);
    openMenu();
    const menu = screen.getByRole('menu');

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(focusedRow()).toContain('Primitive Type');

    fireEvent.keyDown(menu, { key: 'ArrowUp' });

    expect(focusedRow()).toContain('Trace ID');
  });

  it('takes the keys it moves on for itself', () => {
    render(<PropertyFilterCreator fields={MULTI_FIELDS} tokens={[]} onTokensChange={vi.fn()} />);
    openMenu();
    const menu = screen.getByRole('menu');

    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) {
      expect(fireEvent.keyDown(menu, { key })).toBe(false);
    }
  });

  it('steps over a property already in use', () => {
    render(
      <PropertyFilterCreator
        fields={MULTI_FIELDS}
        tokens={[{ fieldId: 'entityId', value: 'abc' }]}
        onTokensChange={vi.fn()}
      />,
    );
    openMenu();

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });

    expect(focusedRow()).toContain('Tags');
  });

  it('leaves other keys to the browser', () => {
    render(<PropertyFilterCreator fields={MULTI_FIELDS} tokens={[]} onTokensChange={vi.fn()} />);
    openMenu();
    const before = document.activeElement;

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'a' });

    expect(document.activeElement).toBe(before);
  });

  it('does nothing when there is nothing to move between', () => {
    render(
      <PropertyFilterCreator
        fields={FIELDS}
        tokens={[]}
        onTokensChange={vi.fn()}
        hiddenFieldIds={FIELDS.map(field => field.id)}
      />,
    );
    openMenu();
    const before = document.activeElement;

    // Nothing to move to, so the key is left to the browser.
    expect(fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' })).toBe(true);
    expect(document.activeElement).toBe(before);
  });
});
