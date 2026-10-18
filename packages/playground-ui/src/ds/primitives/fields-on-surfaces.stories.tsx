import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '@/ds/components/Button';
import { Card } from '@/ds/components/Card';
import { Combobox } from '@/ds/components/Combobox';
import { DateTimePicker } from '@/ds/components/DateTimePicker';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ds/components/Dialog';
import { Field, FieldError, FieldLabel } from '@/ds/components/Field';
import { Input } from '@/ds/components/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { Textarea } from '@/ds/components/Textarea';
import { Txt } from '@/ds/components/Txt';
import { dialogSurfaceStyle } from '@/ds/primitives/raised-surface';

const regions = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'eu-west-1', label: 'EU West (Ireland)' },
];

function Fields() {
  const [region, setRegion] = useState('us-east-1');
  const [owner, setOwner] = useState('');
  const [date, setDate] = useState<Date | undefined>();
  return (
    <div className="grid gap-6">
      <Field invalid>
        <FieldLabel required>API key</FieldLabel>
        <Input required placeholder="Paste your API key" />
        <FieldError>API key is required</FieldError>
      </Field>
      <Field>
        <FieldLabel>Account name</FieldLabel>
        <Input defaultValue="contoso-eu-west-production-tenant" />
      </Field>
      <Field>
        <FieldLabel>Region</FieldLabel>
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger size="md">
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {regions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field invalid>
        <FieldLabel>Owner</FieldLabel>
        <Combobox
          options={[
            { value: 'platform', label: 'Platform team' },
            { value: 'studio', label: 'Studio team' },
          ]}
          value={owner}
          onValueChange={setOwner}
          placeholder="Choose an owner"
        />
        <FieldError>Choose an owner</FieldError>
      </Field>
      <DateTimePicker value={date} onValueChange={setDate} placeholder="Pick an expiry date" />
      <Field>
        <FieldLabel>Notes</FieldLabel>
        <Textarea placeholder="Optional" />
      </Field>
      <Field disabled>
        <FieldLabel>Legacy token</FieldLabel>
        <Input defaultValue="sk-legacy-disabled" />
      </Field>
    </div>
  );
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid content-start gap-3">
      <Txt as="h2" variant="column" tone="muted">
        {title}
      </Txt>
      {children}
    </section>
  );
}

const meta: Meta = {
  title: 'Foundations/Fields on surfaces',
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj;

export const EverySurface: Story = {
  render: () => (
    <div className="grid min-h-dvh gap-8 bg-background p-8 lg:grid-cols-3">
      <Column title="Page">
        <Fields />
      </Column>
      <Column title="Card">
        <Card className="p-5">
          <Fields />
        </Card>
      </Column>
      <Column title="Dialog">
        <div className={`${dialogSurfaceStyle} rounded-xl p-5`}>
          <Fields />
        </div>
      </Column>
    </div>
  ),
};

export const InDialog: Story = {
  render: () => (
    <div className="min-h-dvh bg-background p-8">
      <Dialog defaultOpen>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Anthropic</DialogTitle>
            <DialogDescription>Enter the details required to finish setting up this connection.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Fields />
          </DialogBody>
          <DialogFooter>
            <Button>Back</Button>
            <Button variant="primary">Connect Anthropic</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  ),
};
