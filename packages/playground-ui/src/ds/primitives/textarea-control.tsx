import { Field as FieldPrimitive } from '@base-ui/react/field';
import { mergeProps } from '@base-ui/react/merge-props';
import * as React from 'react';

export type TextareaControlProps = React.ComponentPropsWithoutRef<'textarea'>;

export const TextareaControl = React.forwardRef<HTMLTextAreaElement, TextareaControlProps>(
  ({ id, name, disabled, ...props }, ref) => (
    <FieldPrimitive.Control
      ref={ref}
      id={id}
      name={name}
      disabled={disabled}
      render={controlProps => <textarea {...mergeProps<'textarea'>(controlProps, props)} />}
    />
  ),
);
TextareaControl.displayName = 'TextareaControl';
