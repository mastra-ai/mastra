// @vitest-environment jsdom
import '@/test/inert-resize-observer';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { Button } from '@/ds/components/Button';
import { CodeEditor } from '@/ds/components/CodeEditor';
import {
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxInput,
  ComboboxRoot,
  ComboboxSearch,
} from '@/ds/components/Combobox/combobox-parts';
import { Command, CommandInput } from '@/ds/components/Command';
import { CommentEditor } from '@/ds/components/Comment/comment-editor';
import { ComposerInput } from '@/ds/components/Composer/composer';
import { FilterBar } from '@/ds/components/FilterBar';
import { Input } from '@/ds/components/Input';
import { InputGroup, InputGroupInput, InputGroupTextarea } from '@/ds/components/InputGroup';
import { InputNumber, InputNumberGroup, InputNumberInput } from '@/ds/components/InputNumber';
import { SavedViewNameInput } from '@/ds/components/SavedViews/saved-view-name-input';
import { SearchInput, listSearchProps } from '@/ds/components/SearchInput';
import { Select, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { Textarea } from '@/ds/components/Textarea';
import { TreeInput } from '@/ds/components/Tree/tree-input';

const ignore = () => {};

const textEntryFields = {
  Input: <Input aria-label="Name" />,
  Textarea: <Textarea aria-label="Notes" />,
  InputGroupInput: (
    <InputGroup>
      <InputGroupInput aria-label="Name" />
    </InputGroup>
  ),
  InputGroupTextarea: (
    <InputGroup size="sm">
      <InputGroupTextarea aria-label="Notes" />
    </InputGroup>
  ),
  InputNumberInput: (
    <InputNumber>
      <InputNumberGroup>
        <InputNumberInput aria-label="Count" />
      </InputNumberGroup>
    </InputNumber>
  ),
  SearchInput: <SearchInput label="Search" value="" onValueChange={ignore} />,
  'SearchInput, debounced': (
    <SearchInput
      {...listSearchProps}
      className="max-w-120"
      label="Search agents"
      placeholder="Search agents"
      onValueChange={ignore}
    />
  ),
  ComboboxInput: (
    <ComboboxRoot items={['OpenAI']}>
      <ComboboxInput aria-label="Provider" />
    </ComboboxRoot>
  ),
  ComboboxChipsInput: (
    <ComboboxRoot multiple items={['OpenAI']}>
      <ComboboxChips aria-label="Providers">
        <ComboboxChipsInput aria-label="Providers" />
      </ComboboxChips>
    </ComboboxRoot>
  ),
  ComboboxSearch: (
    <ComboboxRoot items={['OpenAI']}>
      <ComboboxSearch aria-label="Search providers" />
    </ComboboxRoot>
  ),
  CommandInput: (
    <Command>
      <CommandInput aria-label="Search commands" />
    </Command>
  ),
  ComposerInput: <ComposerInput aria-label="Message" />,
  CommentEditor: <CommentEditor initialBody="" onSave={ignore} onClose={ignore} />,
  TreeInput: <TreeInput type="file" onSubmit={ignore} />,
  SavedViewNameInput: <SavedViewNameInput name="Errors" onCommit={ignore} />,
  CodeEditor: <CodeEditor aria-label="Tool input" value="{}" />,
  'FilterBar.Input': (
    <FilterBar fields={[]} value={[]} onValueChange={ignore}>
      <FilterBar.Input placeholder="Filter" />
    </FilterBar>
  ),
} satisfies Record<string, ReactElement>;

const typedField = (container: HTMLElement) =>
  container.querySelector<HTMLElement>(
    'input:not([type="hidden"]):not([aria-hidden="true"]), textarea, [contenteditable="true"]',
  );

describe('text-entry fields on a touch screen', () => {
  it.each(Object.entries(textEntryFields))(
    '%s takes the 16px touch floor, so focusing it on iOS does not zoom the page',
    (_name, ui) => {
      const field = typedField(render(ui).container);

      expect(field?.classList.contains('zoom-safe-text')).toBe(true);
    },
  );

  it('leaves controls you do not type into at their own size', () => {
    const { container } = render(
      <>
        <Button>Save</Button>
        <Select items={[{ value: 'openai', label: 'OpenAI' }]}>
          <SelectTrigger aria-label="Provider">
            <SelectValue />
          </SelectTrigger>
        </Select>
      </>,
    );

    expect(container.querySelectorAll('.zoom-safe-text')).toHaveLength(0);
  });
});
