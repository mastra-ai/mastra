// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import type * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { textFieldAutofillProps } from './password-manager-autofill';
import { Command, CommandInput } from '@/ds/components/Command';
import { ComposerInput } from '@/ds/components/Composer';
import { Input } from '@/ds/components/Input';
import { InputGroup, InputGroupInput, InputGroupTextarea } from '@/ds/components/InputGroup';
import { InputNumber, InputNumberGroup, InputNumberInput } from '@/ds/components/InputNumber';
import { SavedViewNameInput } from '@/ds/components/SavedViews/saved-view-name-input';
import { SearchInput } from '@/ds/components/SearchInput';
import { Textarea } from '@/ds/components/Textarea';
import { Tree } from '@/ds/components/Tree';

afterEach(() => {
  cleanup();
});

const IGNORE_HINTS = {
  'data-1p-ignore': 'true',
  'data-lpignore': 'true',
  'data-bwignore': 'true',
  'data-form-type': 'other',
  'data-protonpass-ignore': 'true',
} as const;

function expectOptedOut(el: HTMLElement) {
  expect(el.getAttribute('autocomplete')).toBe('off');
  for (const [name, value] of Object.entries(IGNORE_HINTS)) {
    expect(el.getAttribute(name), name).toBe(value);
  }
}

function expectNoHints(el: HTMLElement) {
  for (const name of Object.keys(IGNORE_HINTS)) {
    expect(el.hasAttribute(name), name).toBe(false);
  }
}

describe('textFieldAutofillProps', () => {
  it.each([undefined, '', 'off', ' OFF '])('opts out of password managers for %j', value => {
    expect(textFieldAutofillProps(value)).toEqual({ autoComplete: 'off', ...IGNORE_HINTS });
  });

  it.each(['email', 'username', 'name', 'current-password', 'new-password', 'one-time-code', 'section-a email', 'on'])(
    'passes the explicit token %j through without ignore hints',
    value => {
      expect(textFieldAutofillProps(value)).toEqual({ autoComplete: value });
    },
  );
});

// Every DS text field must opt out by default, and must render an explicit autofill token
// untouched with no ignore hints so credential forms keep working.
const fields: Array<{
  name: string;
  render: (autoComplete?: string) => React.ReactElement;
  explicit: boolean;
}> = [
  { name: 'Input', render: ac => <Input aria-label="field" autoComplete={ac} />, explicit: true },
  {
    name: 'Input type=password',
    render: ac => <Input aria-label="field" type="password" autoComplete={ac} />,
    explicit: true,
  },
  {
    name: 'InputGroupInput',
    render: ac => (
      <InputGroup>
        <InputGroupInput aria-label="field" autoComplete={ac} />
      </InputGroup>
    ),
    explicit: true,
  },
  {
    name: 'InputGroupTextarea',
    render: ac => (
      <InputGroup>
        <InputGroupTextarea aria-label="field" autoComplete={ac} />
      </InputGroup>
    ),
    explicit: true,
  },
  {
    name: 'SearchInput',
    render: ac => <SearchInput label="field" value="" onValueChange={() => {}} autoComplete={ac} />,
    explicit: true,
  },
  { name: 'Textarea', render: ac => <Textarea aria-label="field" autoComplete={ac} />, explicit: true },
  {
    name: 'InputNumberInput',
    render: ac => (
      <InputNumber>
        <InputNumberGroup>
          <InputNumberInput aria-label="field" autoComplete={ac} />
        </InputNumberGroup>
      </InputNumber>
    ),
    explicit: true,
  },
  { name: 'ComposerInput', render: ac => <ComposerInput aria-label="field" autoComplete={ac} />, explicit: true },
  {
    name: 'CommandInput',
    render: ac => (
      <Command>
        <CommandInput aria-label="field" autoComplete={ac} />
      </Command>
    ),
    explicit: false,
  },
  {
    name: 'Tree.Input',
    render: () => (
      <ul>
        <Tree.Input type="file" placeholder="field" onSubmit={() => {}} autoFocus={false} />
      </ul>
    ),
    explicit: false,
  },
  {
    name: 'SavedViewNameInput',
    render: () => <SavedViewNameInput name="field" onCommit={() => {}} />,
    explicit: false,
  },
];

const getField = () =>
  (screen.queryByLabelText('field') ??
    screen.queryByPlaceholderText('field') ??
    screen.getByLabelText('View name')) as HTMLElement;

describe.each(fields)('$name', ({ render: renderField, explicit }) => {
  it('opts out of password manager autofill by default', () => {
    render(renderField());
    expectOptedOut(getField());
  });

  it.runIf(explicit)('keeps an explicit autofill token and adds no ignore hints', () => {
    render(renderField('email'));
    const el = getField();
    expect(el.getAttribute('autocomplete')).toBe('email');
    expectNoHints(el);
  });
});
