import { NumberField as NumberFieldPrimitive } from '@base-ui/react/number-field';
import * as React from 'react';

import { buttonVariants } from '@/ds/components/Button/Button';
import {
  inputGroupClassName,
  inputGroupControlClassName,
  inputGroupIconButtonBySize,
} from '@/ds/components/InputGroup/input-group';
import { IconMinusMedium } from '@/ds/icons/central/IconMinusMedium';
import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';
import { Icon } from '@/ds/icons/Icon';
import { ControlSizeContext, controlHeight, controlSpacing } from '@/ds/primitives/control-size';
import type { ControlSize } from '@/ds/primitives/control-size';
import { textFieldAutofillProps } from '@/ds/primitives/password-manager-autofill';
import { cn } from '@/lib/utils';

type InputNumberProps = Omit<NumberFieldPrimitive.Root.Props, 'className'> & {
  className?: string;
};

function InputNumber({ className, ...props }: InputNumberProps) {
  return <NumberFieldPrimitive.Root data-slot="input-number" className={cn('w-full', className)} {...props} />;
}

// From the field's edge to a stepper's box, so its icon's ink starts 12px in, like the text (`px-3`).
const stepperInset: Record<ControlSize, string> = {
  sm: '[--stepper-inset:7px]',
  md: '[--stepper-inset:6px]',
  lg: '[--stepper-inset:5px]',
};

type InputNumberGroupProps = Omit<NumberFieldPrimitive.Group.Props, 'className'> & {
  className?: string;
  size?: ControlSize;
};

function InputNumberGroup({ className, size, ...props }: InputNumberGroupProps) {
  const groupSize = React.useContext(ControlSizeContext);
  const resolved = groupSize ?? size ?? 'md';
  return (
    <NumberFieldPrimitive.Group
      data-slot="input-number-group"
      data-size={resolved}
      className={cn(
        inputGroupClassName,
        controlHeight[resolved],
        controlSpacing[resolved],
        'has-[>[data-slot=input-number-decrement]]:[&>[data-slot=input-group-control]]:pl-0',
        'has-[>[data-slot=input-number-increment]]:[&>[data-slot=input-group-control]]:pr-0',
        stepperInset[resolved],
        '[&>[data-slot=input-number-decrement]]:mr-(--control-gap) [&>[data-slot=input-number-decrement]]:ml-(--stepper-inset)',
        '[&>[data-slot=input-number-increment]]:mr-(--stepper-inset) [&>[data-slot=input-number-increment]]:ml-(--control-gap)',
        '[&>[data-slot=input-group-addon]:has(>[data-slot=input-number-increment])]:pr-(--stepper-inset)',
        className,
      )}
      {...props}
    />
  );
}

type InputNumberInputProps = Omit<NumberFieldPrimitive.Input.Props, 'className'> & {
  className?: string;
};

function InputNumberInput({ className, autoComplete, ...props }: InputNumberInputProps) {
  return (
    <NumberFieldPrimitive.Input
      // The InputGroup slot gives it the addon spacing and click-to-focus of any other field.
      data-slot="input-group-control"
      className={cn(inputGroupControlClassName, className)}
      {...props}
      {...textFieldAutofillProps(autoComplete)}
    />
  );
}

const inputNumberButtonClassName = cn(
  buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
  inputGroupIconButtonBySize,
  // The chip is small: its hit area is the field's height and 24px wide, larger for a finger.
  "relative before:absolute before:-inset-x-0.75 before:-inset-y-1.25 before:content-['']",
  'pointer-coarse:before:-inset-1.75',
);

// Two steppers side by side in an addon read as one pair, closer than the addon's own gap.
const inputNumberPairClassName =
  '[[data-variant=default]>[data-slot=input-number-decrement]+&]:-ml-1 [[data-variant=default]>[data-slot=input-number-decrement]+&]:pointer-coarse:ml-1';

type InputNumberDecrementProps = Omit<NumberFieldPrimitive.Decrement.Props, 'className'> & {
  className?: string;
};

function InputNumberDecrement({ className, children, ...props }: InputNumberDecrementProps) {
  return (
    <NumberFieldPrimitive.Decrement
      data-slot="input-number-decrement"
      data-shape="icon"
      className={cn(inputNumberButtonClassName, className)}
      {...props}
    >
      <Icon size="sm">{children ?? <IconMinusMedium />}</Icon>
    </NumberFieldPrimitive.Decrement>
  );
}

type InputNumberIncrementProps = Omit<NumberFieldPrimitive.Increment.Props, 'className'> & {
  className?: string;
};

function InputNumberIncrement({ className, children, ...props }: InputNumberIncrementProps) {
  return (
    <NumberFieldPrimitive.Increment
      data-slot="input-number-increment"
      data-shape="icon"
      className={cn(inputNumberButtonClassName, inputNumberPairClassName, className)}
      {...props}
    >
      <Icon size="sm">{children ?? <IconPlusMedium />}</Icon>
    </NumberFieldPrimitive.Increment>
  );
}

export { InputNumber, InputNumberGroup, InputNumberInput, InputNumberDecrement, InputNumberIncrement };
export type {
  InputNumberProps,
  InputNumberGroupProps,
  InputNumberInputProps,
  InputNumberDecrementProps,
  InputNumberIncrementProps,
};
