import type { Meta, StoryObj } from '@storybook/react-vite';
import { CircleDashed, RotateCcw, Settings2, UserRound } from 'lucide-react';
import { useState } from 'react';
import { DropdownMenu } from '../DropdownMenu';
import type { DropdownMenuRadioOption } from '../DropdownMenu';
import { SortMenu } from './sort-menu';

const meta: Meta<typeof SortMenu> = {
  title: 'Elements/SortMenu',
  component: SortMenu,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof SortMenu>;

type SessionSort = 'activity' | 'updated' | 'created';
type OwnerScope = 'mine' | 'all';
type SessionStatus = 'all' | 'working' | 'idle';

const sortOptions: readonly DropdownMenuRadioOption<SessionSort>[] = [
  { value: 'activity', label: 'Activity' },
  { value: 'updated', label: 'Last updated' },
  { value: 'created', label: 'Last created' },
];

const ownerOptions: readonly DropdownMenuRadioOption<OwnerScope>[] = [
  { value: 'mine', label: 'Mine' },
  { value: 'all', label: 'Everyone' },
];

const statusOptions: readonly DropdownMenuRadioOption<SessionStatus>[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'working', label: 'Working' },
  { value: 'idle', label: 'Idle' },
];

/** The trigger turns primary once the sort moves off `baselineValue`. */
export const Default: Story = {
  render: function Render() {
    const [sort, setSort] = useState<SessionSort>('activity');

    return (
      <SortMenu
        label="Sort sessions"
        options={sortOptions}
        value={sort}
        onValueChange={setSort}
        baselineValue="activity"
      />
    );
  },
};

/** `SortMenu.Sub` sits next to filter submenus in one properties menu; each row shows its current value. */
export const InPropertiesMenu: Story = {
  render: function Render() {
    const [sort, setSort] = useState<SessionSort>('activity');
    const [owner, setOwner] = useState<OwnerScope>('mine');
    const [status, setStatus] = useState<SessionStatus>('all');
    const changed = sort !== 'activity' || owner !== 'mine' || status !== 'all';

    return (
      <DropdownMenu>
        <DropdownMenu.Trigger size="icon-sm" variant="ghost" tooltip="Session properties">
          <Settings2 aria-hidden />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          <SortMenu.Sub options={sortOptions} value={sort} onValueChange={setSort} />
          <DropdownMenu.RadioSub
            label="Owner"
            icon={<UserRound aria-hidden />}
            options={ownerOptions}
            value={owner}
            onValueChange={setOwner}
          />
          <DropdownMenu.RadioSub
            label="Status"
            icon={<CircleDashed aria-hidden />}
            options={statusOptions}
            value={status}
            onValueChange={setStatus}
          />
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            disabled={!changed}
            onClick={() => {
              setSort('activity');
              setOwner('mine');
              setStatus('all');
            }}
          >
            <RotateCcw aria-hidden />
            <span>Reset to default</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    );
  },
};
