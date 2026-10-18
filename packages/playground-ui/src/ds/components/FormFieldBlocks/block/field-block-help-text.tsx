import { Txt } from '@/ds/components/Txt';
export type FieldBlockHelpTextProps = {
  children?: React.ReactNode;
};

export function FieldBlockHelpText({ children }: FieldBlockHelpTextProps) {
  return (
    <Txt variant="caption" tone="muted">
      {children}
    </Txt>
  );
}
