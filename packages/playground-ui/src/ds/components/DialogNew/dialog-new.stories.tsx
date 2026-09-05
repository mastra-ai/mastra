import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useRef, useState } from 'react';
import { DialogNew } from './dialog-new';
import { Button } from '@/ds/components/Button';
import type { TextButtonSize } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { Label } from '@/ds/components/Label';
import { Notice } from '@/ds/components/Notice';

function ConfirmationExample({
  holdSeconds = 1.5,
  buttonSize = 'md',
  variant = 'default',
  confirmation = 'click',
  title = 'Unlink repository?',
  description = 'You can link this repository to the Factory again later.',
  actionLabel = 'Unlink repository',
  cancelLabel = 'Cancel',
  failFirst = false,
  longBody = false,
}: {
  holdSeconds?: number;
  buttonSize?: TextButtonSize;
  variant?: 'default' | 'destructive';
  confirmation?: 'click' | 'hold';
  title?: string;
  description?: string;
  actionLabel?: string;
  cancelLabel?: string;
  failFirst?: boolean;
  longBody?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function confirm() {
    setPending(true);
    timer.current = setTimeout(() => {
      setPending(false);
      if (failFirst && !error) {
        setError(true);
        return;
      }
      setError(false);
      setOpen(false);
      setConfirmed(true);
    }, 1200);
  }

  return (
    <div className="flex max-w-sm flex-col gap-4">
      <p className="text-ui-sm text-neutral4">Factory confirmation preview. No data is deleted.</p>
      <DialogNew variant={variant} pending={pending} open={open} onOpenChange={setOpen}>
        <DialogNew.Trigger render={<Button>Open dialog</Button>} />
        <DialogNew.Content>
          <DialogNew.Header>
            <DialogNew.Title>{title}</DialogNew.Title>
          </DialogNew.Header>
          <DialogNew.Body>
            <DialogNew.Description>{description}</DialogNew.Description>
            {longBody && (
              <div className="flex flex-col gap-4">
                {Array.from({ length: 8 }, (_, index) => (
                  <p key={index}>
                    Repository {index + 1}: its checkout and uncommitted changes will be deleted. Existing conversations
                    and remote branches are kept. Commit and push anything you need before continuing.
                  </p>
                ))}
              </div>
            )}
            {error && (
              <div role="alert">
                <Notice variant="destructive">The workspace could not be deleted. Try again.</Notice>
              </div>
            )}
          </DialogNew.Body>
          <DialogNew.Footer>
            <DialogNew.Cancel size={buttonSize}>{cancelLabel}</DialogNew.Cancel>
            <DialogNew.Action
              holdSeconds={holdSeconds}
              size={buttonSize}
              confirmation={confirmation}
              onConfirm={confirm}
            >
              {pending ? 'Working…' : actionLabel}
            </DialogNew.Action>
          </DialogNew.Footer>
        </DialogNew.Content>
      </DialogNew>
      <p role="status" className="text-ui-sm text-neutral4">
        {confirmed ? 'Confirmed. Preview complete.' : 'Waiting for confirmation.'}
      </p>
    </div>
  );
}

const meta = {
  title: 'Feedback/DialogNew',
  component: ConfirmationExample,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Additive dialog system based on Factory workspace and session confirmations. Compose Header, Title, Description, built-in fading scroll Body, and Footer with Cancel and Action. Intent belongs to the root; confirmation="hold" belongs to the action. Actions never close automatically: the caller owns pending, errors, and closing after success. Pending blocks dismissal. Destructive dialogs ignore outside clicks and initially focus Close. Escape cancels before submission. Hold supports primary pointer, Space, and Enter; releasing, leaving, blur, and hiding the tab cancel it. Existing Dialog and AlertDialog are unchanged.',
      },
    },
  },
  argTypes: {
    holdSeconds: { control: { type: 'number', min: 0.1, step: 0.1 } },
    buttonSize: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg'] },
    variant: { control: 'inline-radio', options: ['default', 'destructive'] },
    confirmation: { control: 'inline-radio', options: ['click', 'hold'] },
  },
  args: {
    holdSeconds: 1.5,
    buttonSize: 'md',
    variant: 'default',
    confirmation: 'click',
    failFirst: false,
    longBody: false,
  },
} satisfies Meta<typeof ConfirmationExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    title: 'Delete workspace?',
    description:
      'This deletes the checkout and its uncommitted changes. This can’t be undone. Threads from this workspace are kept.',
    actionLabel: 'Delete workspace',
  },
};

export const PressAndHold: Story = {
  args: {
    ...Destructive.args,
    confirmation: 'hold',
    actionLabel: 'Hold to delete workspace',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Try a short press, release early, move the pointer away, then complete a 1.5-second hold. Tab to the action and hold Space or Enter. A click alone never confirms.',
      },
    },
  },
};

export const LongCopy: Story = {
  args: {
    variant: 'destructive',
    title: 'Delete the workspace for jal/pltfrm-1401-unify-dialogs-including-destructive-and-press-and-hold?',
    description:
      'This permanently deletes the local checkout and all uncommitted changes for this workspace. Conversations and remote branches are kept. Other members of your Factory will lose access to this checkout. Commit and push any work you want to keep before continuing.',
    longBody: true,
    cancelLabel: 'Keep',
    actionLabel: 'Delete',
  },
};

export const ScrollableContent: Story = {
  args: { ...PressAndHold.args, longBody: true },
  parameters: {
    docs: {
      description: {
        story:
          'Body includes a bounded ScrollArea with overflow fades. Long copy scrolls independently of the title and actions.',
      },
    },
  },
};

export const ErrorAndRetry: Story = {
  args: { ...PressAndHold.args, failFirst: true },
  parameters: {
    docs: {
      description: {
        story:
          'The first confirmation shows a recoverable error inside the dialog. The second succeeds. During the simulated request, Cancel, Close, and the action are disabled, and Escape does not dismiss the dialog.',
      },
    },
  },
};

function FactoryForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('Design engineering');
  const [saved, setSaved] = useState('');
  return (
    <div className="flex flex-col gap-4">
      <DialogNew open={open} onOpenChange={setOpen}>
        <DialogNew.Trigger render={<Button>Rename Factory</Button>} />
        <DialogNew.Content>
          <form
            onSubmit={event => {
              event.preventDefault();
              if (name.trim()) {
                setSaved(name.trim());
                setOpen(false);
              }
            }}
          >
            <DialogNew.Header>
              <DialogNew.Title>Rename Factory</DialogNew.Title>
              <DialogNew.Description>Choose a name your team will recognize.</DialogNew.Description>
            </DialogNew.Header>
            <DialogNew.Body>
              <div className="flex flex-col gap-2">
                <Label htmlFor="dialog-new-factory-name">Factory name</Label>
                <Input
                  id="dialog-new-factory-name"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  required
                />
              </div>
            </DialogNew.Body>
            <DialogNew.Footer>
              <DialogNew.Cancel>Cancel</DialogNew.Cancel>
              <Button size="md" type="submit" variant="primary" disabled={!name.trim()}>
                Save name
              </Button>
            </DialogNew.Footer>
          </form>
        </DialogNew.Content>
      </DialogNew>
      <p role="status" className="text-ui-sm text-neutral4">
        {saved ? `Factory renamed to ${saved}.` : 'No changes saved.'}
      </p>
    </div>
  );
}

export const WithForm: Story = { render: () => <FactoryForm /> };
