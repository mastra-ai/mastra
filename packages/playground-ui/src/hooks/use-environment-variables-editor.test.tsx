// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useCustomEnvironmentVariablesEditor, useEnvironmentVariablesEditor } from './use-environment-variables-editor';
import type {
  EnvironmentVariableRow,
  EnvironmentVariablesEditorFileUploadEvent,
} from './use-environment-variables-editor';

function fileUploadEvent(file: File): EnvironmentVariablesEditorFileUploadEvent {
  return {
    target: {
      files: [file],
    },
  };
}

describe('useEnvironmentVariablesEditor', () => {
  it('builds typed rows from pasted env text while preserving non-editable rows', () => {
    type ProjectEnvRow = EnvironmentVariableRow & {
      id: string;
      scope: 'shared' | 'project';
    };

    const onRowsChange = vi.fn();
    const { result } = renderHook(() =>
      useCustomEnvironmentVariablesEditor<ProjectEnvRow>({
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

    expect(result.current.uploadError).toBe('File appears to be binary. Please import a plain-text .env file.');
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

describe('useEnvironmentVariablesEditor rows', () => {
  it('starts with a single empty row when it is given none', () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor());

    expect(result.current.rows).toEqual([{ key: '', value: '' }]);
    expect(result.current.isDirty).toBe(false);
  });

  it('starts with a single empty row when it is given an empty list', () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ initialRows: [] }));

    expect(result.current.rows).toEqual([{ key: '', value: '' }]);
  });

  it('copies the rows it was given rather than holding onto them', () => {
    const initialRows = [{ key: 'A', value: '1' }];
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ initialRows }));

    act(() => {
      result.current.updateRow(0, { value: '2' });
    });

    expect(initialRows[0]?.value).toBe('1');
  });

  it('appends an empty row on request, and a given one when handed it', () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ initialRows: [{ key: 'A', value: '1' }] }));

    act(() => {
      result.current.appendRow();
    });
    expect(result.current.rows).toEqual([
      { key: 'A', value: '1' },
      { key: '', value: '' },
    ]);

    act(() => {
      result.current.appendRow({ key: 'B', value: '2' });
    });
    expect(result.current.rows.at(-1)).toEqual({ key: 'B', value: '2' });
  });

  it('patches only the row that was named', () => {
    const { result } = renderHook(() =>
      useEnvironmentVariablesEditor({
        initialRows: [
          { key: 'A', value: '1' },
          { key: 'B', value: '2' },
        ],
      }),
    );

    act(() => {
      result.current.updateRow(1, { value: 'changed' });
    });

    expect(result.current.rows).toEqual([
      { key: 'A', value: '1' },
      { key: 'B', value: 'changed' },
    ]);
  });

  it('ignores a patch aimed at a row that does not exist', () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ initialRows: [{ key: 'A', value: '1' }] }));

    act(() => {
      result.current.updateRow(9, { value: 'nowhere' });
    });

    expect(result.current.rows).toEqual([{ key: 'A', value: '1' }]);
  });

  it('removes the row that was named', () => {
    const { result } = renderHook(() =>
      useEnvironmentVariablesEditor({
        initialRows: [
          { key: 'A', value: '1' },
          { key: 'B', value: '2' },
        ],
      }),
    );

    act(() => {
      result.current.removeRow(0);
    });

    expect(result.current.rows).toEqual([{ key: 'B', value: '2' }]);
  });

  it('leaves an empty row behind when the last one is removed', () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ initialRows: [{ key: 'A', value: '1' }] }));

    act(() => {
      result.current.removeRow(0);
    });

    // The editor is never left with nothing to type into.
    expect(result.current.rows).toEqual([{ key: '', value: '' }]);
  });

  it('replaces the whole set on request', () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ initialRows: [{ key: 'A', value: '1' }] }));

    act(() => {
      result.current.setRows([{ key: 'B', value: '2' }]);
    });

    expect(result.current.rows).toEqual([{ key: 'B', value: '2' }]);
  });

  it('hands back a copy for submitting, not the live rows', () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ initialRows: [{ key: 'A', value: '1' }] }));

    const submitted = result.current.getRowsForSubmit();
    submitted.push({ key: 'INJECTED', value: 'x' });

    expect(result.current.rows).toHaveLength(1);
  });

  it('collects the rows into the variables it will submit', () => {
    const { result } = renderHook(() =>
      useEnvironmentVariablesEditor({
        initialRows: [
          { key: 'A', value: '1' },
          { key: ' B ', value: '2' },
          { key: '', value: 'orphan' },
        ],
      }),
    );

    expect(result.current.getEnvironmentVariablesForSubmit()).toEqual({ A: '1', B: '2' });
  });
});

