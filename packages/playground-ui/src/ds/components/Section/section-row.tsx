import type { ReactNode } from 'react';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/ds/components/Field';
import type { FieldProps } from '@/ds/components/Field';
import { SettingsRowControl } from '@/ds/new/settings/settings-row';
import { cn } from '@/lib/utils';

export type SectionRowProps = Omit<FieldProps, 'children' | 'invalid' | 'orientation'> & {
  label: ReactNode;
  description?: ReactNode;
  htmlFor?: string;
  children?: ReactNode;
  required?: boolean;
  errorMsg?: ReactNode;
};
export type SectionViewOnlyRowProps = SectionRowProps & { children: ReactNode };
export type SectionDestructiveRowProps = SectionRowProps & { children: ReactNode };

function SectionRowBase({
  label,
  description,
  htmlFor,
  children,
  className,
  required = false,
  errorMsg,
  disabled,
  viewOnly = false,
  destructive = false,
  ...props
}: SectionRowProps & { viewOnly?: boolean; destructive?: boolean }) {
  return (
    <Field
      orientation="responsive"
      invalid={Boolean(errorMsg)}
      disabled={disabled || viewOnly}
      data-slot="section-row"
      className={cn(
        'grid min-w-0 gap-3 group-data-[variant=factory]/section:px-3 group-data-[variant=factory]/section:py-2 group-data-[variant=flat]/section:p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:group-data-[variant=default]/section:gap-4 sm:group-data-[variant=factory]/section:gap-4 sm:group-data-[variant=flat]/section:gap-6',
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        <FieldLabel
          {...(htmlFor ? { htmlFor } : {})}
          required={required}
          className={cn(destructive && 'text-destructive-foreground')}
        >
          {label}
        </FieldLabel>
        {description != null && <FieldDescription className="mt-1 text-pretty">{description}</FieldDescription>}
        <FieldError className="mt-1">{errorMsg}</FieldError>
      </div>
      {children != null && (
        <div
          data-slot="section-control"
          className={cn(
            'min-w-0 sm:justify-self-end',
            viewOnly && 'flex items-center gap-2 text-body-sm text-muted-foreground',
          )}
        >
          <SettingsRowControl viewOnly={viewOnly}>{children}</SettingsRowControl>
        </div>
      )}
    </Field>
  );
}

/** @deprecated Use SettingsRow from @mastra/playground-ui/new/settings for settings pages. */
export function SectionRow(props: SectionRowProps) {
  return <SectionRowBase {...props} />;
}

/** @deprecated Use SettingsRow with viewOnly from @mastra/playground-ui/new/settings. */
export function SectionViewOnlyRow(props: SectionViewOnlyRowProps) {
  return <SectionRowBase {...props} viewOnly />;
}

/** @deprecated Use SettingsRow with tone="destructive" from @mastra/playground-ui/new/settings. */
export function SectionDestructiveRow(props: SectionDestructiveRowProps) {
  return <SectionRowBase {...props} destructive />;
}
