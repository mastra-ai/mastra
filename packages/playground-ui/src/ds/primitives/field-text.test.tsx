// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Combobox } from '@/ds/components/Combobox';
import { DateTimePicker } from '@/ds/components/DateTimePicker';
import { Input } from '@/ds/components/Input';
import { InputGroup, InputGroupInput } from '@/ds/components/InputGroup';
import { Select, SelectTrigger, SelectValue } from '@/ds/components/Select';

afterEach(() => {
  cleanup();
});

// Typed and picked values drifted apart once: inputs at the medium weight, selects and dates at the regular one.
const fields = [
  ['Input', () => <Input aria-label="field" placeholder="Pick one" />],
  [
    'InputGroup',
    () => (
      <InputGroup>
        <InputGroupInput aria-label="field" placeholder="Pick one" />
      </InputGroup>
    ),
  ],
  [
    'Select',
    () => (
      <Select>
        <SelectTrigger aria-label="field">
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
      </Select>
    ),
  ],
  ['Combobox', () => <Combobox aria-label="field" options={[]} placeholder="Pick one" />],
  ['multiple Combobox', () => <Combobox multiple aria-label="field" options={[]} placeholder="Pick one" />],
] as const;

describe('text in a row of fields', () => {
  it.each(fields)('%s shows its value in the control text role', (_name, renderField) => {
    render(renderField());

    const { classList } = screen.getByLabelText('field');
    expect(classList).toContain('text-label');
    expect(classList).not.toContain('text-body-sm');
  });

  it.each(fields)('%s shows its placeholder in the placeholder color', (_name, renderField) => {
    render(renderField());

    expect(screen.getByLabelText('field').className).toMatch(
      /(^|\s)(placeholder|data-\[placeholder\]):text-placeholder(\s|$)/,
    );
  });

  it('shows a date with nothing picked in the placeholder color, on a trigger in the control text role', () => {
    render(<DateTimePicker value={undefined} onValueChange={() => {}} placeholder="Pick one" />);

    expect(screen.getByText('Pick one').classList).toContain('text-placeholder');
    expect(screen.getByRole('button').classList).toContain('text-label');
  });
});
