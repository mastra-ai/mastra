import { LockKeyholeIcon } from 'lucide-react';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { Field, FieldDescription, FieldError, FieldLabel, Fieldset, FieldsetLegend } from '@/ds/components/Field';
import type { FieldProps, FieldsetProps } from '@/ds/components/Field';
import { cn } from '@/lib/utils';

export type SettingsRowProps = Omit<FieldProps, 'children' | 'invalid' | 'orientation'> & {
  label: ReactNode;
  description?: ReactNode;
  /** @deprecated The row's `Field` names the control it holds; drop `htmlFor` and the control's `id`. */
  htmlFor?: string;
  children?: ReactNode;
  tone?: 'default' | 'destructive';
  viewOnly?: boolean;
  required?: boolean;
  errorMsg?: ReactNode;
};

type SettingsRowLayoutProps = SettingsRowProps & {
  layout: 'factory' | 'section';
};

const factoryRowClassName = 'gap-2 px-4 py-3 sm:justify-between sm:gap-4';
const factoryRowSideControlWidthClassName = 'sm:[--field-shrink:0] sm:[--field-width:16rem]';
const factoryRowHeadingClassName = 'flex min-w-0 flex-col gap-0.5';

export function SettingsRowLayout({
  label,
  description,
  htmlFor,
  children,
  className,
  layout,
  tone = 'default',
  viewOnly = false,
  required = false,
  errorMsg,
  disabled,
  ...props
}: SettingsRowLayoutProps) {
  const isSectionLayout = layout === 'section';
  const control = viewOnly ? (
    <>
      <LockKeyholeIcon className="size-4 shrink-0" aria-hidden />
      <span className="sr-only">View only: </span>
      {children}
    </>
  ) : (
    children
  );

  return (
    <Field
      orientation="responsive"
      invalid={Boolean(errorMsg)}
      disabled={disabled || viewOnly}
      data-slot={isSectionLayout ? 'section-row' : 'settings-row'}
      className={cn(
        isSectionLayout
          ? 'grid min-w-0 gap-3 group-data-[variant=factory]/section:px-3 group-data-[variant=factory]/section:py-2 group-data-[variant=flat]/section:p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:group-data-[variant=default]/section:gap-4 sm:group-data-[variant=factory]/section:gap-4 sm:group-data-[variant=flat]/section:gap-6'
          : 'min-w-0',
        layout === 'factory' && factoryRowClassName,
        layout === 'factory' && factoryRowSideControlWidthClassName,
        className,
      )}
      {...props}
    >
      <div className={isSectionLayout ? 'min-w-0' : factoryRowHeadingClassName}>
        <FieldLabel
          {...(htmlFor ? { htmlFor } : {})}
          required={required}
          className={cn(tone === 'destructive' && 'text-destructive-foreground')}
        >
          {label}
        </FieldLabel>
        {description != null && (
          <FieldDescription
            render={isSectionLayout ? undefined : <div />}
            className={cn('mt-0', isSectionLayout ? 'mt-1 max-w-[62ch] text-pretty' : 'flex flex-col gap-0.5')}
          >
            {description}
          </FieldDescription>
        )}
        <FieldError className={cn('mt-0', isSectionLayout && 'mt-1')}>{errorMsg}</FieldError>
      </div>
      {children != null &&
        (isSectionLayout || viewOnly ? (
          <div
            data-slot={isSectionLayout ? 'section-control' : undefined}
            className={cn(
              'min-w-0',
              isSectionLayout && 'sm:justify-self-end',
              viewOnly && 'flex items-center gap-2 text-body-sm text-muted-foreground',
            )}
          >
            {control}
          </div>
        ) : (
          control
        ))}
    </Field>
  );
}

export function SettingsRow(props: SettingsRowProps) {
  return <SettingsRowLayout {...props} layout="factory" />;
}

export type SettingsFieldsetRowProps = Omit<FieldsetProps, 'children'> & {
  label: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
};

export function SettingsFieldsetRow({ label, description, children, className, ...props }: SettingsFieldsetRowProps) {
  const descriptionId = useId();

  return (
    <Fieldset
      data-slot="settings-row"
      aria-describedby={description == null ? undefined : descriptionId}
      className={cn('flex flex-col sm:flex-row sm:items-center', factoryRowClassName, className)}
      {...props}
    >
      <div className={factoryRowHeadingClassName}>
        <FieldsetLegend>{label}</FieldsetLegend>
        {description != null && (
          <div id={descriptionId} className="flex flex-col gap-0.5 text-caption text-muted-foreground">
            {description}
          </div>
        )}
      </div>
      {children}
    </Fieldset>
  );
}
