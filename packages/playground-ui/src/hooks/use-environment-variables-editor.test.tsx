// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { ChangeEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useEnvironmentVariablesEditor } from './use-environment-variables-editor';
import type { EnvironmentVariableRow } from './use-environment-variables-editor';

function fileUploadEvent(file: File) {
  return {
    target: {
      files: [file],
    },
  } as unknown as ChangeEvent<HTMLInputElement>;
}

describe('useEnvironmentVariablesEditor', () => {
  it('builds typed rows from pasted env text while preserving non-editable rows', () => {
    type ProjectEnvRow = EnvironmentVariableRow & {
      id: string;
      scope: 'shared' | 'project';
    };

    const onRowsChange = vi.fn();
    const { result } = renderHook(() =>
      useEnvironmentVariablesEditor<ProjectEnvRow>({
        initialRows: [
          { id: 'shared:global-token', scope: 'shared', key: 'GLOBAL_TOKEN', value: 'shared-secret' },
          { id: 'draft', scope: 'project', key: '', value: '' },
        ],
        onRowsChange,
        createDefaultRow: () => ({ id: 'draft', scope: 'project', key: '', value: '' }),
        createRow: entry => ({ id: `project:${entry.key}`, scope: 'project', ...entry }),
        getEditableRows: rows => rows.filter(row => row.scope === 'project'),
        getPreservedRows: rows => rows.filter(row => row.scope === 'shared'),
      }),
    );

    act(() => {
      expect(result.current.handlePaste(1, 'API_KEY=secret\nDATABASE_URL=postgres://localhost/db')).toBe(true);
    });

    expect(result.current.rows).toEqual([
      { id: 'shared:global-token', scope: 'shared', key: 'GLOBAL_TOKEN', value: 'shared-secret' },
      { id: 'project:API_KEY', scope: 'project', key: 'API_KEY', value: 'secret' },
      {
        id: 'project:DATABASE_URL',
        scope: 'project',
        key: 'DATABASE_URL',
        value: 'postgres://localhost/db',
      },
    ]);
    expect(onRowsChange).toHaveBeenLastCalledWith(result.current.rows);
  });

  it('detects env assignment pastes without hijacking ordinary lowercase value pastes', () => {
    const { result } = renderHook(() =>
      useEnvironmentVariablesEditor({
        initialRows: [{ key: 'PUBLIC_URL', value: 'https://example.com' }],
      }),
    );

    act(() => {
      expect(result.current.handlePaste(0, 'token=part')).toBe(false);
    });

    expect(result.current.rows).toEqual([{ key: 'PUBLIC_URL', value: 'https://example.com' }]);

    act(() => {
      expect(result.current.handlePaste(0, 'export API_KEY=secret=with=equals')).toBe(true);
    });

    expect(result.current.rows).toEqual([
      { key: 'PUBLIC_URL', value: 'https://example.com' },
      { key: 'API_KEY', value: 'secret=with=equals' },
    ]);
  });

  it('tracks dirty rows, reset state, and revealed values independently from the UI', () => {
    const { result } = renderHook(() =>
      useEnvironmentVariablesEditor({
        initialRows: [{ key: 'API_KEY', value: 'secret' }],
      }),
    );

    expect(result.current.isDirty).toBe(false);
    expect(result.current.isValueRevealed(0)).toBe(false);

    act(() => {
      result.current.toggleValueVisibility(0);
    });
    expect(result.current.isValueRevealed(0)).toBe(true);

    act(() => {
      result.current.updateRow(0, { value: 'rotated-secret' });
    });
    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.resetRows();
    });
    expect(result.current.rows).toEqual([{ key: 'API_KEY', value: 'secret' }]);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isValueRevealed(0)).toBe(false);
  });

  it('handles real env file uploads without mutating rows on invalid files', async () => {
    const { result } = renderHook(() =>
      useEnvironmentVariablesEditor({
        initialRows: [{ key: '', value: '' }],
      }),
    );

    await act(async () => {
      await result.current.handleFileUpload(fileUploadEvent(new File(['\0'], '.env', { type: 'text/plain' })));
    });

    expect(result.current.uploadError).toBe('File appears to be binary. Please upload a plain-text .env file.');
    expect(result.current.rows).toEqual([{ key: '', value: '' }]);

    await act(async () => {
      await result.current.handleFileUpload(
        fileUploadEvent(new File(['API_KEY=secret\nPUBLIC_URL=https://example.com'], '.env', { type: 'text/plain' })),
      );
    });

    expect(result.current.uploadError).toBeNull();
    expect(result.current.rows).toEqual([
      { key: 'API_KEY', value: 'secret' },
      { key: 'PUBLIC_URL', value: 'https://example.com' },
    ]);
  });
});
