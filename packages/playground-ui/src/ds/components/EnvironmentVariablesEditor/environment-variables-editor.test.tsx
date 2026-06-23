// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EnvironmentVariablesEditor } from './environment-variables-editor';
import { useEnvironmentVariablesEditor } from '@/hooks/use-environment-variables-editor';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'clipboard');
  Reflect.deleteProperty(document, 'execCommand');
});

function TestEditor({
  initialRows = [{ key: 'PUBLIC_URL', value: 'https://example.com' }],
  onSave = vi.fn(),
}: {
  initialRows?: { key: string; value: string }[];
  onSave?: (envVars: Record<string, string>) => void;
}) {
  const editor = useEnvironmentVariablesEditor({ initialRows });

  return (
    <EnvironmentVariablesEditor
      editor={editor}
      actions={
        <>
          <button
            type="button"
            disabled={!editor.isDirty || editor.hasDuplicateKeys}
            onClick={() => onSave(editor.getEnvironmentVariablesForSubmit())}
          >
            Save
          </button>
          <button type="button" onClick={() => editor.resetRows()}>
            Cancel
          </button>
        </>
      }
    />
  );
}

function ControlledTestEditor({ initialRows }: { initialRows: { key: string; value: string }[] }) {
  const [rows, setRows] = useState(initialRows);
  const editor = useEnvironmentVariablesEditor({ rows, onRowsChange: setRows });

  return (
    <EnvironmentVariablesEditor
      editor={editor}
      actions={
        <button type="button" disabled={!editor.isDirty}>
          Save
        </button>
      }
    />
  );
}

function CompoundTestEditor({
  initialRows = [{ key: 'PUBLIC_URL', value: 'https://example.com' }],
  onSave = vi.fn(),
}: {
  initialRows?: { key: string; value: string }[];
  onSave?: (envVars: Record<string, string>) => void;
}) {
  const editor = useEnvironmentVariablesEditor({ initialRows });

  return (
    <EnvironmentVariablesEditor.Root editor={editor} data-testid="env-editor-root">
      <div data-testid="env-editor-toolbar">
        <EnvironmentVariablesEditor.UploadButton inputLabel="Import .env file">
          Import .env
        </EnvironmentVariablesEditor.UploadButton>
      </div>
      <EnvironmentVariablesEditor.UploadError />
      <EnvironmentVariablesEditor.Rows data-testid="env-editor-rows" />
      <EnvironmentVariablesEditor.AddButton data-testid="env-editor-add">
        Add Another
      </EnvironmentVariablesEditor.AddButton>
      <EnvironmentVariablesEditor.DuplicateKeysError />
      <EnvironmentVariablesEditor.Actions>
        <button
          type="button"
          disabled={!editor.isDirty || editor.hasDuplicateKeys}
          onClick={() => onSave(editor.getEnvironmentVariablesForSubmit())}
        >
          Save
        </button>
      </EnvironmentVariablesEditor.Actions>
    </EnvironmentVariablesEditor.Root>
  );
}

