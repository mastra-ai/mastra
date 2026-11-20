import { useId } from 'react';
import type { ReactNode } from 'react';
import { settingsRowLabelClassName } from './settings-row-label';
import { Field, FieldDescription, FieldError, FieldLabel, Fieldset, FieldsetLegend } from '@/ds/components/Field';
import type { FieldProps, FieldsetProps } from '@/ds/components/Field';
import { IconLock } from '@/ds/icons/central/IconLock';
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
/**
 * Side by side: label left, control right. The label stays at the top, so a control that grows (an error or preview
 * line under a field) doesn't pull it down. When the control is too wide to sit beside the label (keeping the label at
 * least 12rem, so a text field still fits beside it in a default-size dialog), it wraps onto its own line under the
 * label, starting at the left edge. A control below its label fills the row instead.
 */
const sideRowClassName = 'sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-6 sm:gap-y-3';
const headingClassName = 'flex min-w-0 flex-col gap-px';
/** Beside its control, the label column is as tall as a label with a one-line description, so rows with and without one match. */
const sideHeadingClassName =
  'sm:flex-[1_1_12rem] sm:min-h-[calc(var(--text-label)*1.5+1px+var(--text-caption)*1.5)] sm:justify-center';
/**
 * The controls. With a text input they take at least 13.75rem; selects and other field triggers hug their value
 * (`--field-width: auto`, see `fieldTriggerWidthStyle`) up to that same width; switches and buttons keep their size,
 * so a row of only those never wraps for lack of room. The column is as tall as the row, so a control shorter than the
 * label column is centered against it.
 */
const sideControlClassName =
  'flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2 [--field-max-width:13.75rem] [--field-width:auto] sm:shrink-0 sm:self-stretch sm:has-[>input:not([aria-hidden]),>[data-slot=input-group]]:min-w-55';

export function SettingsRowControl({ viewOnly = false, children }: { viewOnly?: boolean; children: ReactNode }) {
  if (!viewOnly) return children;
  return (
    <>
      <IconLock className="size-icon-md shrink-0" aria-hidden />
      <span className="sr-only">View only: </span>
      {children}
    </>
  );
}

/**
 * One setting the person changes: a label, an optional one-line description, and the control that changes it. The
 * row is a form field, so its label names the control. Goes in a `SettingsContainer`.
 *
 * For one thing in a list (an account, a member, an API key, a package version), use `SettingsItem` instead: a row
 * with no control, or one per record in a `.map`, is a list item. A setting someone may not change stays a
 * `SettingsRow` with `viewOnly`.
 *
 * @example
 * <SettingsRow label="Theme" description="Color scheme for the interface.">
 *   <ThemeToggle />
 * </SettingsRow>
 */
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
      <div className={cn(headingClassName, !controlBelow && sideHeadingClassName)}>
        <FieldLabel {...(htmlFor ? { htmlFor } : {})} required={required} className={settingsRowLabelClassName(tone)}>
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

/**
 * A `SettingsRow` for one setting made of several controls (radios, several switches), labelled by a legend. Same
 * rule as `SettingsRow`: a setting the person changes, never a list entry.
 *
 * @example
 * <SettingsFieldsetRow label="Notify me about" controlPlacement="below">
 *   <Checkbox … />
 * </SettingsFieldsetRow>
 */
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
      className={cn('flex flex-col', rowClassName, !controlBelow && ['sm:flex-row', sideRowClassName], className)}
      {...props}
    >
      <div className={cn(headingClassName, !controlBelow && sideHeadingClassName)}>
        <FieldsetLegend className={settingsRowLabelClassName()}>{label}</FieldsetLegend>
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
