// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { PropertyFilterApplied } from './property-filter-applied';
import type { PropertyFilterField, PropertyFilterToken } from './types';

beforeAll(() => {
  // jsdom ships no PointerEvent, and Base UI constructs one when a radio is clicked.
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
];

describe('PropertyFilterApplied', () => {
  describe('default behavior (no locks)', () => {
    it('renders editable text pills with a Remove button', () => {
      const onTokensChange = vi.fn();
      const tokens: PropertyFilterToken[] = [{ fieldId: 'entityId', value: 'weather-agent' }];
      render(<PropertyFilterApplied fields={FIELDS} tokens={tokens} onTokensChange={onTokensChange} />);

      expect(screen.getByRole('button', { name: /Remove Primitive ID filter/i })).toBeDefined();
      expect(screen.queryByLabelText('Primitive ID filter is locked by context')).toBeNull();
    });
  });

  describe('locked pills', () => {
    it('renders a locked pick-multi pill with the human-readable option label', () => {
      const onTokensChange = vi.fn();
      const tokens: PropertyFilterToken[] = [{ fieldId: 'rootEntityType', value: 'agent' }];
      render(
        <PropertyFilterApplied
          fields={FIELDS}
          tokens={tokens}
          onTokensChange={onTokensChange}
          lockedFieldIds={['rootEntityType']}
        />,
      );

      const pill = screen.getByLabelText('Primitive Type filter is locked by context');
      expect(pill.getAttribute('data-property-filter-pill')).toBe('locked');
      expect(pill.getAttribute('data-locked-field-id')).toBe('rootEntityType');
      expect(pill.textContent).toContain('Agent');
    });

    it('renders a locked text pill with the raw value', () => {
      const onTokensChange = vi.fn();
      const tokens: PropertyFilterToken[] = [{ fieldId: 'entityId', value: 'weather-agent' }];
      render(
        <PropertyFilterApplied
          fields={FIELDS}
          tokens={tokens}
          onTokensChange={onTokensChange}
          lockedFieldIds={['entityId']}
        />,
      );

      const pill = screen.getByLabelText('Primitive ID filter is locked by context');
      expect(pill.textContent).toContain('weather-agent');
    });

    it('does not render a Remove button for locked pills', () => {
      const onTokensChange = vi.fn();
      const tokens: PropertyFilterToken[] = [{ fieldId: 'entityId', value: 'weather-agent' }];
      render(
        <PropertyFilterApplied
          fields={FIELDS}
          tokens={tokens}
          onTokensChange={onTokensChange}
          lockedFieldIds={['entityId']}
        />,
      );

      expect(screen.queryByRole('button', { name: /Remove Primitive ID filter/i })).toBeNull();
    });

    it('does not render an editable input for locked text fields', () => {
      const onTokensChange = vi.fn();
      const tokens: PropertyFilterToken[] = [{ fieldId: 'entityId', value: 'weather-agent' }];
      render(
        <PropertyFilterApplied
          fields={FIELDS}
          tokens={tokens}
          onTokensChange={onTokensChange}
          lockedFieldIds={['entityId']}
        />,
      );

      expect(screen.queryByDisplayValue('weather-agent')).toBeNull();
    });

    it('mixes locked and editable pills in the same toolbar', () => {
      const onTokensChange = vi.fn();
      const tokens: PropertyFilterToken[] = [
        { fieldId: 'entityId', value: 'weather-agent' },
        { fieldId: 'entityName', value: 'searched' },
      ];
      render(
        <PropertyFilterApplied
          fields={FIELDS}
          tokens={tokens}
          onTokensChange={onTokensChange}
          lockedFieldIds={['entityId']}
        />,
      );

      expect(screen.getByLabelText('Primitive ID filter is locked by context')).toBeDefined();
      expect(screen.getByRole('button', { name: /Remove Primitive Name filter/i })).toBeDefined();
    });
  });
});

describe('PropertyFilterApplied — nothing to show', () => {
  it('renders nothing at all with no tokens', () => {
    const { container } = render(<PropertyFilterApplied fields={FIELDS} tokens={[]} onTokensChange={vi.fn()} />);

    expect(container.innerHTML).toBe('');
  });

  it('skips a token whose field it does not know', () => {
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[
          { fieldId: 'not-a-field', value: 'x' },
          { fieldId: 'entityId', value: 'weather-agent' },
        ]}
        onTokensChange={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('button', { name: /Remove/i })).toHaveLength(1);
  });
});

