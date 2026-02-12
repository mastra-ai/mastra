import type { Meta, StoryObj } from '@storybook/react-vite';
import { MainHeader } from './main-header';
import { BotIcon, Edit2Icon } from 'lucide-react';
import { Button } from '../Button';
import { TextAndIcon } from '../Text';
import { CopyButton } from '../CopyButton';
import { TooltipProvider } from '../Tooltip';

const meta: Meta<typeof MainHeader> = {
  title: 'Layout/MainHeader',
  component: MainHeader,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MainHeader>;

export const Default: Story = {
  render: () => (
    <TooltipProvider>
      <MainHeader>
        <MainHeader.Column>
          <MainHeader.Title>
            <BotIcon /> Agents <CopyButton content={'Agents'} />
          </MainHeader.Title>
          <MainHeader.Description>Create and manage AI agents for your workflows</MainHeader.Description>
        </MainHeader.Column>
        <MainHeader.Column>
          <Button variant="cta" size="default">
            <Edit2Icon />
            Edit
          </Button>
        </MainHeader.Column>
      </MainHeader>
    </TooltipProvider>
  ),
};

export const WithDescription: Story = {
  render: () => (
    <MainHeader>
      <MainHeader.Column>
        <MainHeader.Title>Agents</MainHeader.Title>
        <MainHeader.Description>Create and manage AI agents for your workflows</MainHeader.Description>
      </MainHeader.Column>
    </MainHeader>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <MainHeader>
      <MainHeader.Column>
        <MainHeader.Title>
          <BotIcon /> Agents
        </MainHeader.Title>
        <MainHeader.Description>Create and manage AI agents for your workflows</MainHeader.Description>
      </MainHeader.Column>
    </MainHeader>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <MainHeader>
      <MainHeader.Column>
        <MainHeader.Title>
          <BotIcon /> Agents
        </MainHeader.Title>
        <MainHeader.Description>
          <TextAndIcon>
            <BotIcon />
            Create and manage AI agents for your workflows
          </TextAndIcon>
        </MainHeader.Description>
        <MainHeader.Description>Create and manage AI</MainHeader.Description>
      </MainHeader.Column>
    </MainHeader>
  ),
};

export const Loading: Story = {
  render: () => (
    <MainHeader>
      <MainHeader.Column>
        <MainHeader.Title isLoading>
          <BotIcon /> Agents
        </MainHeader.Title>
        <MainHeader.Description isLoading>Create and manage AI agents for your workflows</MainHeader.Description>
      </MainHeader.Column>
    </MainHeader>
  ),
};

export const LongDescription: Story = {
  render: () => (
    <MainHeader>
      <MainHeader.Column>
        <MainHeader.Title>
          <BotIcon /> Agents
        </MainHeader.Title>
        <MainHeader.Description>
          Configure your data storage settings including database connections, caching strategies, and backup schedules.
          These settings affect how your application stores and retrieves data.
        </MainHeader.Description>
      </MainHeader.Column>
    </MainHeader>
  ),
};

export const WithSecondColumn: Story = {
  render: () => (
    <MainHeader>
      <MainHeader.Column>
        <MainHeader.Title>
          <BotIcon /> Agents
        </MainHeader.Title>
        <MainHeader.Description>Create and manage AI agents for your workflows</MainHeader.Description>
      </MainHeader.Column>
      <MainHeader.Column>
        <Button variant="cta" size="default">
          <Edit2Icon />
          Edit
        </Button>
      </MainHeader.Column>
    </MainHeader>
  ),
};
