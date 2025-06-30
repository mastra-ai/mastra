import { Txt } from '@/ds/components/Txt';

import { ExternalLinkIcon } from 'lucide-react';
import { Icon } from '@/ds/icons';

type RuntimeContextInfoProps = {
  className?: string;
  style?: React.CSSProperties;
  Link?: any;
};

export function RuntimeContextInfo({ className, style, Link }: RuntimeContextInfoProps) {
  return (
    <div className="flex flex-col gap-4 items-start">
      <Txt as="p" variant="ui-lg" className="text-icon3">
        Mastra provides runtime context, which is a system based on dependency injection that enables you to configure
        your agents and tools with runtime variables. If you find yourself creating several different agents that do
        very similar things, runtime context allows you to combine them into one agent.
      </Txt>

      <a
        href="https://mastra.ai/en/docs/agents/runtime-variables"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center text-ui-lg gap-2 text-icon3 hover:text-icon1 transition-colors"
      >
        <Icon>
          <ExternalLinkIcon />
        </Icon>
        See documentation
      </a>
    </div>
  );
}