describe('PropertyFilterApplied — editing a text pill', () => {
  it('shows the value it was given', () => {
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'entityId', value: 'weather-agent' }]}
        onTokensChange={vi.fn()}
      />,
    );

    expect((screen.getByDisplayValue('weather-agent') as HTMLInputElement).value).toBe('weather-agent');
  });

  it('reports every keystroke so the results follow along', () => {
    const onTokensChange = vi.fn();
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'entityId', value: 'weather' }]}
        onTokensChange={onTokensChange}
      />,
    );

    fireEvent.change(screen.getByDisplayValue('weather'), { target: { value: 'weather-agent' } });

    expect(onTokensChange).toHaveBeenCalledWith([{ fieldId: 'entityId', value: 'weather-agent' }]);
  });

  it('leaves the caret alone when only trailing space changed', () => {
    const onTokensChange = vi.fn();
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'entityId', value: 'weather' }]}
        onTokensChange={onTokensChange}
      />,
    );

    // Typing a space keeps the same stored value, so nothing round-trips.
    const input = screen.getByDisplayValue('weather') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'weather ' } });

    expect(onTokensChange).not.toHaveBeenCalled();
    expect(input.value).toBe('weather ');
  });

  it('trims the draft on Enter', () => {
    const onTokensChange = vi.fn();
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'entityId', value: 'weather' }]}
        onTokensChange={onTokensChange}
      />,
    );

    const input = screen.getByDisplayValue('weather');
    fireEvent.change(input, { target: { value: '  weather-agent  ' } });
    onTokensChange.mockClear();
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onTokensChange).toHaveBeenCalledWith([{ fieldId: 'entityId', value: 'weather-agent' }]);
  });

  it('says nothing on Enter when the trimmed draft is already stored', () => {
    const onTokensChange = vi.fn();
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'entityId', value: 'weather' }]}
        onTokensChange={onTokensChange}
      />,
    );

    fireEvent.keyDown(screen.getByDisplayValue('weather'), { key: 'Enter' });

    expect(onTokensChange).not.toHaveBeenCalled();
  });

  it('puts the stored value back on Escape', () => {
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'entityId', value: 'weather' }]}
        onTokensChange={vi.fn()}
      />,
    );

    const input = screen.getByDisplayValue('weather');
    fireEvent.change(input, { target: { value: 'weather ' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect((input as HTMLInputElement).value).toBe('weather');
  });

  it('leaves other keys to the input', () => {
    const onTokensChange = vi.fn();
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'entityId', value: 'weather' }]}
        onTokensChange={onTokensChange}
      />,
    );

    fireEvent.keyDown(screen.getByDisplayValue('weather'), { key: 'a' });

    expect(onTokensChange).not.toHaveBeenCalled();
  });

  it('takes Enter for itself so it never submits a surrounding form', () => {
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'entityId', value: 'weather' }]}
        onTokensChange={vi.fn()}
      />,
    );

    // fireEvent reports false when the handler called preventDefault.
    expect(fireEvent.keyDown(screen.getByDisplayValue('weather'), { key: 'Enter' })).toBe(false);
  });

  it('takes Escape for itself, and gives up the caret', () => {
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'entityId', value: 'weather' }]}
        onTokensChange={vi.fn()}
      />,
    );

    const input = screen.getByDisplayValue('weather');
    input.focus();

    expect(fireEvent.keyDown(input, { key: 'Escape' })).toBe(false);
    expect(document.activeElement).not.toBe(input);
  });

  it('leaves the caret in place on an ordinary key', () => {
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'entityId', value: 'weather' }]}
        onTokensChange={vi.fn()}
      />,
    );

    const input = screen.getByDisplayValue('weather');
    input.focus();

    fireEvent.keyDown(input, { key: 'a' });

    expect(document.activeElement).toBe(input);
  });

  it('follows the stored value when it changes from outside', () => {
    const { rerender } = render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'entityId', value: 'weather' }]}
        onTokensChange={vi.fn()}
      />,
    );

    rerender(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'entityId', value: 'from-elsewhere' }]}
        onTokensChange={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue('from-elsewhere')).toBeTruthy();
  });

  it('names the field in its own placeholder', () => {
    render(
      <PropertyFilterApplied fields={FIELDS} tokens={[{ fieldId: 'entityId', value: '' }]} onTokensChange={vi.fn()} />,
    );

    expect(screen.getByPlaceholderText('Enter Primitive ID')).toBeTruthy();
  });

  it('prefers a placeholder the field carries', () => {
    render(
      <PropertyFilterApplied
        fields={[{ id: 'entityId', label: 'Primitive ID', kind: 'text', placeholder: 'agent id' }]}
        tokens={[{ fieldId: 'entityId', value: '' }]}
        onTokensChange={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText('agent id')).toBeTruthy();
  });

  it('focuses the pill that was just created, and only that one', () => {
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[
          { fieldId: 'entityId', value: 'first' },
          { fieldId: 'entityName', value: 'second' },
        ]}
        autoFocusFieldId="entityName"
        onTokensChange={vi.fn()}
      />,
    );

    expect(document.activeElement).toBe(screen.getByDisplayValue('second'));
  });

  it('focuses a pill the moment it becomes the newly created one', () => {
    const tokens: PropertyFilterToken[] = [{ fieldId: 'entityId', value: 'first' }];
    const { rerender } = render(<PropertyFilterApplied fields={FIELDS} tokens={tokens} onTokensChange={vi.fn()} />);
    expect(document.activeElement).not.toBe(screen.getByDisplayValue('first'));

    rerender(
      <PropertyFilterApplied fields={FIELDS} tokens={tokens} autoFocusFieldId="entityId" onTokensChange={vi.fn()} />,
    );

    expect(document.activeElement).toBe(screen.getByDisplayValue('first'));
  });

  it('focuses nothing when no pill was just created', () => {
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'entityId', value: 'first' }]}
        onTokensChange={vi.fn()}
      />,
    );

    expect(document.activeElement).not.toBe(screen.getByDisplayValue('first'));
  });
});

