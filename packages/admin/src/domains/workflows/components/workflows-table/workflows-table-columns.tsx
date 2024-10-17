import type { BlueprintWithRelations } from '@mastra/core';
import { ColumnDef } from '@tanstack/react-table';

import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

import { formatDate } from '../../../../lib/date';
import { workflowStatusColorMap, workflowStatusTextMap } from '../../utils';

interface IWorkflowTableColumns {
  handleRunWorkflow: (workflowId: string) => void;
  handleDeleteWorkflow: (workflowId: string) => void;
  handleOpenWorkflow: (workflowId: string) => void;
}

export const workflowsColumns = ({
  handleRunWorkflow,
  handleDeleteWorkflow,
  handleOpenWorkflow,
}: IWorkflowTableColumns): ColumnDef<BlueprintWithRelations>[] => [
  {
    id: 'canvas',
    header: 'Canvas',
    cell: ({ row }) => {
      const { isLoading } = row.original;
      if (isLoading) {
        return <Skeleton className="my-2 h-[43px] w-[180px] rounded-[2px]" />;
      }
      return (
        <div className="my-2 flex w-[180px] items-center justify-center gap-[14px] rounded-[2px] border-[0.3px] border-solid border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)] py-[10px]">
          <div className="radius-[2px] flex h-[22px] w-[22px] items-center justify-center rounded-[2px] border-[0.393px] border-solid border-[#4F4F4F] shadow-sm">
            <Icon name="four-boxes" className="h-[12px] w-[12px] text-[#c8c8c8]" />
          </div>
          <div className="radius-[2px] flex h-[22px] w-[22px] items-center justify-center rounded-[2px] border-[0.393px] border-solid border-[#4F4F4F] shadow-sm">
            <Icon name="four-boxes" className="h-[12px] w-[12px] text-[#c8c8c8]" />
          </div>
          <div className="radius-[2px] flex h-[22px] w-[22px] items-center justify-center rounded-[2px] border-[0.393px] border-solid border-[#4F4F4F] shadow-sm">
            <Icon name="four-boxes" className="h-[12px] w-[12px] text-[#c8c8c8]" />
          </div>
        </div>
      );
    },
  },
  {
    id: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const { title, description, isLoading } = row.original;

      if (isLoading) {
        return (
          <div className="flex flex-col gap-1">
            <Skeleton className="h-[13px] w-[80px] rounded-[2px]" />
            <Skeleton className="h-[11px] w-[120px] rounded-[2px]" />
          </div>
        );
      }

      return (
        <div className="flex flex-col">
          <span className="text-[#f5f5f5] text-[13px]">{title}</span>
          <span className="text-[#737373] line-clamp-1 w-[500px] text-ellipsis text-[11px]">{description}</span>
        </div>
      );
    },
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const { status, isLoading } = row.original;

      if (isLoading) {
        return (
          <div className="flex items-center gap-1">
            <Skeleton className="h-[0.56rem] w-[0.56rem] rounded-full" />
            <Skeleton className="h-3 w-[50px] rounded-[2px]" />
          </div>
        );
      }

      return (
        <div className="flex items-center justify-center gap-1">
          <span
            style={{
              backgroundColor: workflowStatusColorMap[status],
            }}
            className={`h-[0.56rem] w-[0.56rem] rounded-full`}
          ></span>
          <span className="text-[#737373] text-xs">{workflowStatusTextMap[status]}</span>
        </div>
      );
    },
  },
  {
    id: 'updatedAt',
    header: 'Updated',
    cell: ({ row }) => {
      const { updatedAt, isLoading, id } = row.original;
      if (isLoading) {
        return <Skeleton className="h-3 w-[50px] rounded-[2px]" />;
      }
      return (
        <p className="text-[#737373] text-center text-xs">
          {updatedAt ? formatDate(updatedAt, { month: 'short' }) : '-'}
        </p>
      );
    },
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => {
      const { id, isLoading } = row.original;
      if (isLoading) {
        return (
          <div className="flex items-center justify-end gap-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-1 w-4 rounded-[2px]" />
          </div>
        );
      }
      return (
        <div className="flex items-center justify-end gap-2">
          <Dropdown>
            <Dropdown.Trigger asChild>
              <Button
                className="text-muted-foreground group hover:text-white"
                variant={'ghost'}
                size={'icon'}
                onClick={e => {
                  e.stopPropagation();
                }}
              >
                <Icon name="dot-menu-sleep" className="text-lightGray-3 group-hover:text-current" />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Content
              onClick={e => {
                e.stopPropagation();
              }}
            >
              <Dropdown.Item onClick={() => handleOpenWorkflow(id)}>Open Workflow</Dropdown.Item>
              <Dropdown.Item onClick={() => handleDeleteWorkflow(id)} className="!text-red-400">
                Delete Workflow
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown>
        </div>
      );
    },
  },
];
