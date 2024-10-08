import { Row } from '@tanstack/react-table';

import { Text } from '@/components/ui/text';

import { Agent } from '@/service/service.agentWriter';

const NameCell = ({ name }: { name: string }) => {
  return (
    <div className="flex gap-3 items-center">
      <div className="flex flex-col">
        <Text size="sm" weight="medium" className="text-mastra-el-5 capitalize">
          {name.toLowerCase()}
        </Text>
      </div>
    </div>
  );
};

// const CreatedAtCell = ({ name }: { name: string }) => {
//   const { connections } = useConnections({ name });
//   const firstConnection = last(connections);
//   return firstConnection ? (
//     <div className="flex items-center gap-1">
//       <Icon name="calendar-empty" className="text-mastra-el-3" />
//       <Text size="xs" className="text-mastra-el-3">
//         {formatDate(firstConnection.createdAt, { month: 'short' })}
//       </Text>
//     </div>
//   ) : (
//     <Text size="xs" className="text-mastra-el-3">
//       -
//     </Text>
//   );
// };

export const agentsTableColumns = [
  {
    id: 'name',
    header: 'Name',
    cell: ({ row }: { row: Row<Agent> }) => {
      const { name } = row.original;

      return <NameCell name={name} />;
    },
  },
  {
    id: 'agentType',
    header: 'AgentType',
    cell: ({ row }: { row: Row<Agent> }) => {
      const { agentType } = row.original;

      return <NameCell name={agentType} />;
    },
  },
  //   {
  //     id: 'connected',
  //     header: 'Connected',
  //     cell: ({ row }) => {
  //       if (row.original.isLoading)
  //         return (
  //           <div className="flex gap-1 items-center">
  //             <Skeleton className="h-4 w-4 rounded-sm" />
  //             <Skeleton className="h-3 w-24" />
  //           </div>
  //         );
  //       return <CreatedAtCell name={row.original.name} />;
  //     },
  //   },
  //   {
  //     id: 'actions',
  //     header: 'Actions',
  //     cell: ({ row }) => {
  //       if (row.original.isLoading)
  //         return (
  //           <div className="flex gap-2 items-center">
  //             <Skeleton className="h-6 w-28 rounded-md" />
  //             <Skeleton className="h-6 w-28 rounded-md" />
  //             <Skeleton className="h-6 w-28 rounded-md" />
  //             <Skeleton className="h-1 w-4 rounded-md" />
  //           </div>
  //         );

  //       return (
  //         <div className="flex items-center gap-2">
  //           <Button
  //             size="xs"
  //             variant="primary"
  //             className="text-xs"
  //             onClick={() => {
  //               handleConnectionButtonSnippet(row.original);
  //             }}
  //           >
  //             <Icon name="activity" className="text-mastra-el-3 mr-1" />
  //             Add app button
  //           </Button>
  //           <Button
  //             size="xs"
  //             variant="primary"
  //             className="text-xs"
  //             onClick={() => {
  //               handleConnectIntegration(row.original);
  //             }}
  //           >
  //             <Icon name="plus-icon" className="text-mastra-el-3 mr-1" />
  //             Connect account
  //           </Button>
  //           <Button variant="primary" size="xs" className="text-xs">
  //             <Icon name="book" className="text-mastra-el-3 mr-1" />
  //             Docs
  //           </Button>
  //           <IconButton icon="dot-menu-sleep" className="p-[6px]" />
  //         </div>
  //       );
  //     },
  //   },
];
