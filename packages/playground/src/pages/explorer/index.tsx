import { Link } from 'react-router';
import { Network, Database, MessageSquare, Users } from 'lucide-react';

interface Primitive {
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  url: string;
  isActive: boolean;
}

const primitives: Primitive[] = [
  {
    name: 'Workflow Runs',
    description: 'Explore and analyze workflow execution runs',
    icon: Network,
    url: '/explorer/workflow-runs',
    isActive: true,
  },
  {
    name: 'Agent Conversations',
    description: 'View and search through agent conversations',
    icon: MessageSquare,
    url: '/explorer/agent-conversations',
    isActive: true,
  },
];

export default function Explorer() {
  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border1 px-6 py-4">
        <h1 className="text-2xl font-semibold text-text1">Data Explorer</h1>
        <p className="text-sm text-text3 mt-1">Explore and analyze your Mastra data primitives</p>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {primitives.map(primitive => (
            <PrimitiveCard key={primitive.name} primitive={primitive} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PrimitiveCard({ primitive }: { primitive: Primitive }) {
  const Icon = primitive.icon;

  if (!primitive.isActive) {
    return (
      <div className="group relative rounded-lg border border-border1 bg-surface2 p-6 hover:border-border2 transition-colors opacity-60 cursor-not-allowed">
        <div className="flex items-start gap-4">
          <div className="rounded-md bg-surface3 p-3">
            <Icon className="h-6 w-6 text-icon3" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-text2">{primitive.name}</h3>
            <p className="text-sm text-text3 mt-1">{primitive.description}</p>
            <span className="inline-block mt-3 text-xs text-text4 bg-surface3 px-2 py-1 rounded">Coming Soon</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link
      to={primitive.url}
      className="group relative rounded-lg border border-border1 bg-surface2 p-6 hover:border-border2 transition-colors hover:bg-surface3"
    >
      <div className="flex items-start gap-4">
        <div className="rounded-md bg-surface3 p-3 group-hover:bg-surface1 transition-colors">
          <Icon className="h-6 w-6 text-icon3 group-hover:text-icon1" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-text2 group-hover:text-text1">{primitive.name}</h3>
          <p className="text-sm text-text3 mt-1">{primitive.description}</p>
          <span className="inline-block mt-3 text-xs text-accent1 group-hover:underline">Explore →</span>
        </div>
      </div>
    </Link>
  );
}
