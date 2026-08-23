// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PropertyFilterCreator } from './property-filter-creator';
import type { PropertyFilterField, PropertyFilterToken } from './types';

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

describe('PropertyFilterCreator — moving through the property list', () => {
  const focusedLabel = () => (document.activeElement as HTMLElement | null)?.textContent;

  it('walks down and wraps around', () => {
    render(<PropertyFilterCreator fields={MULTI_FIELDS} tokens={[]} onTokensChange={vi.fn()} />);
    openMenu();
    const menu = screen.getByRole('menu');

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(focusedLabel()).toContain('Primitive ID');

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(focusedLabel()).toContain('Tags');

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(focusedLabel()).toContain('Primitive ID');
  });

  it('walks up from the end', () => {
    render(<PropertyFilterCreator fields={MULTI_FIELDS} tokens={[]} onTokensChange={vi.fn()} />);
    openMenu();
    const menu = screen.getByRole('menu');

    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(focusedLabel()).toContain('Tags');

    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(focusedLabel()).toContain('Primitive ID');
  });

  it('jumps to either end', () => {
    render(<PropertyFilterCreator fields={MULTI_FIELDS} tokens={[]} onTokensChange={vi.fn()} />);
    openMenu();
    const menu = screen.getByRole('menu');

    fireEvent.keyDown(menu, { key: 'End' });
    expect(focusedLabel()).toContain('Tags');

    fireEvent.keyDown(menu, { key: 'Home' });
    expect(focusedLabel()).toContain('Primitive ID');
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

    expect(focusedLabel()).toContain('Tags');
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

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });

    expect(document.activeElement).toBe(before);
  });
});
