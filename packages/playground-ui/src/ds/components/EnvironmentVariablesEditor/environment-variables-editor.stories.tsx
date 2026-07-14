import type { Meta, StoryObj } from '@storybook/react-vite';
import { RefreshCwIcon, SaveIcon, SearchIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { EnvironmentVariablesEditor } from './environment-variables-editor';
import { Button } from '@/ds/components/Button';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/ds/components/Drawer';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/ds/components/InputGroup';
import { Notice } from '@/ds/components/Notice';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { useEnvironmentVariablesEditor } from '@/hooks/use-environment-variables-editor';
import { collectEnvironmentVariables, rowsFromEnvironmentVariables } from '@/lib/env-file';
import type { EnvironmentVariableEntry } from '@/lib/env-file';

const meta: Meta<typeof EnvironmentVariablesEditor> = {
  title: 'Composite/EnvironmentVariablesEditor',
  component: EnvironmentVariablesEditor,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  decorators: [
    Story => (
      <TooltipProvider>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof EnvironmentVariablesEditor>;

const defaultRows = rowsFromEnvironmentVariables({
  PUBLIC_BASE_URL: 'https://example.com',
  API_KEY: 'api_key_test_123',
});

const bulkPasteText = [
  'DATABASE_URL=postgres://localhost:5432/mastra',
  'PUBLIC_BASE_URL=https://preview.example.com',
  'API_TOKEN="token_test_123"',
].join('\n');

const readOnlyVariables = [
  {
    name: 'ATTIO_API_KEY',
    value: 'attio_live_123',
    updatedAt: 'Added Jun 18',
  },
  {
    name: 'C15T_URL',
    value: 'https://consent.example.com',
    updatedAt: 'Updated Jun 12',
  },
  {
    name: 'MASTRA_API_URL',
    value: 'https://api.mastra.local',
    updatedAt: 'Updated May 21',
  },
  {
    name: 'NEXT_PUBLIC_BASE_URL',
    value: 'https://www.example.com',
    updatedAt: 'Added Jan 27',
  },
  {
    name: 'REVALIDATE_SECRET',
    value: 'revalidate_test_123',
    updatedAt: 'Added Dec 4',
  },
];

type ReadOnlyVariable = (typeof readOnlyVariables)[number];

function DemoEditor({ initialRows }: { initialRows: EnvironmentVariableEntry[] }) {
  const editor = useEnvironmentVariablesEditor({ initialRows });
  const [lastSaved, setLastSaved] = useState<Record<string, string> | null>(null);

  function save() {
    const rows = editor.getRowsForSubmit();
    const envVars = collectEnvironmentVariables(rows);
    setLastSaved(envVars);
    editor.resetRows(rows);
  }

  return (
    <>
      <EnvironmentVariablesEditor
        editor={editor}
        actions={
          <>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!editor.isDirty || editor.hasDuplicateKeys}
              onClick={save}
            >
              <RefreshCwIcon />
              Save & Restart
            </Button>
            <Button
              type="button"
              variant="default"
              size="icon-sm"
              tooltip="Save"
              disabled={!editor.isDirty || editor.hasDuplicateKeys}
              onClick={save}
            >
              <SaveIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!editor.isDirty}
              onClick={() => editor.resetRows()}
            >
              Cancel
            </Button>
          </>
        }
      />

      {lastSaved && (
        <Notice variant="success">
          <Notice.Message>Saved {Object.keys(lastSaved).length} environment variables.</Notice.Message>
        </Notice>
      )}
    </>
  );
}

function ReadOnlyEditor() {
  const editor = useEnvironmentVariablesEditor({
    initialRows: defaultRows,
  });

  return <EnvironmentVariablesEditor editor={editor} readOnly />;
}

function ReadOnlyVariablesList({
  variables = readOnlyVariables,
  emptyMessage,
}: {
  variables?: ReadOnlyVariable[];
  emptyMessage?: string;
}) {
  return (
    <EnvironmentVariablesEditor.ReadOnlyList>
      {variables.map(variable => (
        <EnvironmentVariablesEditor.ReadOnlyItem key={variable.name} {...variable} />
      ))}
      {variables.length === 0 && <EnvironmentVariablesEditor.ReadOnlyEmpty message={emptyMessage} />}
    </EnvironmentVariablesEditor.ReadOnlyList>
  );
}

function EnvironmentVariablesPage({ children }: { children?: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('');
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleVariables =
    normalizedSearchQuery.length > 0
      ? readOnlyVariables.filter(variable => variable.name.toLowerCase().includes(normalizedSearchQuery))
      : readOnlyVariables;

  return (
    <div className="min-h-190 bg-surface1 p-6 text-neutral6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-ui-xl font-semibold text-neutral6">Environment Variables</h2>
            <p className="mt-1 text-ui-sm text-neutral3">Store API keys, tokens, and config securely.</p>
          </div>
          {children}
        </div>

        <div>
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon aria-hidden className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search variables"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
            />
          </InputGroup>
        </div>

        <ReadOnlyVariablesList
          variables={visibleVariables}
          emptyMessage={
            normalizedSearchQuery.length > 0
              ? `No environment variables match "${searchQuery.trim()}"`
              : 'No environment variables found'
          }
        />
      </div>
    </div>
  );
}

function EnvironmentVariablesDrawerStory() {
  const [open, setOpen] = useState(true);
  const editor = useEnvironmentVariablesEditor({
    initialRows: rowsFromEnvironmentVariables({}),
  });

  function save() {
    editor.resetRows(editor.getRowsForSubmit());
    setOpen(false);
  }

  return (
    <EnvironmentVariablesPage>
      <Drawer side="right" variant="floating" overlay="visible" open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button variant="primary" size="sm">
            Add Environment Variable
          </Button>
        </DrawerTrigger>
        <DrawerContent className="w-3xl max-w-[calc(100vw-2rem)]">
          <EnvironmentVariablesEditor.Root editor={editor} className="contents">
            <DrawerHeader className="flex-row items-center justify-between gap-3 border-b border-border1">
              <DrawerTitle>Add Environment Variable</DrawerTitle>
              <EnvironmentVariablesEditor.UploadButton variant="outline" size="sm">
                Import .env
              </EnvironmentVariablesEditor.UploadButton>
            </DrawerHeader>
            <DrawerBody className="overflow-y-auto">
              <div className="grid gap-6">
                <EnvironmentVariablesEditor.UploadError />
                <EnvironmentVariablesEditor.Rows />
                <EnvironmentVariablesEditor.AddButton>Add Another</EnvironmentVariablesEditor.AddButton>
                <EnvironmentVariablesEditor.DuplicateKeysError />
              </div>
            </DrawerBody>
            <DrawerFooter className="items-center border-t border-border1">
              <Button
                type="button"
                variant="primary"
                disabled={!editor.isDirty || editor.hasDuplicateKeys}
                onClick={save}
              >
                Save
              </Button>
            </DrawerFooter>
          </EnvironmentVariablesEditor.Root>
        </DrawerContent>
      </Drawer>
    </EnvironmentVariablesPage>
  );
}

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Editable rows with masked values, duplicate-key validation, import, add/remove, and save/reset actions.',
      },
    },
  },
  render: () => <DemoEditor initialRows={defaultRows} />,
};

