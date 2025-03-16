import { Button } from '@/components/ui/button';
import { ToolCallContentPartComponent } from '@assistant-ui/react';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, LoaderCircle } from 'lucide-react';
import { useState } from 'react';

export const ToolFallback: ToolCallContentPartComponent = ({ toolName, argsText, result, status, ...rest }) => {
  console.log(rest);
  const [isCollapsed, setIsCollapsed] = useState(true);

  if (toolName === 'getNetworkState' && status.type === 'complete') {
    return null;
  }

  return (
    <div className="mb-4 flex w-full flex-col rounded-lg border">
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="flex w-full gap-2 items-center">
          <div className="flex items-center justify-center">
            {status.type === 'running' ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {status.type === 'complete' ? <CheckIcon className="size-4" /> : null}
          </div>
          <div>
            <p className="text-sm">
              <b>{toolName}</b> {status.type === 'running' ? 'running' : 'complete'}
            </p>
          </div>
        </div>
        <div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsCollapsed(!isCollapsed)}>
            {isCollapsed ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      {!isCollapsed && (
        <div className="flex flex-col gap-2 border-t px-4 py-3">
          <div>
            <pre className="whitespace-pre-wrap text-xs">{JSON.parse(argsText).message}</pre>
          </div>
          {result !== undefined && (
            <div className="border-t border-dashed pt-3">
              <p className="font-semibold text-xs">Result:</p>
              <pre className="whitespace-pre-wrap text-xs max-h-40 overflow-auto rounded border border-gray-200 p-2">
                {typeof result === 'string' ? JSON.parse(result).message : result.message}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
