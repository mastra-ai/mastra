export type FieldBlockHelpTextProps = {
  children?: React.ReactNode;
};

export function FieldBlockHelpText({ children }: FieldBlockHelpTextProps) {
  return <p className="text-neutral3 text-ui-sm">{children}</p>;
}
