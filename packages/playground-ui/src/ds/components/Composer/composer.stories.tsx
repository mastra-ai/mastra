import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowUp, Paperclip } from 'lucide-react';

import { Button } from '../Button';
import { Chip } from '../Chip';
import { Composer, ComposerActions, ComposerAttachments, ComposerBox, ComposerInput } from './composer';

const meta: Meta<typeof Composer> = {
  title: 'Elements/Composer',
  component: Composer,
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof Composer>;

export const Empty: Story = {
  render: () => (
    <Composer aria-label="Message composer">
      <ComposerBox>
        <ComposerInput aria-label="Message" placeholder="Enter your message..." />
        <ComposerActions>
          <span />
          <Button type="submit" size="icon-md" aria-label="Send message" disabled>
            <ArrowUp />
          </Button>
        </ComposerActions>
      </ComposerBox>
    </Composer>
  ),
};

export const WithAttachmentsAndActions: Story = {
  render: () => (
    <Composer aria-label="Message composer">
      <ComposerAttachments>
        <Chip>project-notes.txt</Chip>
      </ComposerAttachments>
      <ComposerBox>
        <ComposerInput aria-label="Message" defaultValue="Summarize the attached notes." />
        <ComposerActions>
          <Button type="button" size="icon-md" aria-label="Attach file">
            <Paperclip />
          </Button>
          <Button type="submit" size="icon-md" aria-label="Send message">
            <ArrowUp />
          </Button>
        </ComposerActions>
      </ComposerBox>
    </Composer>
  ),
};

export const DisabledAndRunning: Story = {
  render: () => (
    <Composer aria-label="Message composer">
      <ComposerBox sendingPulseKey={1}>
        <ComposerInput aria-label="Message" value="Waiting for the current run..." disabled readOnly />
        <ComposerActions>
          <span className="text-ui-sm text-neutral3">Running</span>
          <Button type="button" size="md">
            Cancel
          </Button>
        </ComposerActions>
      </ComposerBox>
    </Composer>
  ),
};