describe('useEnvironmentVariablesEditor row identity', () => {
  it('gives each row a stable id that survives an edit', () => {
    const { result } = renderHook(() =>
      useEnvironmentVariablesEditor({
        initialRows: [
          { key: 'A', value: '1' },
          { key: 'B', value: '2' },
        ],
      }),
    );

    const ids = [result.current.getRowId(0), result.current.getRowId(1)];
    expect(new Set(ids).size).toBe(2);

    act(() => {
      result.current.updateRow(0, { value: 'changed' });
    });

    expect([result.current.getRowId(0), result.current.getRowId(1)]).toEqual(ids);
  });

  it('keeps a removed row’s neighbours on their own ids', () => {
    const { result } = renderHook(() =>
      useEnvironmentVariablesEditor({
        initialRows: [
          { key: 'A', value: '1' },
          { key: 'B', value: '2' },
        ],
      }),
    );

    const secondId = result.current.getRowId(1);

    act(() => {
      result.current.removeRow(0);
    });

    // B moved up a slot and kept the id it already had.
    expect(result.current.getRowId(0)).toBe(secondId);
  });

  it('makes up an id for a row index it has never seen, and keeps it', () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor());

    const madeUp = result.current.getRowId(7);

    expect(madeUp).toMatch(/^environment-variable-row-\d+$/);
    expect(result.current.getRowId(7)).toBe(madeUp);
  });

  it('gives pasted rows their own ids without disturbing the rows around them', () => {
    const { result } = renderHook(() =>
      useEnvironmentVariablesEditor({
        initialRows: [
          { key: 'A', value: '1' },
          { key: 'B', value: '2' },
          { key: 'C', value: '3' },
        ],
      }),
    );

    const [idA, idB, idC] = [0, 1, 2].map(index => result.current.getRowId(index));

    act(() => {
      result.current.handlePaste(1, 'N1=1\nN2=2');
    });

    expect(result.current.rows.map(row => row.key)).toEqual(['A', 'B', 'N1', 'N2', 'C']);

    const ids = [0, 1, 2, 3, 4].map(index => result.current.getRowId(index));
    expect(ids[0]).toBe(idA);
    expect(ids[1]).toBe(idB);
    // C slid down two slots and kept its own id, and nothing shares an id.
    expect(ids[4]).toBe(idC);
    expect(new Set(ids).size).toBe(5);
  });

  it('gives rows pasted over the draft row fresh ids of their own', () => {
    type ScopedRow = EnvironmentVariableRow & { scope: 'shared' | 'project' };

    const { result } = renderHook(() =>
      useCustomEnvironmentVariablesEditor<ScopedRow>({
        initialRows: [
          { scope: 'shared', key: 'SHARED', value: 'kept' },
          { scope: 'project', key: '', value: '' },
        ],
        createDefaultRow: () => ({ scope: 'project', key: '', value: '' }),
        createRow: entry => ({ scope: 'project', ...entry }),
        getEditableRows: rows => rows.filter(row => row.scope === 'project'),
        getPreservedRows: rows => rows.filter(row => row.scope === 'shared'),
      }),
    );

    const sharedId = result.current.getRowId(0);
    const draftId = result.current.getRowId(1);

    act(() => {
      result.current.handlePaste(1, 'A=1\nB=2');
    });

    const ids = [0, 1, 2].map(index => result.current.getRowId(index));
    expect(ids[0]).toBe(sharedId);
    // The draft row is gone, so the rows that took its place start on new ids.
    expect(ids).not.toContain(draftId);
    expect(new Set(ids).size).toBe(3);
  });

  it('gives a reset set of rows fresh ids', () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ initialRows: [{ key: 'A', value: '1' }] }));

    const before = result.current.getRowId(0);

    act(() => {
      result.current.resetRows();
    });

    expect(result.current.getRowId(0)).not.toBe(before);
  });
});

