import type { Meta, StoryObj } from '@storybook/react-vite';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { Button } from '../../../ds/components/Button';
import { Txt } from '../../../ds/components/Txt';
import { createLocalStorageStore, useLocalStorageStore } from '../../use-local-storage-store';

const counterStore = createLocalStorageStore<number>({
  key: 'storybook:hooks:local-storage-store:count',
  defaultValue: 0,
  parse: stored => {
    if (typeof stored !== 'number') throw new Error('not a count');
    return stored;
  },
});

function CountReader({ label }: { label: string }) {
  const count = useLocalStorageStore(counterStore);
  return (
    <Txt variant="body-sm">
      {label}: {count}
    </Txt>
  );
}

function LocalStorageStoreDemo() {
  return (
    <HookDemo>
      <CountReader label="First reader" />
      <CountReader label="Second reader" />
      <Button onClick={() => counterStore.write(counterStore.read() + 1)}>Increment</Button>
      <Button onClick={() => counterStore.write(0)}>Reset</Button>
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useLocalStorageStore',
  component: LocalStorageStoreDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One browser-stored value shared by every component that reads it, and by other tabs. Create the store once at module level with `createLocalStorageStore`; a write that storage refuses still updates every reader for the session. Import from `@mastra/playground-ui/hooks/use-local-storage-store`.',
      },
    },
  },
} satisfies Meta<typeof LocalStorageStoreDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
