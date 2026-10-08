import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  BookOpenIcon,
  CopyIcon,
  LogOutIcon,
  MessageCircleQuestionIcon,
  PlusIcon,
  SettingsIcon,
  UserIcon,
} from 'lucide-react';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { Avatar } from '../Avatar/Avatar';
import { CompositeAvatar } from '../Avatar/composite-avatar';
import { AvatarRail } from '../AvatarRail/index';
import { Status } from '../StatusIndicators/status';
import { ThemeToggle } from '../ThemeToggle/theme-toggle';
import { Txt } from '../Txt/Txt';
import { DropdownMenu } from './dropdown-menu';

const assetRoot = 'https://app.paper.design/file-assets/01M3ZEJQE1FBY8QS12PDAP7EAD';
const portrait = `${assetRoot}/1BJ2ESN9ZCN5BC6T2NEBFW90AE.png`;
const mastraLogo = `${assetRoot}/2HJ0BRDHF4SC53J60Z9SPYRCWJ.svg`;
const acmeLogo = `${assetRoot}/79G81N89BYFZ042YPVSGEZDNXR.png`;
const cloudLogo = `${assetRoot}/3KNRJGGDY2N767QXGDP3ZTM4EM.svg`;
const longOrganizationName =
  'testfrkjgakjrlkgjajlgjkalkjglkajlgjlajlrgjalkjglajklgkjalkjglakjlgkajljalkjgljkljlkkjlkjl';

const defaultOrganization = { id: 'mastra', name: longOrganizationName, logo: mastraLogo };
const organizations = [
  defaultOrganization,
  { id: 'acme', name: 'Acme', logo: acmeLogo },
  { id: 'cloud', name: 'Cloud', logo: cloudLogo },
];

function resolveTheme(theme: 'light' | 'dark' | 'system') {
  if (theme !== 'system') return theme;
  if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  return 'dark';
}

function AccountMenuExample({
  initiallyOpen = true,
  initialTheme = 'dark',
  includeCopyAction = false,
  multiOrg = true,
}: {
  initiallyOpen?: boolean;
  initialTheme?: 'light' | 'dark';
  includeCopyAction?: boolean;
  multiOrg?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [current, setCurrent] = useState(defaultOrganization);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(initialTheme);

  return (
    <div className="w-72">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenu.IdentityTrigger
          aria-label="Justin Levine menu"
          aria-haspopup="dialog"
          description={current.name}
          avatar={
            <CompositeAvatar badge={<Avatar name={current.name} src={current.logo} size="xs" />}>
              <Avatar name="Justin Levine" src={portrait} size="md" />
            </CompositeAvatar>
          }
        >
          Justin Levine
        </DropdownMenu.IdentityTrigger>
        <DropdownMenu.Content
          aria-label="Account menu"
          side="top"
          align="start"
          sideOffset={8}
          layout="account"
          rail={
            multiOrg && (
              <AvatarRail aria-label="Organizations">
                {organizations.map(organization => (
                  <AvatarRail.Item
                    key={organization.id}
                    aria-label={organization.name}
                    current={organization.id === current.id}
                    onClick={() => setCurrent(organization)}
                  >
                    <Avatar name={organization.name} src={organization.logo} size="control" />
                  </AvatarRail.Item>
                ))}
                <AvatarRail.Item aria-label="Create an organization" variant="action" onClick={() => setOpen(false)}>
                  <PlusIcon />
                </AvatarRail.Item>
              </AvatarRail>
            )
          }
        >
          <div className="flex min-w-0 items-center gap-2.5 px-3 py-1.5">
            <Avatar name="Justin Levine" src={portrait} size="md" />
            <div className="flex min-w-0 flex-1 flex-col">
              <Txt variant="label" className="truncate">
                Justin Levine
              </Txt>
              <Txt variant="body-sm" tone="muted" className="truncate">
                github@fwdtojustin.com
              </Txt>
            </div>
          </div>
          <DropdownMenu.Separator />
          <div className="flex min-w-0 flex-col px-3 py-1.5">
            <Txt variant="label" className="truncate">
              {current.name}
            </Txt>
            <Txt variant="body-sm" tone="muted">
              Admin
            </Txt>
          </div>
          <DropdownMenu.Group role="menu" aria-label="Organization actions">
            <DropdownMenu.Item>
              <SettingsIcon />
              Organization settings
            </DropdownMenu.Item>
            {includeCopyAction && (
              <DropdownMenu.Item>
                <CopyIcon />
                Copy organization ID
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Group>
          <DropdownMenu.Separator />
          <DropdownMenu.Group role="menu" aria-label="Account actions">
            <DropdownMenu.Item>
              <UserIcon />
              Account settings
            </DropdownMenu.Item>
          </DropdownMenu.Group>
          <DropdownMenu.Separator />
          <DropdownMenu.Group role="menu" aria-label="Help">
            <DropdownMenu.Item>
              <MessageCircleQuestionIcon />
              Contact
            </DropdownMenu.Item>
            <DropdownMenu.Item render={<a href="https://mastra.ai/docs" target="_blank" rel="noreferrer" />}>
              <BookOpenIcon />
              Documentation
            </DropdownMenu.Item>
          </DropdownMenu.Group>
          <DropdownMenu.Separator />
          <div className="flex items-center justify-between gap-3 px-3 py-0.5">
            <Txt variant="label" tone="muted">
              Theme
            </Txt>
            <ThemeToggle
              value={theme}
              onChange={next => {
                setTheme(next);
                const resolved = resolveTheme(next);
                document.documentElement.classList.toggle('light', resolved === 'light');
                document.documentElement.classList.toggle('dark', resolved === 'dark');
              }}
            />
          </div>
          <DropdownMenu.Separator />
          <div className="flex items-center gap-2">
            <DropdownMenu.Group role="menu" aria-label="Session" className="min-w-0 flex-1">
              <DropdownMenu.Item>
                <LogOutIcon />
                Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Group>
            <Txt as="span" variant="meta" className="shrink-0">
              <Status
                className="mr-2"
                presentation={{ label: 'Operational', tone: 'success', description: 'All systems are operational.' }}
              />
            </Txt>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
}

const meta = {
  title: 'Composite/AccountMenu',
  component: AccountMenuExample,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof AccountMenuExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dark: Story = {
  args: { initiallyOpen: true },
  globals: { theme: 'dark' },
};

export const Light: Story = {
  args: { initiallyOpen: true, initialTheme: 'light' },
  globals: { theme: 'light' },
};

export const ClosedTrigger: Story = {
  args: { initiallyOpen: false },
};

export const Keyboard: Story = {
  args: { initiallyOpen: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Justin Levine menu' }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('dialog', { name: 'Account menu' });
    await waitFor(() => expect(dialog).toBeVisible());
    await userEvent.keyboard('{ArrowLeft}{ArrowDown}');
    await waitFor(() => expect(body.getByRole('button', { name: 'Acme' })).toHaveFocus());
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(body.getByRole('button', { name: 'Acme' })).toHaveAttribute('aria-current', 'true'));
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(body.getByRole('menuitem', { name: 'Organization settings' })).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Justin Levine menu' })).toHaveFocus());
  },
};

export const WithOrganizationCopy: Story = {
  args: { includeCopyAction: true },
};

export const WithoutRail: Story = {
  args: { multiOrg: false },
  globals: { theme: 'dark' },
};
