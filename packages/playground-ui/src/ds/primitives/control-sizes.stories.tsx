import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { Combobox } from '@/ds/components/Combobox';
import { Input } from '@/ds/components/Input';
import {
  InputNumber,
  InputNumberDecrement,
  InputNumberGroup,
  InputNumberIncrement,
  InputNumberInput,
} from '@/ds/components/InputNumber';
import { SegmentedControl, SegmentedControlItem } from '@/ds/components/SegmentedControl';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { Tab, TabList, Tabs } from '@/ds/components/Tabs';
import type { TabListProps, TabListSize } from '@/ds/components/Tabs';
import { Txt } from '@/ds/components/Txt';
import type { ControlSize } from '@/ds/primitives/control-size';

/**
 * Every control that takes the shared control rung (`h-control-*`), one row per size. A row's
 * controls share one height, so any of them can sit side by side in a toolbar or a form row.
 * The dashed lines mark the row's top and bottom: a control that misses them is off the rung.
 */
const meta: Meta = {
  title: 'Foundations/Control sizes',
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj;

const SIZES: ControlSize[] = ['sm', 'md', 'lg'];
const HEIGHTS: Record<ControlSize, string> = { sm: '28px', md: '30px', lg: '32px' };
const frameworks = [
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue' },
];

type TabListVariant = NonNullable<TabListProps['variant']>;

const isTabSize = (size: ControlSize): size is TabListSize => size !== 'lg';

function Permission({ size }: { size: ControlSize }) {
  const [value, setValue] = useState('ask');
  return (
    <SegmentedControl aria-label={`Permission ${size}`} size={size} value={value} onValueChange={setValue}>
      <SegmentedControlItem value="allow">Allow</SegmentedControlItem>
      <SegmentedControlItem value="ask">Ask</SegmentedControlItem>
    </SegmentedControl>
  );
}

function SizeTabs({ size, variant }: { size: ControlSize; variant: TabListVariant }) {
  if (!isTabSize(size)) {
    return (
      <Txt as="span" variant="meta" tone="faint">
        no {size} tabs
      </Txt>
    );
  }
  return (
    <Tabs defaultTab="overview">
      <TabList variant={variant} size={size}>
        <Tab value="overview">Overview</Tab>
        <Tab value="logs">Logs</Tab>
      </TabList>
    </Tabs>
  );
}

/** One size's controls between two guide lines at that rung's top and bottom. */
function Row({ size, children }: { size: ControlSize; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[4rem_1fr] items-center gap-4">
      <Txt as="span" variant="meta" tone="muted" className="tabular-nums">
        {size} · {HEIGHTS[size]}
      </Txt>
      <div className="relative flex flex-wrap items-center gap-3 border-y border-dashed border-border">{children}</div>
    </div>
  );
}

export const SideBySide: Story = {
  render: () => (
    <div className="grid gap-8">
      {SIZES.map(size => (
        <Row key={size} size={size}>
          <Button size={size}>Button</Button>
          <Button size={size} variant="ghost">
            Ghost
          </Button>
          <ButtonsGroup size={size}>
            <Button>Day</Button>
            <Button>Week</Button>
          </ButtonsGroup>
          <Input size={size} placeholder="Input" className="w-32" />
          <Select>
            <SelectTrigger size={size} className="w-32">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a">Option A</SelectItem>
              <SelectItem value="b">Option B</SelectItem>
            </SelectContent>
          </Select>
          <Combobox size={size} options={frameworks} placeholder="Combobox" className="w-36" />
          <InputNumber defaultValue={3} className="w-28">
            <InputNumberGroup size={size}>
              <InputNumberDecrement />
              <InputNumberInput aria-label={`Quantity ${size}`} />
              <InputNumberIncrement />
            </InputNumberGroup>
          </InputNumber>
          <Permission size={size} />
          <SizeTabs size={size} variant="pill" />
          <SizeTabs size={size} variant="pill-ghost" />
        </Row>
      ))}
    </div>
  ),
};
