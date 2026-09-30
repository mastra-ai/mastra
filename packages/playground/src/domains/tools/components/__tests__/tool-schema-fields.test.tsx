import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToolSchemaFields } from '../tool-schema-fields';

describe('ToolSchemaFields', () => {
  describe('when the schema is a dictionary', () => {
    it('shows the entry type instead of the empty message', () => {
      render(
        <ToolSchemaFields
          schema={{ type: 'object', additionalProperties: { type: 'string' } }}
          emptyMessage="No output schema defined."
        />,
      );

      expect(screen.getByText('Record<string, string>')).not.toBeNull();
      expect(screen.queryByText('No output schema defined.')).toBeNull();
    });
  });

  describe('when the schema has no shape', () => {
    it('shows the empty message', () => {
      render(
        <ToolSchemaFields
          schema={{ $schema: 'https://json-schema.org/draft/2020-12/schema' }}
          emptyMessage="This tool takes no input."
        />,
      );

      expect(screen.getByText('This tool takes no input.')).not.toBeNull();
    });
  });
});
