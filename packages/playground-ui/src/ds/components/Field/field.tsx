import { Field as FieldPrimitive } from '@base-ui/react/field';
import { Fieldset as FieldsetPrimitive } from '@base-ui/react/fieldset';
import { CircleAlertIcon } from 'lucide-react';
import * as React from 'react';

import { FieldAriaContext, useFieldAriaIds } from './field-control-aria';
import { Icon } from '@/ds/icons/Icon';
import { cn } from '@/lib/utils';

type FieldProps = Omit<FieldPrimitive.Root.Props, 'className'> & {
  className?: string;
  orientation?: 'vertical' | 'horizontal' | 'responsive';
};

const orientationClassName = {
  vertical: 'grid gap-2',
  horizontal: 'flex items-center gap-2 has-[>[data-slot=field-label]:first-child]:justify-between',
  responsive: 'flex flex-col gap-2 sm:flex-row sm:items-center',
} satisfies Record<NonNullable<FieldProps['orientation']>, string>;

function Field({ className, orientation = 'vertical', invalid = false, ...props }: FieldProps) {
  const id = React.useId();
  const [hasDescription, setHasDescription] = React.useState(false);
  const ariaIds = React.useMemo(
    () => ({
      labelId: `${id}-label`,
      descriptionId: `${id}-description`,
      errorId: `${id}-error`,
      controlId: `${id}-control`,
      invalid,
      hasDescription,
      setHasDescription,
    }),
    [id, invalid, hasDescription],
  );

  return (
    <FieldAriaContext.Provider value={ariaIds}>
      <FieldPrimitive.Root
        invalid={invalid}
        data-slot="field"
        data-orientation={orientation}
        className={cn('min-w-0 text-foreground', orientationClassName[orientation], className)}
        {...props}
      />
    </FieldAriaContext.Provider>
  );
}

type FieldContentProps = React.ComponentProps<'div'>;

function FieldContent({ className, ...props }: FieldContentProps) {
  return <div data-slot="field-content" className={cn('grid min-w-0 flex-1 gap-2', className)} {...props} />;
}

type FieldItemProps = Omit<FieldPrimitive.Item.Props, 'className'> & {
  className?: string;
};

function FieldItem({ className, ...props }: FieldItemProps) {
  const isInsideField = useFieldAriaIds() !== null;
  const ItemScope = isInsideField ? FieldPrimitive.Item : FieldPrimitive.Root;

  return (
    <FieldAriaContext.Provider value={null}>
      <ItemScope data-slot="field-item" className={cn('flex min-w-0 items-center gap-2', className)} {...props} />
    </FieldAriaContext.Provider>
  );
}

type FieldLabelProps = Omit<FieldPrimitive.Label.Props, 'className' | 'id'> & {
  className?: string;
  required?: boolean;
  size?: 'smaller' | 'default' | 'bigger';
};

function FieldLabel({ className, required = false, size = 'default', children, onClick, ...props }: FieldLabelProps) {
  const field = useFieldAriaIds();

  const focusManualControl: FieldLabelProps['onClick'] = event => {
    onClick?.(event);
    if (!field || event.defaultPrevented) return;
    event.currentTarget.ownerDocument.getElementById(field.controlId)?.focus();
  };

  return (
    <FieldPrimitive.Label
      id={field?.labelId}
      data-slot="field-label"
      className={cn(
        'inline-flex shrink-0 items-center text-label text-foreground data-disabled:text-muted-foreground',
        'not-data-disabled:has-[[role=checkbox],[role=switch],[role=radio]]:cursor-pointer',
        'not-data-disabled:[:is([data-slot=field],[data-slot=field-item]):has(>[role=checkbox],>[role=switch],>[role=radio])_&]:cursor-pointer',
        'data-disabled:cursor-not-allowed',
        size === 'smaller' && 'text-column',
        size === 'bigger' && 'text-body',
        className,
      )}
      onClick={focusManualControl}
      {...props}
    >
      {children}
      {required ? (
        <>
          <span aria-hidden className="ml-0.5 text-destructive in-data-disabled:text-muted-foreground">
            *
          </span>{' '}
          <span className="sr-only">(required)</span>
        </>
      ) : null}
    </FieldPrimitive.Label>
  );
}

type FieldDescriptionProps = Omit<FieldPrimitive.Description.Props, 'className' | 'id'> & {
  className?: string;
};

function FieldDescription({ className, ...props }: FieldDescriptionProps) {
  const field = useFieldAriaIds();
  const setHasDescription = field?.setHasDescription;

  React.useEffect(() => {
    if (!setHasDescription) return;
    setHasDescription(true);
    return () => setHasDescription(false);
  }, [setHasDescription]);

  return (
    <FieldPrimitive.Description
      id={field?.descriptionId}
      data-slot="field-description"
      className={cn('-mt-1 text-caption text-muted-foreground', className)}
      {...props}
    />
  );
}

type FieldErrorProps = Omit<FieldPrimitive.Error.Props, 'className' | 'match' | 'id' | 'render'> & {
  className?: string;
};

const fieldErrorClassName = '-mt-1 flex gap-1 text-caption text-destructive';

function FieldErrorIcon() {
  return (
    <Icon size="xs" className="mt-0.75 shrink-0" aria-hidden>
      <CircleAlertIcon />
    </Icon>
  );
}

function FieldError({ className, children, ...props }: FieldErrorProps) {
  const field = useFieldAriaIds();

  if (children) {
    return (
      <FieldPrimitive.Error
        key="external"
        id={field?.errorId}
        match
        role="alert"
        data-slot="field-error"
        className={cn(fieldErrorClassName, className)}
        {...props}
      >
        <FieldErrorIcon />
        <span className="min-w-0">{children}</span>
      </FieldPrimitive.Error>
    );
  }

  return (
    <FieldPrimitive.Error
      key="native"
      id={field?.errorId}
      role="alert"
      data-slot="field-error"
      className={cn(fieldErrorClassName, className)}
      {...props}
      render={({ children: message, ...errorProps }) => (
        <div {...errorProps}>
          <FieldErrorIcon />
          <span className="min-w-0">{message}</span>
        </div>
      )}
    />
  );
}

type FieldsetProps = Omit<FieldsetPrimitive.Root.Props, 'className'> & {
  className?: string;
};

function Fieldset({ className, ...props }: FieldsetProps) {
  return (
    <FieldsetPrimitive.Root
      data-slot="fieldset"
      className={cn('m-0 grid min-w-0 gap-3 border-0 p-0', className)}
      {...props}
    />
  );
}

type FieldsetLegendProps = Omit<FieldsetPrimitive.Legend.Props, 'className'> & {
  className?: string;
};

function FieldsetLegend({ className, ...props }: FieldsetLegendProps) {
  return (
    <FieldsetPrimitive.Legend
      data-slot="fieldset-legend"
      className={cn('text-label text-foreground data-disabled:text-muted-foreground', className)}
      {...props}
    />
  );
}

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
