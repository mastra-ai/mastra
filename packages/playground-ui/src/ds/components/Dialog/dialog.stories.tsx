import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { expect, waitFor, within } from 'storybook/test';
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
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Field, FieldError, FieldLabel } from '@/ds/components/Field';
import { Form } from '@/ds/components/Form';
import { Input } from '@/ds/components/Input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/ds/components/InputGroup';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { SearchInput } from '@/ds/components/SearchInput';
import { Switch } from '@/ds/components/Switch';
import { Txt } from '@/ds/components/Txt';
import { SettingsContainer, SettingsFieldsetRow, SettingsRow } from '@/ds/new/settings';
import { formatCost } from '@/lib/cost';

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
          'One shell for every dialog: `DialogContent` (pick a `size`), `DialogHeader` with `DialogTitle` and a visible `DialogDescription`, `DialogBody`, and `DialogFooter` with `DialogCancel` and `DialogAction`. Padding, spacing, the Close button, scroll fades, and motion are built in, so call sites pass layout only. The body is a padded ScrollArea by default; `layout="fill"` hands scrolling to its children and `flush` drops the inset. A `<Form>` placed directly in `DialogContent` joins the layout with no extra classes. Below 640px every dialog opens as a bottom drawer you can swipe down to close; switch the viewport toolbar to a phone to see it.',
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
  return (
    <div className="flex flex-col gap-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button>Rename team</Button>} />
        <DialogContent>
          <Form
            onSubmit={event => {
              event.preventDefault();
              setSaved(name.trim());
              setOpen(false);
            }}
          >
            <DialogHeader>
              <DialogTitle>Rename team</DialogTitle>
              <DialogDescription>Choose a name your team will recognize.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <Field>
                <FieldLabel required>Team name</FieldLabel>
                <Input required value={name} onChange={event => setName(event.target.value)} />
                <FieldError />
              </Field>
            </DialogBody>
            <DialogFooter>
              <DialogCancel>Cancel</DialogCancel>
              <DialogAction type="submit">Save name</DialogAction>
            </DialogFooter>
          </Form>
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
          'The `Form` wraps header, body, and footer; `DialogAction type="submit"` submits it, so Enter in a field saves.',
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
          <SearchInput label="Search skills" placeholder="Search skills" value={search} onValueChange={setSearch} />
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

function PlanColumn({
  name,
  price,
  cadence,
  summary,
  allowances,
  current = false,
  children,
}: {
  name: string;
  price: string;
  cadence?: string;
  summary: string;
  allowances: string[];
  current?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={name}
      className="flex min-w-0 flex-col gap-5 p-4 data-[current=true]:rounded-xl data-[current=true]:bg-fill-subtle"
      data-current={current}
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <Txt as="h3" variant="subheading" tone="ink">
            {name}
          </Txt>
          {current && (
            <Badge variant="success" emphasis="subtle" size="sm">
              Current
            </Badge>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <Txt as="p" variant="title" tone="ink">
            {price}
          </Txt>
          {cadence && (
            <Txt as="span" variant="body-sm" tone="muted">
              {cadence}
            </Txt>
          )}
        </div>
        <Txt as="p" variant="body-sm" tone="muted" className="min-h-10">
          {summary}
        </Txt>
      </div>
      <ul className="flex flex-1 flex-col">
        {allowances.map(allowance => (
          <li key={allowance} className="border-t border-border py-2">
            <Txt as="span" variant="body-sm" tone="ink">
              {allowance}
            </Txt>
          </li>
        ))}
      </ul>
      {children}
    </section>
  );
}

export const FullPage: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`size="full"` is the inset, rounded, near-viewport surface: the title sits left with the built-in Close button right, the default scrolling body holds side-by-side columns that stack below `md`, and the footnote closes the body.',
      },
    },
  },
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button>Compare plans</Button>} />
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle>Plans</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="grid divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
            <PlanColumn
              name="Free"
              price="$0"
              summary="Build and test your first agents."
              allowances={[
                'Unlimited deploys',
                '100 GB-hours memory',
                '40 vCPU-hours',
                '1 GB egress',
                'Storage by project size',
                '100,000 events',
                '15-day trace retention',
                'Up to 3 projects',
              ]}
            >
              {/* oxlint-disable-next-line mastra/sentence-case-labels -- plan names are proper nouns */}
              <Button>Downgrade to Free</Button>
            </PlanColumn>
            <PlanColumn
              name="Starter"
              price="$25"
              cadence="/ month"
              summary="Higher allowances and 1× Small."
              allowances={[
                'Unlimited deploys',
                '360 GB-hours memory',
                '100 vCPU-hours',
                '10 GB egress',
                'Storage by project size',
                '250,000 events',
                '60-day trace retention',
                '1× Small included',
              ]}
              current
            >
              <Button disabled>Current plan</Button>
            </PlanColumn>
            <PlanColumn
              name="Teams"
              price="$250"
              cadence="/ month"
              summary="Two Medium projects and SOC 2."
              allowances={[
                'Unlimited deploys',
                '3,600 GB-hours memory',
                '400 vCPU-hours',
                '100 GB egress',
                'Storage by project size',
                '10,000,000 events',
                '180-day trace retention',
                '2× Medium included',
              ]}
            >
              {/* oxlint-disable-next-line mastra/sentence-case-labels -- plan names are proper nouns */}
              <Button variant="primary">Upgrade to Teams</Button>
            </PlanColumn>
            <PlanColumn
              name="Enterprise"
              price="Custom"
              summary="RBAC, SSO, audit logs and custom allowances."
              allowances={[
                'Unlimited deploys',
                'Custom memory',
                'Custom vCPU',
                'Custom egress',
                'Custom storage',
                'Custom events',
                'Custom trace retention',
                'Custom projects',
              ]}
            >
              <Button>Book a call</Button>
            </PlanColumn>
          </div>
          <div className="flex flex-col gap-0.5 px-4">
            <Txt as="p" variant="caption" tone="muted">
              Prices per workspace, each month. Compute allowances are shared by Serverless projects and sandboxes.
            </Txt>
            <Txt as="p" variant="caption" tone="muted">
              Beyond allowances: memory $0.05 / GB-hour, vCPU $0.10 / vCPU-hour, egress $0.10 / GB, events $10 / 100K,
              storage $10 / GB per project.
            </Txt>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  ),
};

