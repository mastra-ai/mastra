import type { Meta, StoryObj } from '@storybook/react-vite';
import { CheckIcon, MailIcon, MinusIcon, PlusIcon, SearchIcon, SendIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { Kbd } from '../Kbd';
import { Txt } from '../Txt/Txt';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from './input-group';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';

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

export const WithTextarea: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-3">
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput placeholder="Search" />
      </InputGroup>
      <InputGroup>
        <InputGroupTextarea placeholder="Textarea" />
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
    <div className="flex w-[calc(100vw-2rem)] max-w-96 flex-col gap-4">
      <div className="border-border bg-sidebar rounded-lg border p-4">
        <Txt variant="caption" tone="muted" className="mb-2">
          Sidebar
        </Txt>
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput aria-label="Search agents on the sidebar" placeholder="Search agents..." />
        </InputGroup>
      </div>
      <div className="border-border bg-background rounded-lg border p-4">
        <Txt variant="caption" tone="muted" className="mb-2">
          Main canvas
        </Txt>
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput aria-label="Search agents on the main canvas" placeholder="Search agents..." />
        </InputGroup>
      </div>
      <div className={`${raisedSurfaceStyle} rounded-lg p-4`}>
        <Txt variant="caption" tone="muted" className="mb-2">
          Card
        </Txt>
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput aria-label="Search agents on a card" placeholder="Search agents..." />
        </InputGroup>
      </div>
      <div className="border-border bg-popover rounded-lg border p-4">
        <Txt variant="caption" tone="muted" className="mb-2">
          Popover
        </Txt>
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput aria-label="Search agents in a popover" placeholder="Search agents..." />
        </InputGroup>
      </div>
    </div>
  ),
};
