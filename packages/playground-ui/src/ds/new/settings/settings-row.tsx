import { LockKeyholeIcon } from 'lucide-react';
import { useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';
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
  /**
   * `side` (default): the control sits on the right. Text fields take one shared width (13.75rem), selects hug
   * their value up to that width, and switches and buttons keep their own size; all end at the right edge.
   * `below`: the control goes under the label at full width, for forms with several controls.
   */
  controlPlacement?: 'side' | 'below';
};

/** Label left, control right; stacked below `sm`. The card around the row gives it its spacing. */
const rowClassName = 'min-w-0 gap-3';
/** Side by side: label left, control pushed right. A control below its label fills the row instead. */
const sideRowClassName = 'sm:justify-between sm:gap-6';
const headingClassName = 'flex min-w-0 flex-col gap-px';
/**
 * The control column on the right. Inputs fill it (at least 13.75rem); selects and other field triggers hug
 * their value (`--field-width: auto`, see `fieldTriggerWidthStyle`) up to that same width.
 */
const sideControlClassName =
  'flex min-w-0 items-center justify-end gap-2 [--field-max-width:13.75rem] [--field-width:auto] sm:min-w-55 sm:shrink-0';

export type SettingsControlGroupProps = ComponentProps<'div'>;

/**
 * Several controls that set one value together (a period select and an amount). The group takes the field
 * width (13.75rem) so it ends where every other control in the column ends, whatever it holds. Controls inside
 * share that width: selects fill their share instead of hugging their value; size one with a width class
 * (`w-32`) and give the other `flex-1`. Use it instead of a `div` with its own width.
 */
export function SettingsControlGroup({ className, ...props }: SettingsControlGroupProps) {
  return (
    <div
      data-slot="settings-control-group"
      className={cn(
        'flex w-(--field-max-width) max-w-full min-w-0 items-center gap-2 [--field-width:100%] *:min-w-0',
        className,
      )}
      {...props}
    />
  );
}

export function SettingsRowControl({ viewOnly = false, children }: { viewOnly?: boolean; children: ReactNode }) {
  if (!viewOnly) return children;
  return (
    <>
      <LockKeyholeIcon className="size-4 shrink-0" aria-hidden />
      <span className="sr-only">View only: </span>
      {children}
    </>
  );
}

/** One setting: a label, an optional one-line description, and its control. Goes in a `SettingsContainer`. */
export function SettingsRow({
  label,
  description,
  htmlFor,
  children,
  className,
  tone = 'default',
  viewOnly = false,
  required = false,
  errorMsg,
  disabled,
  controlPlacement = 'side',
  ...props
}: SettingsRowProps) {
  const controlBelow = controlPlacement === 'below';

  return (
    <Field
      orientation={controlBelow ? 'vertical' : 'responsive'}
      invalid={Boolean(errorMsg)}
      disabled={disabled || viewOnly}
      data-slot="settings-row"
      className={cn(rowClassName, !controlBelow && sideRowClassName, className)}
      {...props}
    >
      <div className={headingClassName}>
        <FieldLabel
          {...(htmlFor ? { htmlFor } : {})}
          required={required}
          className={cn(tone === 'destructive' && 'text-destructive-foreground')}
        >
          {label}
        </FieldLabel>
        {description != null && (
          <FieldDescription render={<div />} className="mt-0 flex flex-col gap-0.5 text-pretty">
            {description}
          </FieldDescription>
        )}
        <FieldError className="mt-0">{errorMsg}</FieldError>
      </div>
      {children != null && (
        <div
          data-slot="settings-row-control"
          className={cn(
            'min-w-0',
            !controlBelow && sideControlClassName,
            viewOnly && 'flex items-center gap-2 text-body-sm text-muted-foreground',
          )}
        >
          <SettingsRowControl viewOnly={viewOnly}>{children}</SettingsRowControl>
        </div>
      )}
    </Field>
  );
}

export type SettingsFieldsetRowProps = Omit<FieldsetProps, 'children'> & {
  label: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Same as `SettingsRow`'s: `below` puts the controls under the label at full width. */
  controlPlacement?: 'side' | 'below';
};

/** A `SettingsRow` for a group of controls (radios, several switches), labelled by a legend. */
export function SettingsFieldsetRow({
  label,
  description,
  children,
  className,
  controlPlacement = 'side',
  ...props
}: SettingsFieldsetRowProps) {
  const descriptionId = useId();
  const controlBelow = controlPlacement === 'below';

  return (
    <Fieldset
      data-slot="settings-row"
      aria-describedby={description == null ? undefined : descriptionId}
      className={cn(
        'flex flex-col',
        rowClassName,
        !controlBelow && ['sm:flex-row sm:items-center', sideRowClassName],
        className,
      )}
      {...props}
    >
      <div className={headingClassName}>
        <FieldsetLegend>{label}</FieldsetLegend>
        {description != null && (
          <div id={descriptionId} className="flex flex-col gap-0.5 text-caption text-pretty text-muted-foreground">
            {description}
          </div>
        )}
      </div>
      {children != null && (
        <div data-slot="settings-row-control" className={cn('min-w-0', !controlBelow && sideControlClassName)}>
          {children}
        </div>
      )}
    </Fieldset>
  );
}
