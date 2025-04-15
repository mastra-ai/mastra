'use client';

import { EvaluatorIcon } from '@/components/icons/evaluator-icon';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';

export const EvaluatorsTable = ({
  title,
  evaluatorsList,
  columns,
  isLoading,
}: {
  title?: React.ReactNode;
  evaluatorsList: any[];
  columns: ColumnDef<any>[];
  isLoading?: boolean;
}) => {
  return (
    <DataTable
      emptyText="Evaluators"
      title={title}
      isLoading={isLoading}
      withoutBorder
      withoutRadius
      icon={<EvaluatorIcon className="w-4 h-4" />}
      columns={columns}
      data={evaluatorsList}
      className="!border-t-0 border-[0.5px] border-x-0"
    />
  );
};
