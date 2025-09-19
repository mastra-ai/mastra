import { Entity, EntityContent, EntityDescription, EntityIcon, EntityName, ToolsIcon } from '@mastra/playground-ui';
import { useRef } from 'react';
import { Link } from 'react-router';

export interface ToolListProps {
  tools: Array<{ name: string; id: string; description: string }>;
  agentId: string;
}

export function ToolList({ tools, agentId }: ToolListProps) {
  return (
    <ul className="space-y-2">
      {tools.map(tool => (
        <li key={tool.id}>
          <ToolEntity tool={tool} agentId={agentId} />
        </li>
      ))}
    </ul>
  );
}

interface ToolEntityProps {
  tool: { name: string; id: string; description: string };
  agentId: string;
}

const ToolEntity = ({ tool, agentId }: ToolEntityProps) => {
  const linkRef = useRef<HTMLAnchorElement>(null);

  return (
    <Entity onClick={() => linkRef.current?.click()}>
      <EntityIcon>
        <ToolsIcon className="group-hover/entity:text-[#ECB047]" />
      </EntityIcon>
      <EntityContent>
        <EntityName>
          <Link ref={linkRef} to={`/tools/${agentId}/${tool.id}`}>
            {tool.name}
          </Link>
        </EntityName>
        <EntityDescription>{tool.description}</EntityDescription>
      </EntityContent>
    </Entity>
  );
};
