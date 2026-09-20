import '../../../../../new-theme.css';
import { TriangleAlertIcon } from 'lucide-react';
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
      className={cn(
        'new-theme flex items-center gap-2 text-ui-sm text-foreground',
        // Colour is never the only signal: the icon carries the error meaning, the text
        // states it, and the field itself draws an error border.
        '[&>svg]:size-[1.2em] [&>svg]:text-destructive',
        className,
      )}
    >
      <TriangleAlertIcon aria-hidden />
      {children}
    </p>
  );
}
