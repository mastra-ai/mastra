import { ToolCallContentPartComponent } from '@assistant-ui/react';
import { MarkdownRenderer } from '@/chat-ui/markdown-renderer';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, LoaderCircle, ExternalLinkIcon } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ToolCallAction {
  agent: string;
  input: string;
}

// Define custom color classes with improved contrast
const purpleClasses = {
  bg: 'bg-[rgba(124,80,175,0.25)]',
  text: 'text-[rgb(180,140,230)]',
  hover: 'hover:text-[rgb(200,160,250)]',
  border: 'border-[rgba(124,80,175,0.5)]',
};

// Use a more generic type for the component to avoid TypeScript errors
export const ToolFallback: ToolCallContentPartComponent = props => {
  const { toolCallId, toolName, args, argsText, result, status } = props;
  const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>({});

  // Handle case where args or args.actions is undefined
  const actions = args?.actions || [];

  // Skip rendering if no actions
  if (actions.length === 0) {
    return null;
  }

  const toggleAgent = (agentId: string) => {
    setExpandedAgents(prev => ({
      ...prev,
      [agentId]: !prev[agentId],
    }));
  };

  // Extract URLs from result for optional linking
  const extractUrls = (text: unknown): string[] => {
    if (typeof text !== 'string') return [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };

  return (
    <div className="mb-4 w-full rounded-lg border border-gray-700 overflow-hidden shadow-md">
      {actions.map((action: any, index: number) => {
        const agentId = `${toolCallId || 'tool'}-${action.agent}-${index}`;
        const isExpanded = expandedAgents[agentId] || false;
        const urls = result ? extractUrls(result) : [];

        return (
          <div key={agentId} className={`border-b border-gray-700 ${index === actions.length - 1 ? 'border-b-0' : ''}`}>
            <div
              className="flex items-center justify-between px-4 py-3 bg-gray-900 hover:bg-gray-800 cursor-pointer"
              onClick={() => toggleAgent(agentId)}
            >
              <div className="flex items-center gap-3">
                <div className={cn('flex h-6 w-6 items-center justify-center rounded-full', purpleClasses.bg)}>
                  {status?.type === 'running' ? (
                    <LoaderCircle className={cn('h-4 w-4 animate-spin', purpleClasses.text)} />
                  ) : (
                    <CheckIcon className={cn('h-4 w-4', purpleClasses.text)} />
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-100">{action.agent?.replace('_', ' ')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('text-xs px-2 py-1 rounded-full', purpleClasses.bg, purpleClasses.text)}>
                  {status?.type === 'running' ? 'Processing...' : 'Complete'}
                </span>
                {isExpanded ? (
                  <ChevronUpIcon className="h-4 w-4 text-gray-300" />
                ) : (
                  <ChevronDownIcon className="h-4 w-4 text-gray-300" />
                )}
              </div>
            </div>

            {isExpanded && (
              <div className="px-4 py-3 bg-[#111]">
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-300 mb-1">Query:</p>
                  <div className="p-2 bg-gray-900 rounded border border-gray-700">
                    <p className="text-sm text-gray-200 whitespace-pre-wrap">{action.input}</p>
                  </div>
                </div>

                {result && (
                  <div>
                    <p className="text-xs font-semibold text-gray-300 mb-1">Result:</p>
                    <div className="p-2 bg-gray-900 rounded border border-gray-700 max-h-60 overflow-auto">
                      {typeof result === 'string' ? (
                        <div className="text-sm text-gray-200">
                          <MarkdownRenderer>{result}</MarkdownRenderer>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-200 whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</p>
                      )}
                    </div>

                    {urls.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-gray-300 mb-1">Sources:</p>
                        <div className="flex flex-wrap gap-2">
                          {urls.slice(0, 3).map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                'inline-flex items-center gap-1 text-xs hover:underline',
                                purpleClasses.text,
                                purpleClasses.hover,
                              )}
                            >
                              <span>Source {i + 1}</span>
                              <ExternalLinkIcon className="h-3 w-3" />
                            </a>
                          ))}
                          {urls.length > 3 && <span className="text-xs text-gray-400">+{urls.length - 3} more</span>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
