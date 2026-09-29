import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
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
import type { DialogSize } from './dialog';
import { Button } from '@/ds/components/Button';
import { TextFieldBlock } from '@/ds/components/FormFieldBlocks';
import { ListSearch } from '@/ds/components/ListSearch';
import { ScrollArea } from '@/ds/components/ScrollArea';

const SIZES: DialogSize[] = ['sm', 'md', 'lg', 'xl', 'full'];

const paragraphs = (count: number) =>
  Array.from({ length: count }, (_, index) => (
    <p key={index}>
      Paragraph {index + 1}. Agents keep their memory across threads, so a change here applies to every conversation
      that uses this agent. Review the instructions before saving.
    </p>
  ));

type PlaygroundArgs = {
  size: DialogSize;
  paragraphCount: number;
  withDescription: boolean;
  withFooter: boolean;
};

function PlaygroundDialog({ size, paragraphCount, withDescription, withFooter }: PlaygroundArgs) {
  return (
    <Dialog>
      <DialogTrigger render={<Button>Open dialog</Button>} />
      <DialogContent size={size}>
        <DialogHeader>
          <DialogTitle>Edit agent instructions</DialogTitle>
          {withDescription && (
            <DialogDescription>Changes apply to every thread that uses this agent.</DialogDescription>
          )}
        </DialogHeader>
        <DialogBody>{paragraphs(paragraphCount)}</DialogBody>
        {withFooter && (
          <DialogFooter>
            <DialogCancel>Cancel</DialogCancel>
            <DialogAction onConfirm={() => {}}>Save changes</DialogAction>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

const meta = {
  title: 'Feedback/Dialog',
  component: PlaygroundDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'One shell for every dialog: `DialogContent` (pick a `size`), `DialogHeader` with `DialogTitle` and a visible `DialogDescription`, `DialogBody`, and `DialogFooter` with `DialogCancel` and `DialogAction`. Padding, spacing, the Close button, scroll fades, and motion are built in, so call sites pass layout only. The body is a padded ScrollArea by default; `layout="fill"` hands scrolling to its children and `flush` drops the inset. A `<form>` placed directly in `DialogContent` joins the layout with no extra classes.',
      },
    },
  },
  argTypes: {
    size: { control: 'inline-radio', options: SIZES },
    paragraphCount: { control: { type: 'number', min: 0, max: 40 } },
  },
  args: {
    size: 'md',
    paragraphCount: 2,
    withDescription: true,
    withFooter: true,
  },
} satisfies Meta<typeof PlaygroundDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`sm` for confirmations, `md` (default) for forms and pickers, `lg` for rich forms and tables, `xl` for split views and viewers, `full` for full-screen tools.',
      },
    },
  },
  render: args => (
    <div className="flex flex-wrap gap-2">
      {SIZES.map(size => (
        <Dialog key={size}>
          <DialogTrigger render={<Button>{size}</Button>} />
          <DialogContent size={size}>
            <DialogHeader>
              <DialogTitle>Size {size}</DialogTitle>
              <DialogDescription>Same padding, spacing, and motion at every width.</DialogDescription>
            </DialogHeader>
            <DialogBody>{paragraphs(args.paragraphCount)}</DialogBody>
            <DialogFooter>
              <DialogCancel>Cancel</DialogCancel>
              <DialogAction onConfirm={() => {}}>Continue</DialogAction>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  ),
};

function RenameForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('Design engineering');
  const [saved, setSaved] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const missingName = submitted && !name.trim();
  return (
    <div className="flex flex-col gap-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button>Rename team</Button>} />
        <DialogContent>
          <form
            noValidate
            onSubmit={event => {
              event.preventDefault();
              setSubmitted(true);
              if (name.trim()) {
                setSaved(name.trim());
                setOpen(false);
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>Rename team</DialogTitle>
              <DialogDescription>Choose a name your team will recognize.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <TextFieldBlock
                name="dialog-team-name"
                label="Team name"
                required
                value={name}
                onChange={event => setName(event.target.value)}
                errorMsg={missingName ? 'Enter a team name' : undefined}
              />
            </DialogBody>
            <DialogFooter>
              <DialogCancel>Cancel</DialogCancel>
              <DialogAction type="submit">Save name</DialogAction>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <p role="status" className="text-caption text-muted-foreground">
        {saved ? `Team renamed to ${saved}.` : 'No changes saved.'}
      </p>
    </div>
  );
}

export const WithForm: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The `<form>` wraps header, body, and footer; `DialogAction type="submit"` submits it, so Enter in a field saves.',
      },
    },
  },
  render: () => <RenameForm />,
};

