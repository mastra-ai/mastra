import type { Meta, StoryObj } from '@storybook/react-vite';
import { Field, FieldDescription, FieldError, FieldLabel } from '../Field';
import { Input } from '../Input';
import { InputGroupAddon, InputGroupText } from '../InputGroup';
import {
  InputNumber,
  InputNumberDecrement,
  InputNumberGroup,
  InputNumberIncrement,
  InputNumberInput,
} from './input-number';
import type { ControlSize } from '@/ds/primitives/control-size';

const meta: Meta<typeof InputNumber> = {
  title: 'Composite/InputNumber',
  component: InputNumber,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof InputNumber>;

export const Default: Story = {
  render: () => (
    <div className="w-60">
      <InputNumber defaultValue={3}>
        <InputNumberGroup>
          <InputNumberDecrement />
          <InputNumberInput aria-label="Quantity" />
          <InputNumberIncrement />
        </InputNumberGroup>
      </InputNumber>
    </div>
  ),
};

export const WithField: Story = {
  render: () => (
    <div className="w-80">
      <Field>
        <FieldLabel>Max retries</FieldLabel>
        <InputNumber defaultValue={3} min={0}>
          <InputNumberGroup>
            <InputNumberDecrement />
            <InputNumberInput />
            <InputNumberIncrement />
          </InputNumberGroup>
        </InputNumber>
        <FieldDescription>How many times a failed step runs again.</FieldDescription>
      </Field>
    </div>
  ),
};

export const FlushTrailingSteppers: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Use the flush addon variant to join trailing stepper buttons at the field edge. Add a margin to separate the unit label from the buttons.',
      },
    },
  },
  render: () => (
    <div className="w-64">
      <InputNumber defaultValue={30000} min={1} step={1000} format={{ maximumFractionDigits: 0 }}>
        <InputNumberGroup size="sm">
          <InputNumberInput aria-label="Observation threshold" />
          <InputGroupAddon align="inline-end" variant="flush">
            <InputGroupText className="mr-2">tokens</InputGroupText>
            <InputNumberDecrement />
            <InputNumberIncrement />
          </InputGroupAddon>
        </InputNumberGroup>
      </InputNumber>
    </div>
  ),
};

export const MinMaxStep: Story = {
  render: () => (
    <div className="w-80">
      <Field>
        <FieldLabel>Temperature</FieldLabel>
        <InputNumber defaultValue={0.7} min={0} max={2} step={0.1}>
          <InputNumberGroup>
            <InputNumberDecrement />
            <InputNumberInput />
            <InputNumberIncrement />
          </InputNumberGroup>
        </InputNumber>
        <FieldDescription>Between 0 and 2, in steps of 0.1.</FieldDescription>
      </Field>
    </div>
  ),
};

const sizes: ControlSize[] = ['sm', 'md', 'lg'];

export const Sizes: Story = {
  render: () => (
    <div className="flex w-120 flex-col gap-3">
      {sizes.map(size => (
        <div key={size} className="flex items-center gap-2">
          <InputNumber defaultValue={10}>
            <InputNumberGroup size={size}>
              <InputNumberDecrement />
              <InputNumberInput aria-label={`Input number ${size}`} />
              <InputNumberIncrement />
            </InputNumberGroup>
          </InputNumber>
          <Input size={size} aria-label={`Input ${size}`} placeholder={`Input ${size}`} />
        </div>
      ))}
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="w-80">
      <Field disabled>
        <FieldLabel>Max retries</FieldLabel>
        <InputNumber defaultValue={3}>
          <InputNumberGroup>
            <InputNumberDecrement />
            <InputNumberInput />
            <InputNumberIncrement />
          </InputNumberGroup>
        </InputNumber>
      </Field>
    </div>
  ),
};

export const Invalid: Story = {
  render: () => (
    <div className="w-80">
      <Field invalid>
        <FieldLabel>Max retries</FieldLabel>
        <InputNumber defaultValue={-1}>
          <InputNumberGroup>
            <InputNumberDecrement />
            <InputNumberInput />
            <InputNumberIncrement />
          </InputNumberGroup>
        </InputNumber>
        <FieldError>Must be 0 or more.</FieldError>
      </Field>
    </div>
  ),
};
