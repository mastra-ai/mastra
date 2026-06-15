import { Button, Popover, PopoverContent, PopoverTrigger, ScrollArea, Txt } from '@mastra/playground-ui';
import { Braces } from 'lucide-react';

import { RequestContext } from './request-context';
import { RequestContextSchemaForm } from '@/domains/request-context/components/request-context-schema-form';

interface ComposerRequestContextProps {
  requestContextSchema?: string;
}

/**
 * Composer popover for editing the request context sent with each run.
 * Requires SchemaRequestContextProvider when a schema is present.
 */
export function ComposerRequestContext({ requestContextSchema }: ComposerRequestContextProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="default"
          size="icon-md"
          type="button"
          tooltip="Request context"
          data-testid="composer-request-context-trigger"
        >
          <Braces className="h-5 w-5 text-neutral3 hover:text-neutral6" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[400px] p-0">
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
