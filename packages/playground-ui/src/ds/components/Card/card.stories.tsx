import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from '../Badge';
import { Button } from '../Button';
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
} from '../Dialog';
import { Switch } from '../Switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardIllustration,
  CardInset,
  CardLink,
  CardTitle,
} from './Card';
import { SettingsRow } from '@/ds/new/settings';
import { cn } from '@/lib/utils';

const meta: Meta<typeof Card> = {
  title: 'Layout/Card',
  component: Card,
  parameters: { layout: 'centered' },
  args: {
    elevation: 'raised',
    interactive: false,
  },
  argTypes: {
    elevation: { control: 'inline-radio', options: ['flat', 'raised'] },
    interactive: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: args => (
    <Card {...args} className="w-[min(24rem,calc(100vw-2rem))]">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Research agent</CardTitle>
          <Badge variant="success">Active</Badge>
        </div>
        <CardDescription>Searches trusted sources and returns a cited summary.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-caption text-muted-foreground">Last run completed 4 minutes ago with 12 sources.</p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="primary">Open agent</Button>
        <Button variant="ghost">Configure</Button>
      </CardFooter>
    </Card>
  ),
};

export const Elevation: Story = {
  render: () => (
    <div className="grid w-[min(44rem,calc(100vw-2rem))] grid-cols-1 gap-5 sm:grid-cols-2">
      {(['flat', 'raised'] as const).map(elevation => (
        <Card key={elevation} elevation={elevation}>
          <CardHeader>
            <CardTitle className="capitalize">{elevation}</CardTitle>
            <CardDescription>
              {elevation === 'raised' ? 'Rim and shadow from shadow-raised' : 'Nested inside another raised surface'}
            </CardDescription>
          </CardHeader>
          <CardContent density="compact">
            <p className="text-caption text-muted-foreground">Card content</p>
          </CardContent>
        </Card>
      ))}
    </div>
  ),
};

export const InteractiveLinks: Story = {
  render: () => (
    <div className="grid w-[min(24rem,calc(100vw-2rem))] gap-3">
      <Card interactive onClick={() => undefined}>
        <CardContent>
          <CardTitle>Button card</CardTitle>
          <CardDescription className="mt-1">Keyboard-focusable and pressable.</CardDescription>
        </CardContent>
      </Card>
      <CardLink href="#agent" onClick={event => event.preventDefault()}>
        <CardContent>
          <CardTitle>Link card</CardTitle>
          <CardDescription className="mt-1">Keeps native link semantics.</CardDescription>
        </CardContent>
      </CardLink>
    </div>
  ),
};

const illustrativeErrorRates = [0.2, 0.3, 0.7, 0.15];
const errorRateThreshold = 0.5;
const illustrativeSpend = { today: 182, budget: 150, scale: 200 };

function ErrorRates() {
  return (
    <span className="relative flex h-14 w-56 items-end justify-center gap-4">
      {illustrativeErrorRates.map((rate, index) => (
        <span key={index} className="flex h-full w-2.5 items-end overflow-hidden rounded-xs bg-border">
          <span
            data-emphasis={rate > errorRateThreshold ? 'grow-y' : undefined}
            className={cn('w-full', rate > errorRateThreshold ? 'bg-(--illustration-accent)' : 'bg-muted-foreground')}
            style={{ height: `${rate * 100}%` }}
          />
        </span>
      ))}
      <span
        className="absolute inset-x-0 border-t-2 border-foreground"
        style={{ bottom: `${errorRateThreshold * 100}%` }}
      />
    </span>
  );
}

function DailySpend() {
  const { today, budget, scale } = illustrativeSpend;
  return (
    <span className="relative flex h-14 w-56 items-center">
      <span className="relative h-2.5 w-full rounded-full bg-border">
        <span
          className="absolute inset-y-0 left-0 rounded-l-full bg-muted-foreground"
          style={{ width: `${(budget / scale) * 100}%` }}
        />
        <span
          data-emphasis="grow-x"
          className="absolute inset-y-0 rounded-r-full bg-(--illustration-accent)"
          style={{ left: `${(budget / scale) * 100}%`, width: `${((today - budget) / scale) * 100}%` }}
        />
      </span>
      <span
        className="absolute inset-y-2 border-l-2 border-foreground"
        style={{ left: `${(budget / scale) * 100}%` }}
      />
    </span>
  );
}

export const Illustrated: Story = {
  render: () => (
    <ul className="grid w-[min(44rem,calc(100vw-2rem))] gap-3 sm:grid-cols-2">
      <li className="min-w-0">
        <CardLink href="#error-rate" onClick={event => event.preventDefault()} className="block h-full">
          <CardContent className="flex flex-col gap-3">
            <CardIllustration>
              <ErrorRates />
            </CardIllustration>
            <span className="flex flex-col gap-0.5">
              <CardTitle>Agent error rate</CardTitle>
              <CardDescription>Any agent failing more than half of its runs.</CardDescription>
            </span>
          </CardContent>
        </CardLink>
      </li>
      <li className="min-w-0">
        <CardLink
          href="#daily-budget"
          aria-current="true"
          onClick={event => event.preventDefault()}
          className="block h-full"
        >
          <CardContent className="flex flex-col gap-3">
            <CardIllustration>
              <DailySpend />
            </CardIllustration>
            <span className="flex flex-col gap-0.5">
              <CardTitle>Daily cost budget</CardTitle>
              <CardDescription>Today's spend past a budget. This card is the current one.</CardDescription>
            </span>
          </CardContent>
        </CardLink>
      </li>
      <li className="min-w-0">
        <Card aria-disabled className="block h-full">
          <CardContent className="flex flex-col gap-3">
            <CardIllustration>
              <ErrorRates />
            </CardIllustration>
            <span className="flex flex-col gap-0.5">
              <CardTitle>Not available on this plan</CardTitle>
              <CardDescription>A plain card: no link, no hover.</CardDescription>
            </span>
          </CardContent>
        </Card>
      </li>
      <li className="min-w-0">
        <CardLink href="#long" onClick={event => event.preventDefault()} className="block h-full">
          <CardContent className="flex flex-col gap-3">
            <CardIllustration>
              <DailySpend />
            </CardIllustration>
            <span className="flex flex-col gap-0.5">
              <CardTitle>A much longer title that wraps onto a second line at narrow widths</CardTitle>
              <CardDescription>
                A long description wraps below its title, and the plate above it keeps the same size as every other card
                in the set.
              </CardDescription>
            </span>
          </CardContent>
        </CardLink>
      </li>
    </ul>
  ),
};

export const IllustratedStates: Story = {
  render: () => (
    <ul className="grid w-[min(44rem,calc(100vw-2rem))] gap-3 sm:grid-cols-2">
      <li className="min-w-0">
        <CardLink
          href="#flat-current"
          elevation="flat"
          aria-current="true"
          onClick={event => event.preventDefault()}
          className="block h-full"
        >
          <CardContent className="flex flex-col gap-3">
            <CardIllustration>
              <DailySpend />
            </CardIllustration>
            <span className="flex flex-col gap-0.5">
              <CardTitle>Flat and current</CardTitle>
              <CardDescription>A flat card has no rim, so the current one gets an outline.</CardDescription>
            </span>
          </CardContent>
        </CardLink>
      </li>
      <li className="min-w-0">
        <CardLink
          href="#aria-disabled"
          aria-disabled="true"
          onClick={event => event.preventDefault()}
          className="block h-full"
        >
          <CardContent className="flex flex-col gap-3">
            <CardIllustration>
              <DailySpend />
            </CardIllustration>
            <span className="flex flex-col gap-0.5">
              <CardTitle>Marked aria-disabled</CardTitle>
              <CardDescription>No hover wash and no motion in the drawing.</CardDescription>
            </span>
          </CardContent>
        </CardLink>
      </li>
    </ul>
  ),
};

export const IllustrationTones: Story = {
  render: () => (
    <ul className="grid w-[min(44rem,calc(100vw-2rem))] gap-3 sm:grid-cols-2">
      {(['destructive', 'warning', 'info', 'success'] as const).map(tone => (
        <li key={tone} className="min-w-0">
          <CardLink href={`#${tone}`} onClick={event => event.preventDefault()} className="block h-full">
            <CardContent className="flex flex-col gap-3">
              <CardIllustration tone={tone}>
                <DailySpend />
              </CardIllustration>
              <span className="flex flex-col gap-0.5">
                <CardTitle className="capitalize">{tone}</CardTitle>
                <CardDescription>The tagged part takes the tone's indicator color.</CardDescription>
              </span>
            </CardContent>
          </CardLink>
        </li>
      ))}
    </ul>
  ),
};

const insetRows = [
  { label: 'Source', value: 'Acme Linear' },
  { label: 'Schedule', value: 'Daily at 03:00 UTC' },
  { label: 'Enrich pages', description: 'Relates new pages to ones already in Knowledge', value: 'On' },
];

function InsetRows() {
  return (
    <CardInset>
      {insetRows.map(row => (
        <div key={row.label} className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-body-sm text-foreground">{row.label}</p>
            {row.description ? <p className="text-caption text-muted-foreground">{row.description}</p> : null}
          </div>
          <span className="shrink-0 text-body-sm text-muted-foreground">{row.value}</span>
        </div>
      ))}
    </CardInset>
  );
}

export const Inset: Story = {
  render: args => (
    <Card {...args} className="w-[min(32rem,calc(100vw-2rem))]">
      <CardHeader className="pt-3">
        <CardTitle>Importer</CardTitle>
        <CardDescription>Syncs a connection's documents into Knowledge as pages your agents can read.</CardDescription>
      </CardHeader>
      <CardContent>
        <InsetRows />
      </CardContent>
    </Card>
  ),
};

export const InsetInDialog: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogTrigger render={<Button>Add importer</Button>} />
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Add importer</DialogTitle>
          <DialogDescription>
            Syncs a connection's documents into Knowledge as pages your agents can read.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <CardInset>
            <SettingsRow label="Source" description="The connection to read documents from." viewOnly>
              Acme Linear
            </SettingsRow>
            <SettingsRow label="Enrich pages" description="Relates new pages to ones already in Knowledge.">
              <Switch defaultChecked />
            </SettingsRow>
          </CardInset>
        </DialogBody>
        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction onConfirm={() => {}}>Add importer</DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
