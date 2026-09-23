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
import {
  FieldBlocksLayout,
  SelectFieldBlock,
  TextareaFieldBlock,
  TextFieldBlock,
} from '@/ds/components/FormFieldBlocks';
import { Txt } from '@/ds/components/Txt';
import { dialogSurfaceStyle } from '@/ds/primitives/raised-surface';

const regions = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'eu-west-1', label: 'EU West (Ireland)' },
];

function Fields({ id }: { id: string }) {
  const [region, setRegion] = useState('us-east-1');
  const [owner, setOwner] = useState('');
  const [date, setDate] = useState<Date | undefined>();
  return (
    <FieldBlocksLayout>
      <TextFieldBlock
        name={`${id}-api-key`}
        label="API key"
        required
        placeholder="Paste your API key"
        errorMsg="API key is required"
      />
      <TextFieldBlock name={`${id}-account`} label="Account name" defaultValue="contoso-eu-west-production-tenant" />
      <SelectFieldBlock
        name={`${id}-region`}
        label="Region"
        value={region}
        onValueChange={setRegion}
        options={regions}
      />
      <Combobox
        options={[
          { value: 'platform', label: 'Platform team' },
          { value: 'studio', label: 'Studio team' },
        ]}
        value={owner}
        onValueChange={setOwner}
        placeholder="Choose an owner"
        error="Choose an owner"
      />
      <DateTimePicker value={date} onValueChange={setDate} placeholder="Pick an expiry date" />
      <TextareaFieldBlock name={`${id}-notes`} label="Notes" placeholder="Optional" />
      <TextFieldBlock name={`${id}-token`} label="Legacy token" disabled defaultValue="sk-legacy-disabled" />
    </FieldBlocksLayout>
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
        <Fields id="page" />
      </Column>
      <Column title="Card">
        <Card className="p-5">
          <Fields id="card" />
        </Card>
      </Column>
      <Column title="Dialog">
        <div className={`${dialogSurfaceStyle} rounded-xl p-5`}>
          <Fields id="dialog" />
        </div>
      </Column>
    </div>
  ),
};

export const InDialog: Story = {
  render: () => (
    <div className="min-h-dvh bg-background p-8">
      <Dialog variant="new" defaultOpen>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect Anthropic</DialogTitle>
            <DialogDescription>Enter the details required to finish setting up this connection.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Fields id="modal" />
          </DialogBody>
          <DialogFooter>
            <Button variant="default">Back</Button>
            <Button variant="primary">Connect Anthropic</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  ),
};
