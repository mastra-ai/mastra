'use client';

import { Badge } from '@/components/ui/badge';

export const statusColors: Record<string, string> = {
  requires_action: 'text-yellow-500 hover:text-yellow-500',
  completed: 'text-green-700 hover:text-green-700 text-white',
  failed: 'text-red-500 hover:text-red-500',
  info: 'border-none invisible',
};

export const RenderMetadata = ({ metadata }: { metadata: any }) => {
  if (metadata?.run) {
    if (Object.keys(metadata.run).length <= 2) {
      return (
        <div className="bg-mastra-bg-6 rounded-lg p-4 flex justify-between items-center">
          <div>
            <p className="text-sm font-medium text-white">Run ID: {metadata.run.id}</p>
          </div>
          <Badge className={`${statusColors[metadata.run.status]} text-sm px-3 py-1`}>{metadata.run.status}</Badge>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {metadata.run.id && <InfoItem label="Run ID" value={metadata.run.id} />}
        {metadata.run.assistant_id && <InfoItem label="Assistant ID" value={metadata.run.assistant_id} />}
        {metadata.run.thread_id && <InfoItem label="Thread ID" value={metadata.run.thread_id} />}
        {metadata.run.model && <InfoItem label="Model" value={metadata.run.model} />}
        {metadata.run.response_format && <InfoItem label="Response Format" value={metadata.run.response_format.type} />}
        {metadata.run.required_action?.type && (
          <InfoItem label="Required Action" value={metadata.run.required_action.type} />
        )}

        {metadata.run.required_action && (
          <div className="bg-mastra-bg-5 rounded-lg p-4">
            {metadata.run.required_action.submit_tool_outputs && (
              <>
                <p className="font-medium mb-1">Tool Calls:</p>
                {metadata.run.required_action.submit_tool_outputs.tool_calls.map((call: any, index: number) => (
                  <div key={index} className="bg-mastra-bg-4 rounded p-2 mb-2">
                    <p className="text-sm font-medium">{call.function.name}</p>
                    <pre className="text-xs mt-1 whitespace-pre-wrap">
                      {JSON.stringify(JSON.parse(call.function.arguments), null, 2)}
                    </pre>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        <h4 className="text-[13px] text-gray-400 mb-2">Available Tools</h4>
        <div className="flex flex-wrap gap-2">
          {metadata.run.tools.map((tool: any, index: number) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {tool.type === 'function' ? tool.function.name : tool.type}
            </Badge>
          ))}
        </div>

        <div className="bg-mastra-bg-5 rounded-lg p-4">
          <h4 className="text-lg font-semibold mb-2">Instructions</h4>
          <p className="text-sm text-gray-300 whitespace-pre-wrap">{metadata.run.instructions}</p>
        </div>
      </div>
    );
  } else if (metadata?.tool) {
    return (
      <div className="space-y-4">
        <InfoItem label="Tool ID" value={metadata.tool.id} />
        <InfoItem label="Tool call" value="function" />
        <InfoItem label="Function" value={metadata.tool.fn} />
        <h4 className="text-[13px] text-gray-400 mb-2">Available Tools</h4>
        <div className="flex flex-wrap gap-2">
          {metadata.tool.availableTools.map((tool: string, index: number) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {tool}
            </Badge>
          ))}
        </div>
      </div>
    );
  } else if (metadata?.args) {
    return (
      <div className="bg-mastra-bg-6 rounded-lg p-6 space-y-6">
        <div className="flex justify-between items-start">
          <h3 className="text-xl font-bold text-white mb-2">Tool Arguments</h3>
          <Badge variant="outline" className="bg-cyan-600 text-white">
            Args
          </Badge>
        </div>
        <div className="bg-mastra-bg-5 rounded-lg p-4">
          <pre className="text-sm text-gray-300 whitespace-pre-wrap overflow-x-auto">
            {JSON.stringify(metadata.args, null, 2)}
          </pre>
        </div>
      </div>
    );
  } else if (metadata?.output) {
    return (
      <div className="bg-mastra-bg-3 rounded-lg p-4">
        <pre className="text-sm text-gray-300 whitespace-pre-wrap overflow-x-auto">
          {JSON.stringify(metadata.output, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="bg-mastra-bg-6 rounded-lg p-4">
      <p className="text-sm text-gray-400">Unknown metadata type</p>
    </div>
  );
};

export const InfoItem = ({ label, value }: { label: string; value: string }) => (
  <div className="flex text-[13px] justify-between">
    <p className="text-gray-400">{label}</p>
    <p className="font-light text-gray-300 truncate">{value}</p>
  </div>
);
