import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { z } from 'zod/v4';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { Button } from '@/ds/components/Button';
import { Field, FieldLabel } from '@/ds/components/Field';
import { Input } from '@/ds/components/Input';
import { useLocalStorageState } from '@/hooks/use-local-storage-state';

const draftSchema = z.string();
const storageKey = 'storybook:hooks:local-storage:draft';

function StoredDraft() {
  const [draft, setDraft] = useLocalStorageState({ initialKey: storageKey, defaultValue: '', schema: draftSchema });
  return (
    <>
      <Field>
        <FieldLabel>Draft persisted in this browser</FieldLabel>
        <Input value={draft} onChange={event => setDraft(event.target.value)} />
      </Field>
      <Button onClick={() => setDraft('')}>Reset draft</Button>
    </>
  );
}

function LocalStorageStateDemo() {
  const [mount, setMount] = useState(0);
  return (
    <HookDemo>
      <StoredDraft key={mount} />
      <Button onClick={() => setMount(value => value + 1)}>Remount and read storage</Button>
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useLocalStorageState',
  component: LocalStorageStateDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Schema-checked browser storage with a default value. Initialization happens on mount; remount when changing keys. Import from `@mastra/playground-ui/hooks/use-local-storage-state`.',
      },
    },
  },
} satisfies Meta<typeof LocalStorageStateDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
