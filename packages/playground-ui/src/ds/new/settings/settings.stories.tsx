import type { Meta, StoryObj } from '@storybook/react-vite';
import { GitBranchIcon, MonitorIcon } from 'lucide-react';
import {
  SettingsContainer,
  SettingsEmptyRow,
  SettingsFieldsetRow,
  SettingsGroup,
  SettingsItem,
  SettingsItemIcon,
  SettingsLayout,
  SettingsListHeader,
  SettingsRow,
  SettingsTitle,
} from './index';
import { Avatar } from '@/ds/components/Avatar';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { Switch } from '@/ds/components/Switch';
import { ThemeProvider } from '@/ds/components/ThemeProvider';
import { ThemeToggle } from '@/ds/components/ThemeToggle';

const meta = {
  title: 'New/Settings',
  component: SettingsLayout,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "Every settings page in Studio, Factory and Platform is built from these. `SettingsLayout` is the 640px column; each `SettingsGroup` is a `SettingsTitle` above one `SettingsContainer` card. A card holds `SettingsRow`s (a setting: label, description, control) or a list: a `SettingsListHeader` with a count and the list's action, then `SettingsItem`s. An empty list is one `SettingsEmptyRow` holding the empty text and that same action. The card owns all row spacing, so rows carry no padding of their own.",
      },
    },
  },
  decorators: [
    Story => (
      <ThemeProvider defaultTheme="dark" storageKey="storybook-new-settings">
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof SettingsLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

function JoinPolicySelect() {
  return (
    <Select defaultValue="request">
      <SelectTrigger aria-label="Email domain access">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="off">Invite only</SelectItem>
        <SelectItem value="request">Require admin approval</SelectItem>
        <SelectItem value="automatic">Join automatically</SelectItem>
      </SelectContent>
    </Select>
  );
}

/** Settings rows, a list with a header, and an empty list, on one page. */
export const Page: Story = {
  args: { title: 'General', children: null },
  render: args => (
    <SettingsLayout title={args.title}>
      <SettingsGroup>
        <SettingsTitle>Organization</SettingsTitle>
        <SettingsContainer>
          <SettingsRow label="Organization name" description="Shown across Mastra and in invitations.">
            <Input defaultValue="Mastra" />
          </SettingsRow>
          <SettingsRow
            label="Email domain access"
            description="What happens when someone with an @mastra.ai email signs up."
          >
            <JoinPolicySelect />
          </SettingsRow>
          <SettingsRow label="Theme" description="Color scheme for the interface.">
            <ThemeToggle />
          </SettingsRow>
          <SettingsRow label="Notifications" description="Notify when a run finishes.">
            <Switch aria-label="Notifications" defaultChecked />
          </SettingsRow>
        </SettingsContainer>
      </SettingsGroup>

      <SettingsGroup>
        <SettingsTitle>Accounts</SettingsTitle>
        <SettingsContainer>
          <SettingsListHeader action={<Button size="sm">Add account</Button>}>3 accounts</SettingsListHeader>
          <SettingsItem
            media={
              <SettingsItemIcon>
                <GitBranchIcon />
              </SettingsItemIcon>
            }
            title="mastra-ai"
            description="GitHub · Connected 3 weeks ago"
          >
            <Badge variant="green" size="sm">
              Active
            </Badge>
          </SettingsItem>
          <SettingsItem media={<Avatar name="Ana Lopez" size="md" />} title="Ana Lopez" description="ana@mastra.ai">
            <Badge size="sm">Member</Badge>
          </SettingsItem>
          <SettingsItem
            media={
              <SettingsItemIcon>
                <MonitorIcon />
              </SettingsItemIcon>
            }
            title="Chrome on macOS"
            description="Berlin · Signed in 2 weeks ago"
          >
            <Button size="sm" variant="ghost">
              Revoke
            </Button>
          </SettingsItem>
        </SettingsContainer>
      </SettingsGroup>

      <SettingsGroup>
        <SettingsTitle>Join links</SettingsTitle>
        <SettingsContainer>
          <SettingsEmptyRow action={<Button size="sm">Create join link</Button>}>No join links</SettingsEmptyRow>
        </SettingsContainer>
      </SettingsGroup>

      <SettingsGroup>
        <SettingsTitle>Danger zone</SettingsTitle>
        <SettingsContainer>
          <SettingsRow
            tone="destructive"
            label="Delete this project"
            description="You can restore it for up to 48 hours."
          >
            <Button size="sm" variant="destructive">
              Delete project
            </Button>
          </SettingsRow>
        </SettingsContainer>
      </SettingsGroup>
    </SettingsLayout>
  ),
};

/** A view-only value, a row whose control takes the full width, and a fieldset of switches. */
export const Controls: Story = {
  args: { children: null },
  render: () => (
    <SettingsLayout>
      <SettingsGroup>
        <SettingsTitle>Environment</SettingsTitle>
        <SettingsContainer>
          <SettingsRow label="Working directory" description="Where repositories are cloned." viewOnly>
            /workspace
          </SettingsRow>
          <SettingsRow
            label="Setup command"
            description="Runs once every repository is cloned."
            controlPlacement="below"
          >
            <Input placeholder="./scripts/bootstrap.sh" />
          </SettingsRow>
          <SettingsFieldsetRow label="Notify me" description="Where completion alerts go.">
            <div className="flex items-center gap-3">
              <Switch aria-label="Bell" defaultChecked />
              <Switch aria-label="System" />
            </div>
          </SettingsFieldsetRow>
        </SettingsContainer>
      </SettingsGroup>
    </SettingsLayout>
  ),
};
