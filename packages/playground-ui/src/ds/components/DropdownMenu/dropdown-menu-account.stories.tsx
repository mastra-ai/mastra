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

function AccountMenuExample({
  initiallyOpen = true,
  initialTheme = 'dark',
  includeCopyAction = false,
}: {
  initiallyOpen?: boolean;
  initialTheme?: 'light' | 'dark';
  includeCopyAction?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [organization, setOrganization] = useState('mastra');
  const organizationName =
    organization === 'mastra' ? longOrganizationName : organization === 'acme' ? 'Acme' : 'Cloud';
  const organizationLogo = organization === 'mastra' ? mastraLogo : organization === 'acme' ? acmeLogo : cloudLogo;
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(initialTheme);

  return (
    <div className="w-72">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenu.IdentityTrigger
          aria-label="Justin Levine menu"
          aria-haspopup="dialog"
          description={organizationName}
          avatar={
            <CompositeAvatar badge={<Avatar name={organizationName} src={organizationLogo} size="xs" />}>
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
          rail={
            <AvatarRail aria-label="Organizations">
              <AvatarRail.Item
                aria-label={longOrganizationName}
                current={organization === 'mastra'}
                onClick={() => setOrganization('mastra')}
              >
                <Avatar name={longOrganizationName} src={mastraLogo} size="rail" />
              </AvatarRail.Item>
              <AvatarRail.Item
                aria-label="Acme"
                current={organization === 'acme'}
                onClick={() => setOrganization('acme')}
              >
                <Avatar name="Acme" src={acmeLogo} size="rail" />
              </AvatarRail.Item>
              <AvatarRail.Item
                aria-label="Cloud"
                current={organization === 'cloud'}
                onClick={() => setOrganization('cloud')}
              >
                <Avatar name="Cloud" src={cloudLogo} size="rail" />
              </AvatarRail.Item>
              <AvatarRail.Item aria-label="Create an organization" variant="action" onClick={() => setOpen(false)}>
                <PlusIcon />
              </AvatarRail.Item>
            </AvatarRail>
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
              {organizationName}
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
                const resolved =
                  next === 'system'
                    ? window.matchMedia('(prefers-color-scheme: light)').matches
                      ? 'light'
                      : 'dark'
                    : next;
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