export const Empty: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Starts with one empty row and keeps the import affordance available.',
      },
    },
  },
  render: () => <DemoEditor initialRows={rowsFromEnvironmentVariables({})} />,
};

export const BulkPaste: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Exercises the Vercel-style bulk paste behavior by pasting .env text into the first key input.',
      },
    },
  },
  render: () => <DemoEditor initialRows={rowsFromEnvironmentVariables({})} />,
  play: async ({ canvasElement }) => {
    const keyInput = canvasElement.querySelector<HTMLInputElement>('input[placeholder="e.g: OPEN_AI_KEY"]');
    if (!keyInput) return;

    const clipboardData = new DataTransfer();
    clipboardData.setData('text', bulkPasteText);

    keyInput.dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData,
      }),
    );
  },
};

export const InDrawer: Story = {
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story:
          'Composes the editor from nested parts inside a right-side drawer, with import actions in the drawer header.',
      },
    },
  },
  render: () => <EnvironmentVariablesDrawerStory />,
};

export const DuplicateKeys: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Shows duplicate-key feedback and disabled save actions.',
      },
    },
  },
  render: () => (
    <DemoEditor
      initialRows={[
        { key: 'API_KEY', value: 'first-secret' },
        { key: 'API_KEY', value: 'second-secret' },
      ]}
    />
  ),
};

export const ReadOnlyList: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Read-only Vercel-inspired list presentation for existing environment variables.',
      },
    },
  },
  render: () => <ReadOnlyVariablesList />,
};

export const ReadOnly: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Read-only presentation with import, actions, and destructive row controls hidden.',
      },
    },
  },
  render: () => <ReadOnlyEditor />,
};
