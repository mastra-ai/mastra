import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { z } from 'zod/v4';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { useExpiringLocalStorageState } from '@/hooks/use-local-storage-state';

const draftSchema = z.string();
const storageKey = 'storybook:hooks:expiring-storage:draft';

function ExpiringDraft({ now }: { now: number }) {
  const { value, expired, setValue, clear } = useExpiringLocalStorageState({
    key: storageKey,
    schema: draftSchema,
    expiresAt: now + 60_000,
    now: () => now,
  });
  return (
    <>
      <Txt role="status">
        Value: {value ?? '(empty)'} · Expired: {String(expired)}
      </Txt>
      <Button onClick={() => setValue('Temporary draft')}>Store for one minute</Button>
      <Button onClick={clear}>Clear entry</Button>
    </>
  );
}

function ExpiringLocalStorageStateDemo() {
  const [clock, setClock] = useState(() => ({ now: Date.now(), mount: 0 }));
  return (
    <HookDemo>
      <Txt>Store a draft, then advance the clock and remount to read its expiration.</Txt>
      <ExpiringDraft key={clock.mount} now={clock.now} />
      <Button onClick={() => setClock(value => ({ now: value.now + 61_000, mount: value.mount + 1 }))}>
        Advance one minute and remount
      </Button>
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useExpiringLocalStorageState',
  component: ExpiringLocalStorageStateDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Expiration is checked when mounting, not by a live timer. The demo injects a clock so expiration can be tried immediately. Import from `@mastra/playground-ui/hooks/use-local-storage-state`.',
      },
    },
  },
} satisfies Meta<typeof ExpiringLocalStorageStateDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
