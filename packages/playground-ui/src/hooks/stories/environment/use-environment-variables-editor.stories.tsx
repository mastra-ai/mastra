import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/ds/components/Button';
import { EnvironmentVariablesEditor } from '@/ds/components/EnvironmentVariablesEditor';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { useEnvironmentVariablesEditor } from '@/hooks/use-environment-variables-editor';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { Txt } from '@/ds/components/Txt';

const initialRows = [{ key: 'PUBLIC_BASE_URL', value: 'https://example.com' }];

function EnvironmentVariablesEditorDemo() {
  const editor = useEnvironmentVariablesEditor({ initialRows });
  return (
    <HookDemo>
      <TooltipProvider>
        <EnvironmentVariablesEditor editor={editor} />
      </TooltipProvider>
      <Txt role="status">
        {editor.isDirty ? 'Modified rows' : 'Original rows'} · Duplicate keys: {String(editor.hasDuplicateKeys)}
      </Txt>
      <Button disabled={!editor.isDirty} onClick={() => editor.resetRows()}>
        Reset rows
      </Button>
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useEnvironmentVariablesEditor',
  component: EnvironmentVariablesEditorDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Owns editable rows, duplicate detection, paste/import errors, visibility, and dirty state. The shared editor supplies the controls; all values here are fictional. Import from `@mastra/playground-ui/hooks/use-environment-variables-editor`.',
      },
    },
  },
} satisfies Meta<typeof EnvironmentVariablesEditorDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
