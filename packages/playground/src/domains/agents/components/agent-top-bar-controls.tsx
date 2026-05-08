import { Popover, PopoverContent, PopoverTrigger, ScrollArea, Txt, Icon, cn } from '@mastra/playground-ui';
import { Braces } from 'lucide-react';

import { RequestContext } from './request-context';
import { RequestContextSchemaForm } from '@/domains/request-context/components/request-context-schema-form';

interface AgentTopBarControlsProps {
  requestContextSchema?: string;
}

export function AgentTopBarControls({ requestContextSchema }: AgentTopBarControlsProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 px-2 py-1.5 rounded text-sm transition-colors',
            'text-neutral3 hover:text-neutral5 hover:bg-surface3',
          )}
          title="Request Context"
        >
          <Icon size="sm">
            <Braces />
          </Icon>
          <Txt variant="ui-sm" className="text-inherit">
            Context
          </Txt>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[400px] p-0">
        <ScrollArea className="max-h-[500px]">
          <div className="p-4 space-y-4">
            <Txt variant="ui-sm" className="text-neutral3">
              Request context values are passed into experiments and test chats.
            </Txt>
            {requestContextSchema ? (
              <RequestContextSchemaForm requestContextSchema={requestContextSchema} />
            ) : (
              <RequestContext />
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
