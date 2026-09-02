export type FieldBlockHelpTextProps = {
  children?: React.ReactNode;
};

export function FieldBlockHelpText({ children }: FieldBlockHelpTextProps) {
  return <p className="text-ui-sm text-(--text-secondary)">{children}</p>;
}
