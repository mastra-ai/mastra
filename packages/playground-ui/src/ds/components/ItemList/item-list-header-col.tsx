export type ItemListHeaderColProps = {
  children?: React.ReactNode;
  className?: string;
};

export function ItemListHeaderCol({ children, className }: ItemListHeaderColProps) {
  return <span className={className}>{children}</span>;
}