function AmountField({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <InputGroup size="sm" className={className}>
      <InputGroupAddon>$</InputGroupAddon>
      <InputGroupInput aria-label={label} inputMode="numeric" defaultValue={value} />
    </InputGroup>
  );
}

const BALANCE_BEFORE = 3.8;

function AddCreditsDialog() {
  const [amount, setAmount] = useState('25');
  const [autoTopUp, setAutoTopUp] = useState(true);
  const balanceAfter = BALANCE_BEFORE + (Number(amount) || 0);
  return (
    <Dialog>
      <DialogTrigger render={<Button>Add credits</Button>} />
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Add credits</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <SettingsContainer variant="inset">
            <SettingsRow label="Credits to purchase" description="$1.20 went to vCPU beyond your allowance this month.">
              <InputGroup size="sm" className="w-30">
                <InputGroupAddon>$</InputGroupAddon>
                <InputGroupInput
                  aria-label="Credits to purchase"
                  inputMode="numeric"
                  value={amount}
                  onChange={event => setAmount(event.target.value)}
                />
              </InputGroup>
            </SettingsRow>
            <SettingsRow
              label="Automatically top up"
              description="Keeps workloads funded before the balance reaches zero."
            >
              <div className="flex items-center gap-2">
                <Badge variant="success" emphasis="subtle" size="sm">
                  Recommended
                </Badge>
                <Switch checked={autoTopUp} onCheckedChange={setAutoTopUp} aria-label="Automatically top up" />
              </div>
            </SettingsRow>
            <SettingsFieldsetRow label="Top up to">
              <div className="flex items-center gap-2">
                <AmountField label="Top up to" value="25" className="w-20" />
                <Txt as="span" variant="body-sm" tone="muted">
                  when my balance reaches
                </Txt>
                <AmountField label="When my balance reaches" value="5" className="w-18" />
              </div>
            </SettingsFieldsetRow>
          </SettingsContainer>
        </DialogBody>
        <DialogFooter>
          <Txt as="p" variant="body-sm" tone="muted" className="mr-auto" aria-live="polite">
            Balance after{' '}
            <Txt as="span" variant="label" tone="ink" className="tabular-nums">
              {formatCost(balanceAfter)}
            </Txt>
          </Txt>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction onConfirm={() => {}}>Continue</DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const AddCredits: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A short form dialog, and the one place the inset `SettingsContainer` is meant for: title and Close in the header, stacked settings rows on an inset panel in the body (an amount field, a switch with a badge, and a sentence of two small fields), and a footer whose status sits left of Cancel and the primary action.',
      },
    },
  },
  render: () => <AddCreditsDialog />,
};

export const ResizeWhileOpen: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Open either dialog at 1440 × 1000, resize to 390 × 844, then back. It stays open and usable across 640px. The form keeps its draft in the caller while the popup changes from dialog to drawer.',
      },
    },
  },
  render: args => (
    <div className="flex flex-wrap items-start gap-4">
      <PlaygroundDialog {...args} size="full" />
      <RenameForm />
    </div>
  ),
  play: async ({ canvas, userEvent, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }));
    await waitFor(() => expect(page.getByRole('dialog', { name: 'Edit agent instructions' })).toBeVisible());
    await userEvent.click(page.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Rename team' }));
    await userEvent.clear(page.getByRole('textbox', { name: /Team name/ }));
    await userEvent.type(page.getByRole('textbox', { name: /Team name/ }), 'Billing team');
    await userEvent.click(page.getByRole('button', { name: 'Save name' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('Team renamed to Billing team.');
  },
};
