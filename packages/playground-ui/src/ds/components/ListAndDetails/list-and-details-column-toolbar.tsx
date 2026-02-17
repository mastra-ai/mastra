export type ListAndDetailsColumnToolbarProps = {
  children?: React.ReactNode;
  className?: string;
};

export function ListAndDetailsColumnToolbar({
  children,
  className,
}: ListAndDetailsColumnToolbarProps): React.JSX.Element {
  return <div className={`flex items-center gap-3 justify-between ${className || ''}`}>{children}</div>;
}