describe('useEnvironmentVariablesEditor duplicates', () => {
  it('flags every row sharing a key, ignoring surrounding spaces', () => {
    const { result } = renderHook(() =>
      useEnvironmentVariablesEditor({
        initialRows: [
          { key: 'API_KEY', value: '1' },
          { key: ' API_KEY ', value: '2' },
          { key: 'OTHER', value: '3' },
        ],
      }),
    );

    expect(result.current.hasDuplicateKeys).toBe(true);
    expect(result.current.duplicateKeys).toEqual(new Set(['API_KEY']));
    expect(result.current.rowHasDuplicateKey(0)).toBe(true);
    expect(result.current.rowHasDuplicateKey(1)).toBe(true);
    expect(result.current.rowHasDuplicateKey(2)).toBe(false);
  });

  it('says nothing is duplicated when nothing is', () => {
    const { result } = renderHook(() =>
      useEnvironmentVariablesEditor({
        initialRows: [
          { key: 'A', value: '1' },
          { key: 'B', value: '2' },
        ],
      }),
    );

    expect(result.current.hasDuplicateKeys).toBe(false);
    expect(result.current.duplicateKeys.size).toBe(0);
  });

  it('does not call a row that is not there a duplicate', () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ initialRows: [{ key: 'A', value: '1' }] }));

    expect(result.current.rowHasDuplicateKey(9)).toBe(false);
  });
});

describe('useEnvironmentVariablesEditor visibility', () => {
  it('reveals and hides one row’s value at a time', () => {
    const { result } = renderHook(() =>
      useEnvironmentVariablesEditor({
        initialRows: [
          { key: 'A', value: '1' },
          { key: 'B', value: '2' },
        ],
      }),
    );

    expect(result.current.isValueRevealed(0)).toBe(false);

    act(() => {
      result.current.toggleValueVisibility(0);
    });
    expect(result.current.isValueRevealed(0)).toBe(true);
    expect(result.current.isValueRevealed(1)).toBe(false);

    act(() => {
      result.current.toggleValueVisibility(0);
    });
    expect(result.current.isValueRevealed(0)).toBe(false);
  });

  it('hides everything again when a row is removed', () => {
    const { result } = renderHook(() =>
      useEnvironmentVariablesEditor({
        initialRows: [
          { key: 'A', value: '1' },
          { key: 'B', value: '2' },
        ],
      }),
    );

    act(() => {
      result.current.toggleValueVisibility(1);
    });
    expect(result.current.isValueRevealed(1)).toBe(true);

    act(() => {
      result.current.removeRow(0);
    });

    // Row indices shifted, so a revealed index no longer means what it did.
    expect(result.current.isValueRevealed(1)).toBe(false);
  });

  it('hides everything again after a paste', () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ initialRows: [{ key: 'A', value: '1' }] }));

    act(() => {
      result.current.toggleValueVisibility(0);
    });

    act(() => {
      result.current.handlePaste(0, 'B=2\nC=3');
    });

    expect(result.current.isValueRevealed(0)).toBe(false);
  });
});

