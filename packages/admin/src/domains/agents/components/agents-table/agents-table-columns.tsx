import { Row } from '@tanstack/react-table';

import Link from 'next/link';

import Icon from '@/components/icon';
import { Text } from '@/components/ui/text';

import { Agent } from '@/service/service.agentWriter';

const NameCell = ({ name }: { name: string }) => {
  return (
    <div className="flex gap-3 items-center">
      <div className="flex flex-col">
        <Text size="sm" weight="medium" className="text-mastra-el-5 capitalize">
          {name?.toLowerCase()}
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
      return <NameCell name={row.original.name} />;
    },
  },
  {
    id: 'agentType',
    header: 'AgentType',
    cell: ({ row }: { row: Row<Agent> }) => {
      return <NameCell name={'RAG'} />;
    },
  },

  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }: { row: Row<Agent> }) => {
      return (
        <div className="flex items-center gap-2">
          <Link
            className="text-xs border rounded bg-mastra-bg-3 group shadow w-fit px-3 py-1 flex items-center gap-1.5"
            href={`/agents/chat/${row.original.id}`}
          >
            <Icon
              name="chat-with-agent"
              className="text-mastra-el-3 group-hover:text-mastra-el-6 transition-colors mr-1"
            />
            <span>Chat with agent</span>
          </Link>
          <Link
            className="text-xs border rounded bg-mastra-bg-3 group shadow w-fit px-3 py-1 flex items-center gap-1.5"
            href={`/agents/edit/${row.original.id}`}
          >
            <Icon name="edit" className="text-mastra-el-3 group-hover:text-mastra-el-6 transition-colors mr-1" />
            <span>Edit agent</span>
          </Link>
        </div>
      );
    },
  },
];
