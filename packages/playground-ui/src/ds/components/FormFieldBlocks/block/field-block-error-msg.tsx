import { cn } from '@/lib/utils';

export type FieldBlockErrorMsgProps = {
  children?: React.ReactNode;
  /**
   * The field this message belongs to, matching the `name` given to `FieldBlock.Label`.
   * Sets a stable `error-<name>` id so the control can point at it with
   * `aria-describedby` and a screen reader reads the message with the field.
   */
  name?: string;
  className?: string;
};

export function FieldBlockErrorMsg({ children, name, className }: FieldBlockErrorMsgProps) {
  return (
    <p
      // `role="alert"` lives here rather than in a wrapper at every call site, so an
      // error announces itself wherever it is used instead of depending on each caller
      // remembering to wrap it.
      role="alert"
      id={name !== undefined ? `error-${name}` : undefined}
      className={cn('text-caption text-destructive', className)}
    >
      {children}
    </p>
  );
}