describe('EnvironmentVariablesEditor', () => {
  it('masks values by default and reveals only the selected row', () => {
    render(
      <TestEditor
        initialRows={[
          { key: 'PUBLIC_URL', value: 'https://example.com' },
          { key: 'API_KEY', value: 'secret' },
        ]}
      />,
    );

    expect((screen.getByDisplayValue('https://example.com') as HTMLInputElement).type).toBe('password');
    expect((screen.getByDisplayValue('secret') as HTMLInputElement).type).toBe('password');

    fireEvent.click(screen.getAllByRole('button', { name: 'Show value' })[0]);

    expect((screen.getByDisplayValue('https://example.com') as HTMLInputElement).type).toBe('text');
    expect((screen.getByDisplayValue('secret') as HTMLInputElement).type).toBe('password');
  });

  it('adds rows and submits trimmed environment variables', () => {
    const onSave = vi.fn();
    render(<TestEditor onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Variable' }));
    fireEvent.change(screen.getAllByPlaceholderText('KEY')[1], {
      target: { value: ' API_KEY ' },
    });
    fireEvent.change(screen.getAllByPlaceholderText('value')[1], {
      target: { value: 'secret' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({
      PUBLIC_URL: 'https://example.com',
      API_KEY: 'secret',
    });
  });

  it('shows duplicate key feedback and blocks the supplied save action', () => {
    const onSave = vi.fn();
    render(
      <TestEditor
        onSave={onSave}
        initialRows={[
          { key: 'PUBLIC_URL', value: 'https://example.com' },
          { key: 'API_KEY', value: 'secret' },
        ]}
      />,
    );

    fireEvent.change(screen.getByDisplayValue('PUBLIC_URL'), {
      target: { value: 'API_KEY' },
    });

    expect(screen.getAllByText('Environment variable keys must be unique').length).toBeGreaterThan(0);
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not render a raw tab', () => {
    render(<TestEditor />);

    expect(screen.queryByRole('tab', { name: 'Raw' })).toBeNull();
    expect(screen.queryByLabelText('Raw environment variables')).toBeNull();
  });

  it('keeps controlled rows clean until they change', () => {
    render(<ControlledTestEditor initialRows={[{ key: 'PUBLIC_URL', value: 'https://example.com' }]} />);

    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByDisplayValue('PUBLIC_URL'), {
      target: { value: 'NEXT_PUBLIC_URL' },
    });

    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('composes nested editor parts from root context', () => {
    const onSave = vi.fn();
    render(<CompoundTestEditor initialRows={[{ key: '', value: '' }]} onSave={onSave} />);

    expect(screen.getByTestId('env-editor-root')).toBeDefined();
    expect(screen.getByTestId('env-editor-toolbar')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Import .env' })).toBeDefined();
    expect(screen.getByTestId('env-editor-rows')).toBeDefined();
    expect(screen.getByTestId('env-editor-add')).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText('KEY'), {
      target: { value: 'API_KEY' },
    });
    fireEvent.change(screen.getByPlaceholderText('value'), {
      target: { value: 'secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Another' }));

    expect(screen.getAllByPlaceholderText('KEY')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({
      API_KEY: 'secret',
    });
  });

  it('uploads through a custom positioned upload button', async () => {
    render(<CompoundTestEditor initialRows={[{ key: '', value: '' }]} />);

    const file = new File(['FOO=bar\nBAZ=qux'], '.env', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('Import .env file'), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('FOO')).toBeDefined();
      expect(screen.getByDisplayValue('bar')).toBeDefined();
      expect(screen.getByDisplayValue('BAZ')).toBeDefined();
      expect(screen.getByDisplayValue('qux')).toBeDefined();
    });
  });

  it('fills rows when bulk env text is pasted into an empty key input', () => {
    const onSave = vi.fn();
    render(<TestEditor initialRows={[{ key: '', value: '' }]} onSave={onSave} />);

    fireEvent.paste(screen.getByPlaceholderText('KEY'), {
      clipboardData: { getData: () => 'FOO=bar\nBAZ=qux' },
    });

    expect(screen.getByDisplayValue('FOO')).toBeDefined();
    expect(screen.getByDisplayValue('bar')).toBeDefined();
    expect(screen.getByDisplayValue('BAZ')).toBeDefined();
    expect(screen.getByDisplayValue('qux')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({
      FOO: 'bar',
      BAZ: 'qux',
    });
  });

  it('fills a row from a single uppercase env assignment paste', () => {
    render(<TestEditor initialRows={[{ key: '', value: '' }]} />);

    fireEvent.paste(screen.getByPlaceholderText('KEY'), {
      clipboardData: { getData: () => 'API_KEY=secret=with=equals' },
    });

    expect(screen.getByDisplayValue('API_KEY')).toBeDefined();
    expect(screen.getByDisplayValue('secret=with=equals')).toBeDefined();
    expect(screen.getAllByPlaceholderText('KEY')).toHaveLength(1);
  });

  it('does not hijack ordinary single-value pastes that contain equals', () => {
    render(<TestEditor />);

    fireEvent.paste(screen.getByDisplayValue('https://example.com'), {
      clipboardData: { getData: () => 'token=part' },
    });

    expect(screen.queryByDisplayValue('token')).toBeNull();
    expect(screen.getAllByPlaceholderText('KEY')).toHaveLength(1);
  });

  it('inserts pasted env rows without replacing an existing row', () => {
    render(<TestEditor />);

    fireEvent.paste(screen.getByDisplayValue('PUBLIC_URL'), {
      clipboardData: { getData: () => 'API_KEY=secret\nDATABASE_URL=postgres://example.com/db' },
    });

    expect(screen.getByDisplayValue('PUBLIC_URL')).toBeDefined();
    expect(screen.getByDisplayValue('API_KEY')).toBeDefined();
    expect(screen.getByDisplayValue('secret')).toBeDefined();
    expect(screen.getByDisplayValue('DATABASE_URL')).toBeDefined();
    expect(screen.getByDisplayValue('postgres://example.com/db')).toBeDefined();
  });

  it('uploads a valid env file and replaces the empty row', async () => {
    render(<TestEditor initialRows={[{ key: '', value: '' }]} />);

    const file = new File(['FOO=bar\nBAZ=qux'], '.env', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('Upload .env file'), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('FOO')).toBeDefined();
      expect(screen.getByDisplayValue('bar')).toBeDefined();
      expect(screen.getByDisplayValue('BAZ')).toBeDefined();
      expect(screen.getByDisplayValue('qux')).toBeDefined();
    });
    expect(screen.getAllByPlaceholderText('KEY')).toHaveLength(2);
  });

  it('shows upload errors without changing existing rows', async () => {
    render(<TestEditor />);

    fireEvent.change(screen.getByLabelText('Upload .env file'), {
      target: { files: [new File([''], '.env', { type: 'text/plain' })] },
    });

    expect(await screen.findByText('No valid environment variables found in the file.')).toBeDefined();
    expect(screen.getByDisplayValue('PUBLIC_URL')).toBeDefined();
  });

  it('renders a read-only variable list with headers and toggleable masked values', () => {
    render(
      <EnvironmentVariablesEditor.ReadOnlyList>
        <EnvironmentVariablesEditor.ReadOnlyItem name="API_KEY" value="secret" updatedAt="Updated Jun 18" />
      </EnvironmentVariablesEditor.ReadOnlyList>,
    );

    expect(screen.getByText('Key')).toBeDefined();
    expect(screen.getByText('Value')).toBeDefined();
    expect(screen.getByText('Last Updated')).toBeDefined();
    expect(screen.getByText('API_KEY')).toBeDefined();
    expect(screen.queryByText('Sensitive')).toBeNull();
    expect(screen.getByText('************')).toBeDefined();
    expect(screen.queryByText('secret')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show value' }));

    expect(screen.getByText('secret')).toBeDefined();
    expect(screen.queryByText('************')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Hide value' }));

    expect(screen.queryByText('secret')).toBeNull();
    expect(screen.getByText('************')).toBeDefined();
  });

  it('keeps the read-only icon column opt-in', () => {
    const icon = <span>Variable icon</span>;
    const item = <EnvironmentVariablesEditor.ReadOnlyItem name="API_KEY" value="secret" icon={icon} />;
    const { rerender } = render(
      <EnvironmentVariablesEditor.ReadOnlyList>{item}</EnvironmentVariablesEditor.ReadOnlyList>,
    );

    expect(screen.queryByText('Variable icon')).toBeNull();

    rerender(<EnvironmentVariablesEditor.ReadOnlyList showIcon>{item}</EnvironmentVariablesEditor.ReadOnlyList>);

    expect(screen.getByText('Variable icon')).toBeDefined();
  });

  it('forwards read-only primitive props through the DataList parts', () => {
    render(
      <EnvironmentVariablesEditor.ReadOnlyList
        data-testid="env-readonly-list"
        header={<EnvironmentVariablesEditor.ReadOnlyHeader data-testid="env-readonly-header" />}
      >
        <EnvironmentVariablesEditor.ReadOnlyItem
          data-testid="env-readonly-item"
          name="API_KEY"
          value="secret"
          updatedAt="Updated Jun 18"
        />
      </EnvironmentVariablesEditor.ReadOnlyList>,
    );

    expect(screen.getByTestId('env-readonly-list')).toBeDefined();
    expect(screen.getByTestId('env-readonly-header')).toBeDefined();
    expect(screen.getByTestId('env-readonly-item')).toBeDefined();
  });

  it('forwards empty-state primitive props through DataList.NoMatch', () => {
    render(
      <EnvironmentVariablesEditor.ReadOnlyList>
        <EnvironmentVariablesEditor.ReadOnlyEmpty data-testid="env-readonly-empty" message="No variables" />
      </EnvironmentVariablesEditor.ReadOnlyList>,
    );

    expect(screen.getByTestId('env-readonly-empty')).toBeDefined();
    expect(screen.getByText('No variables')).toBeDefined();
  });

  it('copies revealed read-only values from the value action', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <EnvironmentVariablesEditor.ReadOnlyList>
        <EnvironmentVariablesEditor.ReadOnlyItem name="API_KEY" value="secret-token-value" updatedAt="Updated Jun 18" />
      </EnvironmentVariablesEditor.ReadOnlyList>,
    );

    expect(screen.queryByRole('button', { name: 'Copy value' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show value' }));

    const value = screen.getByText('secret-token-value');
    expect(value.className).toContain('truncate');

    fireEvent.click(screen.getByRole('button', { name: 'Copy value' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('secret-token-value');
    });
  });
});
