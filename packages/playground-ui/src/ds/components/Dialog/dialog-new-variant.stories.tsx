import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import { Button } from '@/ds/components/Button';
import type { TextButtonSize } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { Label } from '@/ds/components/Label';
import { Notice } from '@/ds/components/Notice';

function ConfirmationExample({
  holdSeconds = 1.5,
  buttonSize = 'md',
  intent = 'default',
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
  intent?: 'default' | 'destructive';
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
      <Dialog variant="new" intent={intent} pending={pending} open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button>Open dialog</Button>} />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DialogDescription>{description}</DialogDescription>
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
          </DialogBody>
          <DialogFooter>
            <DialogCancel size={buttonSize}>{cancelLabel}</DialogCancel>
            <DialogAction holdSeconds={holdSeconds} size={buttonSize} confirmation={confirmation} onConfirm={confirm}>
              {pending ? 'Working…' : actionLabel}
            </DialogAction>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <p role="status" className="text-ui-sm text-neutral4">
        {confirmed ? 'Confirmed. Preview complete.' : 'Waiting for confirmation.'}
      </p>
    </div>
  );
}

const meta = {
  title: 'Feedback/Dialog/New variant',
  component: ConfirmationExample,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The `variant="new"` shell of Dialog, based on Factory workspace and session confirmations. The default variant is unchanged. Compose Header, Title, Description, built-in fading scroll Body, and Footer with Cancel and Action. Intent belongs to the root; confirmation="hold" belongs to the action. Actions never close automatically: the caller owns pending, errors, and closing after success. Pending blocks dismissal. Destructive dialogs ignore outside clicks and initially focus Close. Escape cancels before submission. Hold supports primary pointer, Space, and Enter; releasing, leaving, blur, and hiding the tab cancel it. The body always renders inside a bounded, fading ScrollArea, so long copy needs no special variant.',
      },
    },
  },
  argTypes: {
    holdSeconds: { control: { type: 'number', min: 0.1, step: 0.1 } },
    buttonSize: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg'] },
    intent: { control: 'inline-radio', options: ['default', 'destructive'] },
    confirmation: { control: 'inline-radio', options: ['click', 'hold'] },
  },
  args: {
    holdSeconds: 1.5,
    buttonSize: 'md',
    intent: 'default',
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
    intent: 'destructive',
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

export const LongTitleAndLabels: Story = {
  args: {
    intent: 'destructive',
    title: 'Delete the workspace for jal/pltfrm-1401-unify-dialogs-including-destructive-and-press-and-hold?',
    description:
      'This permanently deletes the local checkout and all uncommitted changes for this workspace. Conversations and remote branches are kept. Other members of your Factory will lose access to this checkout. Commit and push any work you want to keep before continuing.',
    longBody: true,
    cancelLabel: 'Keep',
    actionLabel: 'Delete',
  },
};

export const ScrollingBody: Story = {
  args: { ...PressAndHold.args, longBody: true },
  parameters: {
    docs: {
      description: {
        story:
          'Every new-variant body is a bounded ScrollArea with overflow fades, so long copy scrolls independently of the title and actions without a dedicated variant.',
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
      <Dialog variant="new" open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button>Rename Factory</Button>} />
        <DialogContent>
          <form
            onSubmit={event => {
              event.preventDefault();
              if (name.trim()) {
                setSaved(name.trim());
                setOpen(false);
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>Rename Factory</DialogTitle>
              <DialogDescription>Choose a name your team will recognize.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="flex flex-col gap-2">
                <Label htmlFor="dialog-new-factory-name">Factory name</Label>
                <Input
                  id="dialog-new-factory-name"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  required
                />
              </div>
            </DialogBody>
            <DialogFooter>
              <DialogCancel>Cancel</DialogCancel>
              <Button size="md" type="submit" variant="primary" disabled={!name.trim()}>
                Save name
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <p role="status" className="text-ui-sm text-neutral4">
        {saved ? `Factory renamed to ${saved}.` : 'No changes saved.'}
      </p>
    </div>
  );
}

export const WithForm: Story = { render: () => <FactoryForm /> };
