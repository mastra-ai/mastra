import { Row } from '@tanstack/react-table';

import Link from 'next/link';

import Icon from '@/components/icon';
import { Text } from '@/components/ui/text';

import { Agent } from '@/service/service.agentWriter';
import { IconName } from '@/types/icons';

import { ModelProviders } from '../agents-info-form';

const modelProviders: Array<ModelProviders> = [
  {
    name: 'OpenAI (Assistant API)',
    value: 'OPEN_AI_ASSISTANT',
    key: 'OPENAI',
    icon: 'openai-logomark',
  },
  {
    name: 'OpenAI (Vercel AI SDK)',
    value: 'OPEN_AI_VERCEL',
    key: 'OPENAI',
    icon: 'openai-logomark',
  },
  {
    name: 'Anthropic (Vercel AI SDK)',
    value: 'ANTHROPIC_VERCEL',
    key: 'ANTHROPIC',
    icon: 'anthropic-logomark',
  },
  {
    name: 'Groq (Vercel AI SDK)',
    value: 'GROQ_VERCEL',
    key: 'GROQ',
    icon: 'anthropic-logomark',
  },
];

function getIcon(provider: string): IconName {
  return modelProviders.find(modelProvider => modelProvider.value === provider)?.icon as IconName;
}

const LinkCell = ({ name, id }: { name: string; id: string }) => {
  return (
    <Link
      href={`/agents/edit/${id}`}
      className="text-sm hover:text-mastra-border-4 transition-colors w-full h-full flex items-center font-medium text-mastra-el-5"
    >
      {name}
    </Link>
  );
};

const NameCell = ({ name }: { name: string }) => {
  return (
    <Text size="xs" className="text-mastra-el-5  w-fit">
      {name}
    </Text>
  );
};

export const agentsTableColumns = [
  {
    id: 'name',
    header: 'Name',
    cell: ({ row }: { row: Row<Agent> }) => {
      return <LinkCell name={row.original.name} id={row.original.id} />;
    },
  },

  {
    id: 'provider',
    header: 'Provider ',
    cell: ({ row }: { row: Row<Agent> }) => {
      return (
        <div className="flex gap-1 items-center">
          <Icon className="w-3 h-3" name={getIcon(row.original.model?.provider)} />
          <NameCell name={row.original.model?.provider.toLocaleLowerCase()} />
        </div>
      );
    },
  },

  {
    id: 'model',
    header: 'Model',
    cell: ({ row }: { row: Row<Agent> }) => {
      return <NameCell name={row.original.model?.name} />;
    },
  },
  {
    id: 'tools',
    header: 'Tools',
    cell: ({ row }: { row: Row<Agent> }) => {
      const tools = row.original.tools;
      const toolsCount = tools ? Object.keys(row.original.tools).length : 0;
      return <NameCell name={toolsCount.toString()} />;
    },
  },
  {
    id: 'structured-response',
    header: 'Structured Response',
    cell: ({ row }: { row: Row<Agent> }) => {
      const structuredResponse = row.original.outputs?.structured;

      const hasStructuredResponse = structuredResponse
        ? Object.values(structuredResponse).length
          ? true
          : false
        : false;
      return <NameCell name={hasStructuredResponse ? 'True' : 'False'} />;
    },
  },
  {
    id: 'chat',
    header: 'Chat',
    cell: ({ row }: { row: Row<Agent> }) => {
      return (
        <div className="flex items-center gap-2">
          <Link
            className="text-xs border rounded bg-mastra-bg-3 group shadow w-fit px-3 py-1 flex items-center gap-1.5"
            href={`/agents/chat/${row.original.id}`}
          >
            <Icon name="agent" className="text-mastra-el-3 group-hover:text-mastra-el-6 transition-colors mr-1" />
            <span>Chat with agent</span>
          </Link>
        </div>
      );
    },
  },
];