describe('PropertyFilterApplied — removing a pill', () => {
  it('removes the pill that was clicked, keeping the rest in order', () => {
    const onTokensChange = vi.fn();
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[
          { fieldId: 'entityId', value: 'a' },
          { fieldId: 'entityName', value: 'b' },
        ]}
        onTokensChange={onTokensChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Remove Primitive Name filter/i }));

    expect(onTokensChange).toHaveBeenCalledWith([{ fieldId: 'entityId', value: 'a' }]);
  });

  it('leaves the caret alone while the Remove button is being pressed', () => {
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'entityId', value: 'weather' }]}
        onTokensChange={vi.fn()}
      />,
    );

    const remove = screen.getByRole('button', { name: /Remove Primitive ID filter/i });

    // Pressing it must not blur the input first, or the click lands on nothing.
    expect(fireEvent.mouseDown(remove)).toBe(false);
  });

  it('tells the pills apart when two share a field', () => {
    const onTokensChange = vi.fn();
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[
          { fieldId: 'entityId', value: 'a' },
          { fieldId: 'entityId', value: 'b' },
        ]}
        onTokensChange={onTokensChange}
      />,
    );

    const removes = screen.getAllByRole('button', { name: /Remove Primitive ID filter/i });
    fireEvent.click(removes[1] as HTMLElement);

    expect(onTokensChange).toHaveBeenCalledWith([{ fieldId: 'entityId', value: 'a' }]);
  });

  it('cannot be used at all while the toolbar is disabled', () => {
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'entityId', value: 'a' }]}
        disabled
        onTokensChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Remove Primitive ID filter/i }).hasAttribute('disabled')).toBe(true);
    expect((screen.getByDisplayValue('a') as HTMLInputElement).disabled).toBe(true);
  });
});

