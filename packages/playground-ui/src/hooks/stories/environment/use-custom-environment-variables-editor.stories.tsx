import type { Meta, StoryObj } from '@storybook/react-vite';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { EnvironmentVariablesEditor } from '@/ds/components/EnvironmentVariablesEditor';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';
import { useCustomEnvironmentVariablesEditor } from '@/hooks/use-environment-variables-editor';
import type { EnvironmentVariableRow } from '@/hooks/use-environment-variables-editor';

type ScopedVariable = EnvironmentVariableRow & { scope: 'preview' };

function createDefaultRow(): ScopedVariable {
  return { key: '', value: '', scope: 'preview' };
}

function createRow(entry: EnvironmentVariableRow): ScopedVariable {
  return { ...entry, scope: 'preview' };
}

function CustomEnvironmentVariablesEditorDemo() {
  const editor = useCustomEnvironmentVariablesEditor({ createDefaultRow, createRow });
  return (
    <HookDemo>
      <Txt>Every row carries a preview scope, including pasted or uploaded variables.</Txt>
      <TooltipProvider>
        <EnvironmentVariablesEditor editor={editor} />
      </TooltipProvider>
      <ul className="space-y-2">
        {editor.rows.map((row, index) => (
          <li key={editor.getRowId(index)}>
            <Txt>
              {row.key || '(unnamed variable)'} · scope: {row.scope}
            </Txt>
          </li>
        ))}
      </ul>
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useCustomEnvironmentVariablesEditor',
  component: CustomEnvironmentVariablesEditorDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Adds application metadata through typed row factories. Imported and pasted rows use createRow; new empty rows use createDefaultRow. Import from `@mastra/playground-ui/hooks/use-environment-variables-editor`.',
      },
    },
  },
} satisfies Meta<typeof CustomEnvironmentVariablesEditorDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
