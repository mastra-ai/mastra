import { Button } from '@mastra/playground-ui/components/Button';
import { CardTitle } from '@mastra/playground-ui/components/Card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@mastra/playground-ui/components/HoverCard';
import { TextAndIcon } from '@mastra/playground-ui/components/Text';
import { useId } from 'react';
import { ProviderLogo } from '../agent-metadata/provider-logo';

export interface AgentProviderDetailsProps {
  agentName: string;
  provider?: string;
  modelId?: string;
}

export function AgentProviderDetails({ agentName, provider, modelId }: AgentProviderDetailsProps) {
  const titleId = useId();

  if (!provider) return <span>—</span>;

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={0}
        closeDelay={0}
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="pointer-events-auto"
            aria-label={`Show model details for ${agentName}`}
          >
            <span aria-hidden="true">
              <ProviderLogo providerId={provider} className="dark:invert" />
            </span>
          </Button>
        }
      />
      <HoverCardContent
        role="dialog"
        aria-labelledby={titleId}
        side="top"
        align="center"
        className="w-72 max-w-[calc(100vw-2rem)]"
      >
        <div className="grid gap-3">
          <CardTitle id={titleId}>Model</CardTitle>
          <TextAndIcon className="text-ui-sm text-neutral5">
            <span aria-hidden="true">
              <ProviderLogo providerId={provider} className="dark:invert" />
            </span>
            <span className="overflow-wrap-anywhere min-w-0">{provider}</span>
          </TextAndIcon>
          <span className="overflow-wrap-anywhere text-ui-sm text-neutral5 min-w-0">
            {modelId || 'No model configured'}
          </span>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
