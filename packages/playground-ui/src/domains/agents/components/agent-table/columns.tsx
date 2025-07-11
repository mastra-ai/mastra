import { Badge } from '@/ds/components/Badge';
import { Cell, EntryCell } from '@/ds/components/Table';
import { ApiIcon } from '@/ds/icons/ApiIcon';
import { OpenAIIcon } from '@/ds/icons/OpenAIIcon';
import { ColumnDef, Row } from '@tanstack/react-table';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { OpenaiChatIcon } from '@/ds/icons/OpenaiChatIcon';
import { AnthropicChatIcon } from '@/ds/icons/AnthropicChatIcon';
import { AnthropicMessagesIcon } from '@/ds/icons/AnthropicMessagesIcon';
import { AzureIcon } from '@/ds/icons/AzureIcon';
import { AmazonIcon } from '@/ds/icons/AmazonIcon';
import { GoogleIcon } from '@/ds/icons';
import { CohereIcon } from '@/ds/icons/CohereIcon';
import { GroqIcon } from '@/ds/icons/GroqIcon';
import { XGroqIcon } from '@/ds/icons/XGroqIcon';
import { MistralIcon } from '@/ds/icons/MistralIcon';
import { AgentTableData } from './types';
import { useLinkComponent } from '@/lib/framework';

export const providerMapToIcon = {
  'openai.chat': <OpenaiChatIcon />,
  'anthropic.chat': <AnthropicChatIcon />,
  'anthropic.messages': <AnthropicMessagesIcon />,
  AZURE: <AzureIcon />,
  AMAZON: <AmazonIcon />,
  GOOGLE: <GoogleIcon />,
  COHERE: <CohereIcon />,
  GROQ: <GroqIcon />,
  X_GROK: <XGroqIcon />,
  MISTRAL: <MistralIcon />,
};

export type AgentTableColumn = {
  repoUrl: string;
  executedAt: Date | null;
  modelId: string;
  link: string;
} & AgentTableData;

const NameCell = ({ row }: { row: Row<AgentTableColumn> }) => {
  const { Link } = useLinkComponent();
  return (
    <EntryCell
      icon={<AgentIcon />}
      name={
        <Link className="w-full space-y-0" href={row.original.link}>
          {row.original.name}
        </Link>
      }
      description={row.original.instructions}
    />
  );
};

export const columns: ColumnDef<AgentTableColumn>[] = [
  {
    header: 'Name',
    accessorKey: 'name',
    cell: NameCell,
  },
  {
    header: 'Model',
    accessorKey: 'model',
    size: 160,
    cell: ({ row }) => {
      return (
        <Cell>
          <Badge
            variant="default"
            icon={providerMapToIcon[row.original.provider as keyof typeof providerMapToIcon] || <OpenAIIcon />}
          >
            {row.original.modelId || 'N/A'}
          </Badge>
        </Cell>
      );
    },
  },
  {
    size: 160,
    header: 'Tools',
    accessorKey: 'tools',
    cell: ({ row }) => {
      const toolsCount = row.original.tools ? Object.keys(row.original.tools).length : 0;

      return (
        <Cell>
          <Badge variant="default" icon={<ApiIcon />}>
            {toolsCount} tool{toolsCount > 1 ? 's' : ''}
          </Badge>
        </Cell>
      );
    },
  },
];