describe('useEnvironmentVariablesEditor paste', () => {
  it('refuses text that carries no assignment at all', () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor());

    act(() => {
      expect(result.current.handlePaste(0, 'just some prose')).toBe(false);
    });

    expect(result.current.rows).toEqual([{ key: '', value: '' }]);
  });

  it('takes over the empty row it was pasted into', () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor());

    act(() => {
      result.current.handlePaste(0, 'A=1\nB=2');
    });

    // The blank row is replaced, not pushed along in front of the paste.
    expect(result.current.rows).toEqual([
      { key: 'A', value: '1' },
      { key: 'B', value: '2' },
    ]);
  });

  it('inserts after a row that already has something in it', () => {
    const { result } = renderHook(() =>
      useEnvironmentVariablesEditor({
        initialRows: [
          { key: 'FIRST', value: '1' },
          { key: 'LAST', value: '9' },
        ],
      }),
    );

    act(() => {
      result.current.handlePaste(0, 'A=1\nB=2');
    });

    expect(result.current.rows.map(row => row.key)).toEqual(['FIRST', 'A', 'B', 'LAST']);
  });

  it('replaces an empty row in the middle rather than pushing past it', () => {
    const { result } = renderHook(() =>
      useEnvironmentVariablesEditor({
        initialRows: [
          { key: 'FIRST', value: '1' },
          { key: '  ', value: '' },
          { key: 'LAST', value: '9' },
        ],
      }),
    );

    act(() => {
      result.current.handlePaste(1, 'A=1\nB=2');
    });

    expect(result.current.rows.map(row => row.key)).toEqual(['FIRST', 'A', 'B', 'LAST']);
  });

  it('appends when the paste names a row that is not there', () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ initialRows: [{ key: 'FIRST', value: '1' }] }));

    act(() => {
      result.current.handlePaste(9, 'A=1\nB=2');
    });

    expect(result.current.rows.map(row => row.key)).toEqual(['FIRST', 'A', 'B']);
  });

  it('clears a standing upload error', async () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ maxUploadSize: 4 }));

    await act(async () => {
      await result.current.handleFileUpload(
        fileUploadEvent(new File(['API_KEY=a-very-long-secret'], '.env', { type: 'text/plain' })),
      );
    });
    expect(result.current.uploadError).not.toBeNull();

    act(() => {
      result.current.handlePaste(0, 'A=1\nB=2');
    });

    expect(result.current.uploadError).toBeNull();
  });

  it('refuses a line that assigns to nothing', () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ initialRows: [{ key: 'A', value: '1' }] }));

    act(() => {
      expect(result.current.handlePaste(0, '=orphan')).toBe(false);
    });

    expect(result.current.rows).toEqual([{ key: 'A', value: '1' }]);
  });
});

describe('useEnvironmentVariablesEditor emptiness', () => {
  it('does not treat a set of rows as blank just because the first one is', () => {
    const { result } = renderHook(() =>
      useEnvironmentVariablesEditor({
        initialRows: [
          { key: '', value: '' },
          { key: 'KEEP_ME', value: '1' },
        ],
      }),
    );

    act(() => {
      result.current.handlePaste(0, 'A=1\nB=2');
    });

    expect(result.current.rows.map(row => row.key)).toContain('KEEP_ME');
  });

  it('treats a row holding only whitespace as blank', () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ initialRows: [{ key: '   ', value: '' }] }));

    act(() => {
      result.current.handlePaste(0, 'A=1\nB=2');
    });

    // The whitespace row is replaced, not kept in front of the paste.
    expect(result.current.rows.map(row => row.key)).toEqual(['A', 'B']);
  });

  it('keeps a row that has a value but no key yet', () => {
    const { result } = renderHook(() =>
      useEnvironmentVariablesEditor({
        initialRows: [
          { key: '', value: 'typed-first' },
          { key: 'OTHER', value: '9' },
        ],
      }),
    );

    act(() => {
      result.current.handlePaste(0, 'A=1\nB=2');
    });

    expect(result.current.rows.map(row => row.value)).toContain('typed-first');
  });

  it('keeps a row that has a key but no value yet', () => {
    const { result } = renderHook(() =>
      useEnvironmentVariablesEditor({
        initialRows: [
          { key: 'TYPED_FIRST', value: '' },
          { key: 'OTHER', value: '9' },
        ],
      }),
    );

    act(() => {
      result.current.handlePaste(0, 'A=1\nB=2');
    });

    expect(result.current.rows.map(row => row.key)).toEqual(['TYPED_FIRST', 'A', 'B', 'OTHER']);
  });
});

