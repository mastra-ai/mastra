import { Field as FieldPrimitive } from '@base-ui/react/field';
import { Fieldset as FieldsetPrimitive } from '@base-ui/react/fieldset';
import { CircleAlertIcon } from 'lucide-react';
import * as React from 'react';

import { FieldAriaContext, useFieldAriaIds } from './field-control-aria';
import { Icon } from '@/ds/icons/Icon';
import { cn } from '@/lib/utils';

type FieldProps = Omit<FieldPrimitive.Root.Props, 'className'> & {
  className?: string;
  orientation?: 'vertical' | 'horizontal';
};

const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  ({ className, orientation = 'vertical', invalid = false, ...props }, ref) => {
    const id = React.useId();
    const ariaIds = React.useMemo(() => ({ labelId: `${id}-label`, errorId: `${id}-error`, invalid }), [id, invalid]);

    return (
      <FieldAriaContext.Provider value={ariaIds}>
        <FieldPrimitive.Root
          ref={ref}
          invalid={invalid}
          data-slot="field"
          data-orientation={orientation}
          className={cn(
            'min-w-0 text-foreground',
            orientation === 'vertical' ? 'grid gap-2' : 'flex items-baseline gap-3',
            className,
          )}
          {...props}
        />
      </FieldAriaContext.Provider>
    );
  },
);
Field.displayName = 'Field';

type FieldContentProps = React.ComponentPropsWithoutRef<'div'>;

const FieldContent = React.forwardRef<HTMLDivElement, FieldContentProps>(({ className, ...props }, ref) => (
  <div ref={ref} data-slot="field-content" className={cn('grid min-w-0 flex-1 gap-2', className)} {...props} />
));
FieldContent.displayName = 'FieldContent';

type FieldItemProps = Omit<FieldPrimitive.Item.Props, 'className'> & {
  className?: string;
};

const FieldItem = React.forwardRef<HTMLDivElement, FieldItemProps>(({ className, ...props }, ref) => {
  const isInsideField = useFieldAriaIds() !== null;
  const ItemScope = isInsideField ? FieldPrimitive.Item : FieldPrimitive.Root;

  return (
    <FieldAriaContext.Provider value={null}>
      <ItemScope
        ref={ref}
        data-slot="field-item"
        className={cn('flex min-w-0 items-center gap-2', className)}
        {...props}
      />
    </FieldAriaContext.Provider>
  );
});
FieldItem.displayName = 'FieldItem';

type FieldLabelProps = Omit<FieldPrimitive.Label.Props, 'className' | 'id'> & {
  className?: string;
  required?: boolean;
  size?: 'default' | 'bigger';
};

const FieldLabel = React.forwardRef<HTMLLabelElement, FieldLabelProps>(
  ({ className, required = false, size = 'default', children, ...props }, ref) => {
    const field = useFieldAriaIds();

    return (
      <FieldPrimitive.Label
        ref={ref}
        id={field?.labelId}
        data-slot="field-label"
        className={cn(
          'inline-flex shrink-0 items-center text-label text-foreground data-disabled:text-muted-foreground',
          size === 'bigger' && 'text-body',
          className,
        )}
        {...props}
      >
        {children}
        {required ? (
          <>
            <span aria-hidden className="ml-0.5 text-destructive in-data-disabled:text-muted-foreground">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </FieldPrimitive.Label>
    );
  },
);
FieldLabel.displayName = 'FieldLabel';

type FieldDescriptionProps = Omit<FieldPrimitive.Description.Props, 'className'> & {
  className?: string;
};

const FieldDescription = React.forwardRef<HTMLParagraphElement, FieldDescriptionProps>(
  ({ className, ...props }, ref) => (
    <FieldPrimitive.Description
      ref={ref}
      data-slot="field-description"
      className={cn('-mt-1 text-caption text-muted-foreground', className)}
      {...props}
    />
  ),
);
FieldDescription.displayName = 'FieldDescription';

type FieldErrorProps = Omit<FieldPrimitive.Error.Props, 'className' | 'match' | 'id'> & {
  className?: string;
};

const FieldError = React.forwardRef<HTMLDivElement, FieldErrorProps>(({ className, children, ...props }, ref) => {
  const field = useFieldAriaIds();
  if (!children) return null;

  return (
    <FieldPrimitive.Error
      ref={ref}
      id={field?.errorId}
      match
      role="alert"
      data-slot="field-error"
      className={cn('-mt-1 flex gap-1 text-caption text-destructive', className)}
      {...props}
    >
      <Icon size="xs" className="mt-0.75 shrink-0" aria-hidden>
        <CircleAlertIcon />
      </Icon>
      <span className="min-w-0">{children}</span>
    </FieldPrimitive.Error>
  );
});
FieldError.displayName = 'FieldError';

type FieldsetProps = Omit<FieldsetPrimitive.Root.Props, 'className'> & {
  className?: string;
};

const Fieldset = React.forwardRef<HTMLFieldSetElement, FieldsetProps>(({ className, ...props }, ref) => (
  <FieldsetPrimitive.Root
    ref={ref}
    data-slot="fieldset"
    className={cn('m-0 grid min-w-0 gap-3 border-0 p-0', className)}
    {...props}
  />
));
Fieldset.displayName = 'Fieldset';

type FieldsetLegendProps = Omit<FieldsetPrimitive.Legend.Props, 'className'> & {
  className?: string;
};

const FieldsetLegend = React.forwardRef<HTMLDivElement, FieldsetLegendProps>(({ className, ...props }, ref) => (
  <FieldsetPrimitive.Legend
    ref={ref}
    data-slot="fieldset-legend"
    className={cn('text-label text-foreground data-disabled:text-muted-foreground', className)}
    {...props}
  />
));
FieldsetLegend.displayName = 'FieldsetLegend';

export { Field, FieldContent, FieldItem, FieldLabel, FieldDescription, FieldError, Fieldset, FieldsetLegend };
export type {
  FieldProps,
  FieldContentProps,
  FieldItemProps,
  FieldLabelProps,
  FieldDescriptionProps,
  FieldErrorProps,
  FieldsetProps,
  FieldsetLegendProps,
};
