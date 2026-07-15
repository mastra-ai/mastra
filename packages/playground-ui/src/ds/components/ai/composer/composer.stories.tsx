import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowUp, ImagePlus, Square, X } from 'lucide-react';

import {
  Composer,
  ComposerActionButton,
  ComposerActions,
  ComposerAttachment,
  ComposerAttachmentRemove,
  ComposerAttachments,
  ComposerBox,
  ComposerInput,
  ComposerSubmitButton,
} from './composer';

const meta: Meta<typeof Composer> = {
  title: 'AI/Composer',
  component: Composer,
  decorators: [
    Story => (
      <div className="w-full max-w-3xl p-4">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof Composer>;

const DefaultActions = () => (
  <ComposerActions>
    <ComposerActionButton aria-label="Attach image">
      <ImagePlus />
    </ComposerActionButton>
    <ComposerSubmitButton aria-label="Send message">
      <ArrowUp />
    </ComposerSubmitButton>
  </ComposerActions>
);

export const Default: Story = {
  render: () => (
    <Composer>
      <ComposerBox>
        <ComposerInput aria-label="Message" placeholder="Ask Mastra Code…" className="min-h-12 resize-none" />
        <DefaultActions />
      </ComposerBox>
    </Composer>
  ),
};

export const WithAttachment: Story = {
  render: () => (
    <Composer>
      <ComposerBox>
        <ComposerAttachments>
          <ComposerAttachment>
            <div className="size-14 rounded-md border border-border1 bg-gradient-to-br from-surface4 to-surface6" />
            <ComposerAttachmentRemove aria-label="Remove image">
              <X />
            </ComposerAttachmentRemove>
          </ComposerAttachment>
        </ComposerAttachments>
        <ComposerInput
          aria-label="Message"
          defaultValue="What is shown in this image?"
          className="min-h-12 resize-none"
        />
        <DefaultActions />
      </ComposerBox>
    </Composer>
  ),
};

export const Busy: Story = {
  render: () => (
    <Composer>
      <ComposerBox>
        <ComposerInput aria-label="Message" placeholder="Steer the agent…" className="min-h-12 resize-none" />
        <ComposerActions>
          <ComposerActionButton aria-label="Attach image">
            <ImagePlus />
          </ComposerActionButton>
          <ComposerActionButton variant="outline" aria-label="Abort">
            <Square />
          </ComposerActionButton>
          <ComposerSubmitButton aria-label="Send message">
            <ArrowUp />
          </ComposerSubmitButton>
        </ComposerActions>
      </ComposerBox>
    </Composer>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Composer>
      <ComposerBox>
        <ComposerInput disabled aria-label="Message" placeholder="Connecting…" className="min-h-12 resize-none" />
        <ComposerActions>
          <ComposerActionButton disabled aria-label="Attach image">
            <ImagePlus />
          </ComposerActionButton>
          <ComposerSubmitButton disabled aria-label="Send message">
            <ArrowUp />
          </ComposerSubmitButton>
        </ComposerActions>
      </ComposerBox>
    </Composer>
  ),
};

export const Multiline: Story = {
  render: () => (
    <Composer>
      <ComposerBox>
        <ComposerInput
          aria-label="Message"
          defaultValue={
            'Review the authentication flow and propose a migration plan.\n\nInclude testing and rollout steps.'
          }
          className="min-h-28 resize-y"
        />
        <DefaultActions />
      </ComposerBox>
    </Composer>
  ),
};
