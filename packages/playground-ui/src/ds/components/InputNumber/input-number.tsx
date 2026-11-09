import { NumberField as NumberFieldPrimitive } from '@base-ui/react/number-field';
import { MinusIcon, PlusIcon } from 'lucide-react';
import * as React from 'react';

import { buttonVariants } from '@/ds/components/Button/Button';
import { inputGroupClassName, inputGroupControlClassName } from '@/ds/components/InputGroup/input-group';
import { Icon } from '@/ds/icons/Icon';
import { ControlSizeContext, controlHeight } from '@/ds/primitives/control-size';
import type { ControlSize } from '@/ds/primitives/control-size';
import { textFieldAutofillProps } from '@/ds/primitives/password-manager-autofill';
import { cn } from '@/lib/utils';

type InputNumberProps = Omit<NumberFieldPrimitive.Root.Props, 'className'> & {
  className?: string;
};

function InputNumber({ className, ...props }: InputNumberProps) {
  return <NumberFieldPrimitive.Root data-slot="input-number" className={cn('w-full', className)} {...props} />;
}

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
        'has-[>[data-slot=input-number-decrement]]:[&>[data-slot=input-number-input]]:pl-0',
        'has-[>[data-slot=input-number-increment]]:[&>[data-slot=input-number-input]]:pr-0',
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
      data-slot="input-number-input"
      className={cn(inputGroupControlClassName, className)}
      {...props}
      {...textFieldAutofillProps(autoComplete)}
    />
  );
}

const inputNumberButtonClassName = cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'mx-1 shrink-0');

type InputNumberDecrementProps = Omit<NumberFieldPrimitive.Decrement.Props, 'className'> & {
  className?: string;
};

function InputNumberDecrement({ className, children, ...props }: InputNumberDecrementProps) {
  return (
    <NumberFieldPrimitive.Decrement
      data-slot="input-number-decrement"
      className={cn(inputNumberButtonClassName, className)}
      {...props}
    >
      <Icon size="sm">{children ?? <MinusIcon />}</Icon>
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
      className={cn(inputNumberButtonClassName, className)}
      {...props}
    >
      <Icon size="sm">{children ?? <PlusIcon />}</Icon>
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
