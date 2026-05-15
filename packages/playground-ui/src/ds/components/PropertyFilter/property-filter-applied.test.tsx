// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PropertyFilterApplied } from './property-filter-applied';
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