describe('useEnvironmentVariablesEditor dirtiness', () => {
  it('calls itself dirty once a row is removed', () => {
    const { result } = renderHook(() =>
      useEnvironmentVariablesEditor({
        initialRows: [
          { key: 'A', value: '1' },
          { key: 'B', value: '2' },
        ],
      }),
    );

    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.removeRow(1);
    });

    // Fewer rows than the baseline is a change, even though the ones left match.
    expect(result.current.isDirty).toBe(true);
    expect(result.current.isRowsDirty).toBe(true);
  });

  it('calls itself dirty once a row is added', () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ initialRows: [{ key: 'A', value: '1' }] }));

    act(() => {
      result.current.appendRow({ key: 'B', value: '2' });
    });

    expect(result.current.isDirty).toBe(true);
  });

  it('is clean again once the rows match the baseline by value', () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ initialRows: [{ key: 'A', value: '1' }] }));

    act(() => {
      result.current.updateRow(0, { value: '2' });
    });
    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.updateRow(0, { value: '1' });
    });
    expect(result.current.isDirty).toBe(false);
  });

  it('takes the rows it was reset to as the new baseline', () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ initialRows: [{ key: 'A', value: '1' }] }));

    act(() => {
      result.current.resetRows([{ key: 'B', value: '2' }]);
    });

    expect(result.current.rows).toEqual([{ key: 'B', value: '2' }]);
    expect(result.current.isDirty).toBe(false);
  });
});

describe('useEnvironmentVariablesEditor isolation', () => {
  it('does not follow the caller mutating the array it handed over', () => {
    const initialRows = [{ key: 'A', value: '1' }];
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ initialRows }));

    const row = initialRows[0];
    if (row) row.value = 'changed behind its back';

    expect(result.current.rows).toEqual([{ key: 'A', value: '1' }]);
  });
});

describe('useEnvironmentVariablesEditor pasted text', () => {
  it('accepts a single assignment that was copied with its surrounding whitespace', () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor());

    act(() => {
      expect(result.current.handlePaste(0, '  API_KEY=secret  ')).toBe(true);
    });

    expect(result.current.rows).toEqual([{ key: 'API_KEY', value: 'secret' }]);
  });

  it('reads an assignment buried mid-line as a value, not a variable', () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ initialRows: [{ key: 'A', value: '1' }] }));

    act(() => {
      expect(result.current.handlePaste(0, 'prefix_TOKEN=abc')).toBe(false);
    });

    expect(result.current.rows).toEqual([{ key: 'A', value: '1' }]);
  });

  it('accepts an export written with extra spacing', () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor());

    act(() => {
      expect(result.current.handlePaste(0, 'export   API_KEY=secret')).toBe(true);
    });

    expect(result.current.rows).toEqual([{ key: 'API_KEY', value: 'secret' }]);
  });

  it('accepts an assignment padded around its equals sign', () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor());

    act(() => {
      expect(result.current.handlePaste(0, 'API_KEY = secret')).toBe(true);
    });

    expect(result.current.rows).toEqual([{ key: 'API_KEY', value: 'secret' }]);
  });

  it('accepts a single assignment carrying the comment line above it', () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ initialRows: [{ key: 'A', value: '1' }] }));

    act(() => {
      expect(result.current.handlePaste(0, '# from staging\nAPI_KEY=secret')).toBe(true);
    });

    expect(result.current.rows).toEqual([
      { key: 'A', value: '1' },
      { key: 'API_KEY', value: 'secret' },
    ]);
  });
});

