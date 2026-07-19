import type { Meta, StoryObj } from '@storybook/react-vite';
import { CheckIcon, MailIcon, MinusIcon, PlusIcon, SearchIcon, SendIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
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
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'filled', 'outline'],
    },
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

export const Variants: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-3">
      <InputGroup variant="default">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput placeholder="Default" />
      </InputGroup>
      <InputGroup variant="filled">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput placeholder="Filled" />
      </InputGroup>
      <InputGroup variant="outline">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput placeholder="Outline" />
      </InputGroup>
      <InputGroup variant="outline">
        <InputGroupTextarea placeholder="Outline textarea" />
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
    <div className="flex w-80 flex-col gap-3">
      <InputGroup size="xs">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput placeholder="Extra Small" />
      </InputGroup>
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

const NumberWithStepperDemo = () => {
  const [value, setValue] = useState(0);
  return (
    <div className="w-80">
      <InputGroup>
        <InputGroupInput
          type="number"
          value={value}
          onChange={event => {
            const next = Number(event.target.value);
            setValue(Number.isNaN(next) ? 0 : next);
          }}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton aria-label="Decrement" onClick={() => setValue(v => v - 1)}>
            <MinusIcon />
          </InputGroupButton>
          <InputGroupButton aria-label="Increment" onClick={() => setValue(v => v + 1)}>
            <PlusIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
};

export const NumberWithStepper: Story = {
  render: () => <NumberWithStepperDemo />,
};

export const OnDifferentSurfaces: Story = {
  render: () => (
    <div className="flex w-96 flex-col gap-4">
      <div className="rounded-lg border border-border1 bg-surface1 p-4">
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput placeholder="On bg-surface1" />
        </InputGroup>
      </div>
      <div className="rounded-lg border border-border1 bg-surface2 p-4">
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput placeholder="On bg-surface2" />
        </InputGroup>
      </div>
      <div className="rounded-lg border border-border1 bg-surface3 p-4">
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput placeholder="On bg-surface3" />
        </InputGroup>
      </div>
      <div className="rounded-lg border border-border1 bg-surface4 p-4">
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput placeholder="On bg-surface4" />
        </InputGroup>
      </div>
    </div>
  ),
};