describe('PropertyFilterApplied — a pick-multi pill', () => {
  const pickTokens: PropertyFilterToken[] = [{ fieldId: 'rootEntityType', value: ['agent'] }];

  it('shows the raw selection on the trigger, joined', () => {
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'rootEntityType', value: ['agent', 'workflow_run'] }]}
        onTokensChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'agent, workflow_run' })).toBeTruthy();
  });

  it('reads an empty selection as Any', () => {
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'rootEntityType', value: [] }]}
        onTokensChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Any' })).toBeTruthy();
  });

  it('shows a single string selection as it stands', () => {
    render(<PropertyFilterApplied fields={FIELDS} tokens={pickTokens} onTokensChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'agent' })).toBeTruthy();
    // A choice, not free text — there is nothing to type into.
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('replaces the value from the pill’s own panel', async () => {
    const onTokensChange = vi.fn();
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'rootEntityType', value: 'agent' }]}
        onTokensChange={onTokensChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'agent' }));

    const workflow = await screen.findByRole('radio', { name: /Workflow/i });
    fireEvent.click(workflow);

    expect(onTokensChange).toHaveBeenLastCalledWith([{ fieldId: 'rootEntityType', value: 'workflow_run' }]);
  });

  it('keeps the pill in a neutral state when the last choice is unticked', async () => {
    const onTokensChange = vi.fn();
    const multiFields: PropertyFilterField[] = [
      {
        id: 'rootEntityType',
        label: 'Primitive Type',
        kind: 'pick-multi',
        multi: true,
        options: [
          { label: 'Agent', value: 'agent' },
          { label: 'Workflow', value: 'workflow_run' },
        ],
      },
    ];
    render(
      <PropertyFilterApplied
        fields={multiFields}
        tokens={[{ fieldId: 'rootEntityType', value: ['agent'] }]}
        onTokensChange={onTokensChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'agent' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /Agent/i }));

    // The filter survives as an empty selection; only × takes the pill away.
    expect(onTokensChange).toHaveBeenLastCalledWith([{ fieldId: 'rootEntityType', value: [] }]);
  });

  it('removes the pill on request', () => {
    const onTokensChange = vi.fn();
    render(<PropertyFilterApplied fields={FIELDS} tokens={pickTokens} onTokensChange={onTokensChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Remove Primitive Type filter/i }));

    expect(onTokensChange).toHaveBeenCalledWith([]);
  });
});

describe('PropertyFilterApplied — a locked pill', () => {
  it('explains itself in the caller’s words on focus', async () => {
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'entityId', value: 'a' }]}
        lockedFieldIds={['entityId']}
        lockedTooltipContent="Scoped to this agent."
        onTokensChange={vi.fn()}
      />,
    );

    fireEvent.focus(screen.getByLabelText('Primitive ID filter is locked by context'));

    expect(await screen.findByText('Scoped to this agent.')).toBeTruthy();
  });

  it('explains itself in its own words when the caller gave none', async () => {
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'entityId', value: 'a' }]}
        lockedFieldIds={['entityId']}
        onTokensChange={vi.fn()}
      />,
    );

    fireEvent.focus(screen.getByLabelText('Primitive ID filter is locked by context'));

    expect(
      await screen.findByText('This filter is set by the current context and cannot be removed here.'),
    ).toBeTruthy();
  });

  it('reads a locked pick-multi selection by its option labels', () => {
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'rootEntityType', value: ['agent', 'workflow_run'] }]}
        lockedFieldIds={['rootEntityType']}
        onTokensChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Agent, Workflow')).toBeTruthy();
  });

  it('falls back to the raw value for an option it does not offer', () => {
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'rootEntityType', value: ['agent', 'mystery'] }]}
        lockedFieldIds={['rootEntityType']}
        onTokensChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Agent, mystery')).toBeTruthy();
  });

  it('reads a locked empty selection as Any', () => {
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'rootEntityType', value: [] }]}
        lockedFieldIds={['rootEntityType']}
        onTokensChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Any')).toBeTruthy();
  });

  it('reads a locked single selection by its option label', () => {
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'rootEntityType', value: 'workflow_run' }]}
        lockedFieldIds={['rootEntityType']}
        onTokensChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Workflow')).toBeTruthy();
  });
});

