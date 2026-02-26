export type ListAndDetailsColumnContentProps = {
  children?: React.ReactNode;
  className?: string;
};

export function ListAndDetailsColumnContent({
  children,
  className,
}: ListAndDetailsColumnContentProps): React.JSX.Element {
  return <div className={`grid overflow-y-auto gap-8 content-start ${className || ''}`}>{children}</div>;
}
