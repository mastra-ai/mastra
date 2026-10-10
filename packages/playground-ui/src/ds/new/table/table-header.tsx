import type { ComponentProps } from 'react';

export type TableHeaderProps = ComponentProps<'thead'>;

export function TableHeader(props: TableHeaderProps) {
  return <thead data-slot="table-header" {...props} />;
}