describe('PropertyFilterApplied — telling a choice from free text', () => {
  it('offers a choice, not an input, for a pick-multi field holding one value', () => {
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'rootEntityType', value: 'agent' }]}
        onTokensChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'agent' })).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('falls back to a plain read-only pill for a text field holding a list', () => {
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'entityId', value: ['a', 'b'] }]}
        onTokensChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('a, b')).toBeTruthy();
    // Read-only means read-only: the value is text, not something to click open.
    expect(screen.getByText('a, b').closest('button')).toBeNull();
    expect(screen.getByRole('button', { name: /Remove Primitive ID filter/i })).toBeTruthy();
  });
});

describe('PropertyFilterApplied — a locked pill with awkward data', () => {
  it('reads a locked text field as text even when it carries options', () => {
    render(
      <PropertyFilterApplied
        fields={[
          { id: 'entityId', label: 'Primitive ID', kind: 'text', options: [{ label: 'Agent', value: 'agent' }] },
        ]}
        tokens={[{ fieldId: 'entityId', value: 'agent' }]}
        lockedFieldIds={['entityId']}
        onTokensChange={vi.fn()}
      />,
    );

    // A free-text field is shown as typed, not translated through its suggestions.
    expect(screen.getByText('agent')).toBeTruthy();
    expect(screen.queryByText('Agent')).toBeNull();
  });

  it('falls back to the raw single value for an option it does not offer', () => {
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[{ fieldId: 'rootEntityType', value: 'mystery' }]}
        lockedFieldIds={['rootEntityType']}
        onTokensChange={vi.fn()}
      />,
    );

    expect(screen.getByText('mystery')).toBeTruthy();
  });
});

describe('PropertyFilterApplied — leaving the caller’s data alone', () => {
  it('does not edit the token list it was handed', () => {
    const tokens: PropertyFilterToken[] = [
      { fieldId: 'entityId', value: 'a' },
      { fieldId: 'entityName', value: 'b' },
    ];
    render(<PropertyFilterApplied fields={FIELDS} tokens={tokens} onTokensChange={vi.fn()} />);

    fireEvent.change(screen.getByDisplayValue('a'), { target: { value: 'changed' } });

    expect(tokens).toEqual([
      { fieldId: 'entityId', value: 'a' },
      { fieldId: 'entityName', value: 'b' },
    ]);
  });

  it('keeps the other pills when one of them is edited', () => {
    const onTokensChange = vi.fn();
    render(
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={[
          { fieldId: 'entityId', value: 'a' },
          { fieldId: 'entityName', value: 'b' },
        ]}
        onTokensChange={onTokensChange}
      />,
    );

    fireEvent.change(screen.getByDisplayValue('b'), { target: { value: 'changed' } });

    expect(onTokensChange).toHaveBeenLastCalledWith([
      { fieldId: 'entityId', value: 'a' },
      { fieldId: 'entityName', value: 'changed' },
    ]);
  });
});

describe('PropertyFilterApplied — a store that trims', () => {
  function TrimmingHarness() {
    const [tokens, setTokens] = useState<PropertyFilterToken[]>([{ fieldId: 'entityId', value: 'weather' }]);
    return (
      <PropertyFilterApplied
        fields={FIELDS}
        tokens={tokens}
        onTokensChange={next =>
          setTokens(
            next.map(token => (typeof token.value === 'string' ? { ...token, value: token.value.trim() } : token)),
          )
        }
      />
    );
  }

  it('keeps the space the user just typed, even though the store dropped it', () => {
    render(<TrimmingHarness />);

    const input = screen.getByDisplayValue('weather') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'weather-agent ' } });

    // The store holds 'weather-agent'; the field must not snap back mid-word
    // and take the caret with it.
    expect(input.value).toBe('weather-agent ');
  });
});
