import '../../../../../new-theme.css';

export type FieldBlockHelpTextProps = {
  children?: React.ReactNode;
};

export function FieldBlockHelpText({ children }: FieldBlockHelpTextProps) {
  return <p className="new-theme text-ui-sm text-muted-foreground">{children}</p>;
}