export const ScrollingBody: Story = {
  args: { paragraphCount: 30 },
  parameters: {
    docs: {
      description: {
        story:
          'Long content scrolls inside the padded body with fading edges; the header and footer stay put and the dialog never outgrows the viewport.',
      },
    },
  },
};

export const FooterWithStatus: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button>Import items</Button>} />
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Import into dataset</DialogTitle>
          <DialogDescription>Add items from a JSON file or paste them directly.</DialogDescription>
        </DialogHeader>
        <DialogBody>{paragraphs(3)}</DialogBody>
        <DialogFooter>
          <p className="mr-auto text-caption text-muted-foreground" aria-live="polite">
            12 items ready to import
          </p>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction onConfirm={() => {}}>Import</DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const FlushBody: Story = {
  parameters: {
    docs: {
      description: {
        story: '`flush` drops the body inset so split panes and their dividers reach the dialog edges.',
      },
    },
  },
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button>Compare versions</Button>} />
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Compare versions</DialogTitle>
          <DialogDescription>Version 3 on the left, the draft on the right.</DialogDescription>
        </DialogHeader>
        <DialogBody flush>
          <div className="grid divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
            <div className="flex flex-col gap-3 p-5">{paragraphs(4)}</div>
            <div className="flex flex-col gap-3 p-5">{paragraphs(4)}</div>
          </div>
        </DialogBody>
        <DialogFooter>
          <DialogCancel>Close</DialogCancel>
          <DialogAction onConfirm={() => {}}>Publish draft</DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

const SKILLS = Array.from({ length: 40 }, (_, index) => `skill-${index + 1}`);

function SkillBrowser() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(SKILLS[0]);
  const visible = SKILLS.filter(skill => skill.includes(search));
  return (
    <Dialog>
      <DialogTrigger render={<Button>Browse skills</Button>} />
      <DialogContent size="xl" className="h-[80vh]">
        <DialogHeader>
          <DialogTitle>Add skill</DialogTitle>
          <DialogDescription>Search the registry and preview a skill before installing it.</DialogDescription>
        </DialogHeader>
        <DialogBody layout="fill">
          <ListSearch label="Search skills" placeholder="Search skills" onSearch={setSearch} debounceMs={0} />
          <div className="grid min-h-0 flex-1 grid-cols-[14rem_1fr] gap-4">
            <ScrollArea className="min-h-0">
              <ul className="flex flex-col">
                {visible.map(skill => (
                  <li key={skill}>
                    <Button variant={skill === selected ? 'default' : 'ghost'} onClick={() => setSelected(skill)}>
                      {skill}
                    </Button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
            <ScrollArea className="min-h-0">
              <div className="flex flex-col gap-3">{paragraphs(12)}</div>
            </ScrollArea>
          </div>
        </DialogBody>
        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction onConfirm={() => {}}>Install {selected}</DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const FillBody: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`layout="fill"` takes the remaining height and leaves scrolling to its children: here the search stays pinned while the list and preview scroll on their own. A fixed height keeps the dialog still while results filter.',
      },
    },
  },
  render: () => <SkillBrowser />,
};

export const FullScreen: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button>Expand code</Button>} />
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle>agent.ts</DialogTitle>
        </DialogHeader>
        <DialogBody layout="fill" flush>
          <ScrollArea className="min-h-0 flex-1" orientation="both">
            <pre className="px-5 py-2 text-caption text-foreground">
              {Array.from(
                { length: 120 },
                (_, index) =>
                  `${String(index + 1).padStart(3)}  const step${index} = createStep({ id: 'step-${index}' });`,
              ).join('\n')}
            </pre>
          </ScrollArea>
        </DialogBody>
      </DialogContent>
    </Dialog>
  ),
};

export const WithoutFooter: Story = {
  args: { withFooter: false, paragraphCount: 3 },
  parameters: {
    docs: {
      description: {
        story: 'Read-only dialogs close with the built-in Close button or Escape; the body keeps its bottom spacing.',
      },
    },
  },
};
