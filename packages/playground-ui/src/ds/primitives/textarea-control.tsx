import { Field as FieldPrimitive } from '@base-ui/react/field';
import { mergeProps } from '@base-ui/react/merge-props';
import type * as React from 'react';

import { keepOwnAccessibleName } from '@/ds/components/Field/field-control-aria';
import { textFieldAutofillProps } from '@/ds/primitives/password-manager-autofill';

export type TextareaControlProps = React.ComponentProps<'textarea'>;

export function TextareaControl({ id, name, disabled, ref, autoComplete, ...props }: TextareaControlProps) {
  return (
    <FieldPrimitive.Control
      ref={ref}
      id={id}
      name={name}
      disabled={disabled}
      render={controlProps => (
        <textarea
          {...mergeProps<'textarea'>(controlProps, {
            ...props,
            ...textFieldAutofillProps(autoComplete),
            ...keepOwnAccessibleName(props),
          })}
        />
      )}
    />
  );
}
