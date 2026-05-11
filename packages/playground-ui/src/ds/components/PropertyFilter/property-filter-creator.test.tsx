// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
