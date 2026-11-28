import { Button } from '@/ds/components/Button';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { IconChevronDownMedium } from '@/ds/icons/central/IconChevronDownMedium';
import { IconPencil } from '@/ds/icons/central/IconPencil';
import { useLinkComponent } from '@/lib/framework';

export interface AgentEditMenuProps {
  instructionsHref: string;
  toolsHref: string;
  skillsHref: string;
  channelsHref: string;
  settingsHref: string;
}

export function AgentEditMenu({
  instructionsHref,
  toolsHref,
  skillsHref,
  channelsHref,
  settingsHref,
}: AgentEditMenuProps) {
  const { Link } = useLinkComponent();
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <Button variant="ghost" size="sm" icon={<IconPencil />} iconEnd={<IconChevronDownMedium />}>
            Edit
          </Button>
        }
      />
      <DropdownMenu.Content align="end" className="w-56">
        <DropdownMenu.Item render={<Link href={instructionsHref} />}>Instructions</DropdownMenu.Item>
        <DropdownMenu.Item render={<Link href={toolsHref} />}>Tools and connections</DropdownMenu.Item>
        <DropdownMenu.Item render={<Link href={skillsHref} />}>Skills</DropdownMenu.Item>
        <DropdownMenu.Item render={<Link href={channelsHref} />}>Channels and workspace</DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item render={<Link href={settingsHref} />}>Agent settings</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
