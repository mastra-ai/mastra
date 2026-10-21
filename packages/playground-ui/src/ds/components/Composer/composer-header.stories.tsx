import type { Meta, StoryObj } from '@storybook/react-vite';
import { UserRound } from 'lucide-react';
import { useState } from 'react';

import { Button } from '../Button';
import { Checkbox } from '../Checkbox';
import { Spinner } from '../Spinner';
import { Composer, ComposerActions, ComposerBox, ComposerInput, ComposerRing } from './composer';
import { ComposerHeader, ComposerHeaderActions, ComposerHeaderContent, ComposerHeaderRow } from './composer-header';

const meta: Meta<typeof ComposerHeader> = {
  title: 'AI/Composer Header',
  component: ComposerHeader,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Compose optional context above ComposerRing or ComposerBox. The header owns its surface, width, spacing, and joined edge. Rows, content, and actions accept arbitrary children. Callers own data, visibility, and live announcements; a header with no rendered children collapses automatically. Use type="button" for header actions inside the composer form.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ComposerHeader>;

export const ConnectionStatus: Story = {
  render: () => (
    <Composer aria-label="Message composer">
      <ComposerHeader>
        <ComposerHeaderRow role="status" aria-live="polite">
          <Spinner size="sm" aria-hidden="true" role="presentation" />
          <ComposerHeaderContent>Reconnecting…</ComposerHeaderContent>
        </ComposerHeaderRow>
      </ComposerHeader>
      <ComposerRing>
        <ComposerBox>
          <ComposerInput aria-label="Message" placeholder="Write a message…" disabled />
          <ComposerActions />
        </ComposerBox>
      </ComposerRing>
    </Composer>
  ),
};

function OwnershipRow() {
  const [owned, setOwned] = useState(false);

  return (
    <ComposerHeaderRow>
      <UserRound aria-hidden="true" />
      <ComposerHeaderContent>
        {owned ? 'You own this session.' : "You're viewing Sam's session. Take ownership to change its model."}
      </ComposerHeaderContent>
      {!owned && (
        <ComposerHeaderActions>
          <Button type="button" size="sm" onClick={() => setOwned(true)}>
            Take ownership
          </Button>
        </ComposerHeaderActions>
      )}
    </ComposerHeaderRow>
  );
}

export const OwnershipAndTasks: Story = {
  render: () => (
    <Composer aria-label="Message composer" onSubmit={event => event.preventDefault()}>
      <ComposerHeader>
        <OwnershipRow />
        <ComposerHeaderRow>
          <ComposerHeaderContent>
            <details open>
              <summary>Session tasks</summary>
              <ul className="mt-2 flex flex-col gap-2">
                <li>
                  <label className="flex items-center gap-2">
                    <Checkbox defaultChecked />
                    Review the existing implementation
                  </label>
                </li>
                <li>
                  <label className="flex items-center gap-2">
                    <Checkbox />
                    Verify the proposed changes
                  </label>
                </li>
              </ul>
            </details>
          </ComposerHeaderContent>
        </ComposerHeaderRow>
      </ComposerHeader>
      <ComposerRing>
        <ComposerBox>
          <ComposerInput aria-label="Message" placeholder="Steer the agent…" />
          <ComposerActions>
            <Button type="submit" size="sm">
              Send message
            </Button>
          </ComposerActions>
        </ComposerBox>
      </ComposerRing>
    </Composer>
  ),
};

function OptionalContext({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <ComposerHeaderRow>
      <ComposerHeaderContent>Optional session context</ComposerHeaderContent>
    </ComposerHeaderRow>
  );
}

function ToggleHeaderPreview() {
  const [visible, setVisible] = useState(true);

  return (
    <div className="flex flex-col gap-4">
      <Button type="button" size="sm" onClick={() => setVisible(!visible)}>
        Toggle context
      </Button>
      <Composer aria-label="Message composer">
        <ComposerHeader>
          <OptionalContext visible={visible} />
        </ComposerHeader>
        <ComposerBox>
          <ComposerInput aria-label="Message" placeholder="Your draft stays when context changes…" />
          <ComposerActions />
        </ComposerBox>
      </Composer>
    </div>
  );
}

export const ConditionalContent: Story = {
  render: () => <ToggleHeaderPreview />,
};
