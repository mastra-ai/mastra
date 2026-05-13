import type { Meta, StoryObj } from '@storybook/react-vite';
import { CheckIcon, MailIcon, SearchIcon, SendIcon, XIcon } from 'lucide-react';
import { Kbd } from '../Kbd';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from './input-group';

const meta: Meta<typeof InputGroup> = {
  title: 'Composite/InputGroup',
  component: InputGroup,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof InputGroup>;

export const Default: Story = {
  render: () => (
    <div className="w-80">
      <InputGroup>
        <InputGroupInput placeholder="Plain input" />
      </InputGroup>
    </div>
  ),
};

export const WithInlineStartIcon: Story = {
  render: () => (
    <div className="w-80">
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput placeholder="Search..." />
      </InputGroup>
    </div>
  ),
};

export const WithInlineEndButton: Story = {
  render: () => (
    <div className="w-80">
      <InputGroup>
        <InputGroupInput placeholder="Email address" type="email" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton aria-label="Submit">
            <SendIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
};

export const WithLeadingAndTrailing: Story = {
  render: () => (
    <div className="w-80">
      <InputGroup>
        <InputGroupAddon>
          <MailIcon />
        </InputGroupAddon>
        <InputGroupInput placeholder="you@example.com" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton aria-label="Clear">
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
};

export const WithText: Story = {
  render: () => (
    <div className="w-80">
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>https://</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="example.com" />
      </InputGroup>
    </div>
  ),
};

export const WithKbd: Story = {
  render: () => (
    <div className="w-80">
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput placeholder="Search..." />
        <InputGroupAddon align="inline-end">
          <Kbd>⌘K</Kbd>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
};

export const BlockStartAddon: Story = {
  render: () => (
    <div className="w-80">
      <InputGroup>
        <InputGroupAddon align="block-start">
          <InputGroupText>Recipient</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="name@example.com" />
      </InputGroup>
    </div>
  ),
};

export const BlockEndAddon: Story = {
  render: () => (
    <div className="w-80">
      <InputGroup>
        <InputGroupTextarea placeholder="Type a message..." />
        <InputGroupAddon align="block-end">
          <InputGroupButton aria-label="Submit">
            <CheckIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3 w-80">
      <InputGroup size="sm">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput placeholder="Small" />
      </InputGroup>
      <InputGroup size="md">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput placeholder="Medium" />
      </InputGroup>
      <InputGroup size="default">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput placeholder="Default" />
      </InputGroup>
      <InputGroup size="lg">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput placeholder="Large" />
      </InputGroup>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="w-80">
      <InputGroup>
        <InputGroupAddon>
          <MailIcon />
        </InputGroupAddon>
        <InputGroupInput placeholder="Disabled" disabled value="locked@example.com" />
      </InputGroup>
    </div>
  ),
};

export const Invalid: Story = {
  render: () => (
    <div className="w-80">
      <InputGroup>
        <InputGroupAddon>
          <MailIcon />
        </InputGroupAddon>
        <InputGroupInput placeholder="Invalid" defaultValue="not an email" error />
      </InputGroup>
    </div>
  ),
};

export const Textarea: Story = {
  render: () => (
    <div className="w-80">
      <InputGroup>
        <InputGroupTextarea placeholder="Write a comment..." />
      </InputGroup>
    </div>
  ),
};