describe('useEnvironmentVariablesEditor uploads', () => {
  const envFile = (text: string) => new File([text], '.env', { type: 'text/plain' });

  /** jsdom refuses to fake a chosen filename on a real file input, so a plain one stands in. */
  const fileInputHolding = (previousSelection: string) => {
    const input = document.createElement('input');
    input.value = previousSelection;
    return input;
  };

  it('replaces a row holding nothing but whitespace', async () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ initialRows: [{ key: '   ', value: '' }] }));

    await act(async () => {
      await result.current.handleFileUpload(fileUploadEvent(envFile('A=1\nB=2')));
    });

    expect(result.current.rows).toEqual([
      { key: 'A', value: '1' },
      { key: 'B', value: '2' },
    ]);
  });

  it('keeps a row the user had already started typing a value into', async () => {
    const { result } = renderHook(() =>
      useEnvironmentVariablesEditor({ initialRows: [{ key: '', value: 'typed-first' }] }),
    );

    await act(async () => {
      await result.current.handleFileUpload(fileUploadEvent(envFile('A=1\nB=2')));
    });

    expect(result.current.rows).toEqual([
      { key: '', value: 'typed-first' },
      { key: 'A', value: '1' },
      { key: 'B', value: '2' },
    ]);
  });

  it('appends to rows that already hold something', async () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ initialRows: [{ key: 'KEEP', value: '9' }] }));

    await act(async () => {
      await result.current.handleFileUpload(fileUploadEvent(envFile('A=1')));
    });

    expect(result.current.rows.map(row => row.key)).toEqual(['KEEP', 'A']);
  });

  it('does nothing when no file was chosen', async () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ initialRows: [{ key: 'A', value: '1' }] }));

    await act(async () => {
      await result.current.handleFileUpload({ target: { files: null } });
    });

    expect(result.current.rows).toEqual([{ key: 'A', value: '1' }]);
    expect(result.current.uploadError).toBeNull();
  });

  it('refuses a file larger than the caller allows', async () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ maxUploadSize: 4 }));

    await act(async () => {
      await result.current.handleFileUpload(fileUploadEvent(envFile('API_KEY=a-very-long-secret')));
    });

    expect(result.current.uploadError).not.toBeNull();
    expect(result.current.rows).toEqual([{ key: '', value: '' }]);
  });

  it('clears a standing error on request', async () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ maxUploadSize: 4 }));

    await act(async () => {
      await result.current.handleFileUpload(fileUploadEvent(envFile('API_KEY=a-very-long-secret')));
    });
    expect(result.current.uploadError).not.toBeNull();

    act(() => {
      result.current.clearUploadError();
    });

    expect(result.current.uploadError).toBeNull();
  });

  it('clears a standing error when the rows are reset', async () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ maxUploadSize: 4 }));

    await act(async () => {
      await result.current.handleFileUpload(fileUploadEvent(envFile('API_KEY=a-very-long-secret')));
    });
    expect(result.current.uploadError).not.toBeNull();

    act(() => {
      result.current.resetRows();
    });

    expect(result.current.uploadError).toBeNull();
  });

  it('hides revealed values again once a file is imported', async () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ initialRows: [{ key: 'KEEP', value: '9' }] }));

    act(() => {
      result.current.toggleValueVisibility(0);
    });
    expect(result.current.isValueRevealed(0)).toBe(true);

    await act(async () => {
      await result.current.handleFileUpload(fileUploadEvent(envFile('A=1')));
    });

    expect(result.current.isValueRevealed(0)).toBe(false);
  });

  it('empties the file input after an import, so the same file can be picked again', async () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor());
    result.current.fileInputRef.current = fileInputHolding('chosen.env');

    await act(async () => {
      await result.current.handleFileUpload(fileUploadEvent(envFile('A=1')));
    });

    expect(result.current.fileInputRef.current?.value).toBe('');
  });

  it('empties the file input after a refused file too', async () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ maxUploadSize: 4 }));
    result.current.fileInputRef.current = fileInputHolding('too-big.env');

    await act(async () => {
      await result.current.handleFileUpload(fileUploadEvent(envFile('API_KEY=a-very-long-secret')));
    });

    expect(result.current.uploadError).not.toBeNull();
    expect(result.current.fileInputRef.current?.value).toBe('');
  });

  it('clears a standing error when the next upload succeeds', async () => {
    const { result } = renderHook(() => useEnvironmentVariablesEditor({ maxUploadSize: 20 }));

    await act(async () => {
      await result.current.handleFileUpload(fileUploadEvent(envFile('API_KEY=a-very-long-secret-indeed')));
    });
    expect(result.current.uploadError).not.toBeNull();

    await act(async () => {
      await result.current.handleFileUpload(fileUploadEvent(envFile('A=1')));
    });

    expect(result.current.uploadError).toBeNull();
  });
});
