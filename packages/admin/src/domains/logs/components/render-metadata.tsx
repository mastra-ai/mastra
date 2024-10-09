'use client';

import { formatDistanceToNow } from 'date-fns';

import { Badge } from '@/components/ui/badge';

export const statusColors: Record<string, string> = {
  requires_action: 'bg-yellow-500 hover:bg-yellow-500 text-black',
  completed: 'bg-green-700 hover:bg-green-700 text-white',
  failed: 'bg-red-500 hover:bg-red-500 text-white',
  info: 'border-none invisible',
};

export const RenderMetadata = ({ metadata }: { metadata: any }) => {
  if (metadata.run) {
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

    const createdAt = new Date(metadata.run.created_at * 1000);
    const formattedTime = formatDistanceToNow(createdAt, { addSuffix: true });

    return (
      <div className="bg-mastra-bg-6 rounded-lg p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">{metadata.run.object}</h3>
            <p className="text-gray-400 text-sm">{formattedTime}</p>
          </div>
          <Badge className={`${statusColors[metadata.run.status]} text-sm px-3 py-1`}>{metadata.run.status}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <InfoItem label="Run ID" value={metadata.run.id} />
          <InfoItem label="Assistant ID" value={metadata.run.assistant_id} />
          <InfoItem label="Thread ID" value={metadata.run.thread_id} />
          <InfoItem label="Model" value={metadata.run.model} />
        </div>

        {metadata.run.response_format && (
          <div className="bg-mastra-bg-5 rounded-lg p-4 flex items-center justify-between">
            <h4 className="text-lg font-semibold">Response Format</h4>
            <Badge variant="outline" className="text-sm px-3 py-1 bg-mastra-bg-4 text-white">
              {metadata.run.response_format.type}
            </Badge>
          </div>
        )}

        {metadata.run.required_action && (
          <div className="bg-mastra-bg-5 rounded-lg p-4">
            <h4 className="text-lg font-semibold mb-2">Required Action</h4>
            <p className="text-yellow-400 mb-2">{metadata.run.required_action.type}</p>
            {metadata.run.required_action.submit_tool_outputs && (
              <div>
                <p className="font-medium mb-1">Tool Calls:</p>
                {metadata.run.required_action.submit_tool_outputs.tool_calls.map((call: any, index: number) => (
                  <div key={index} className="bg-mastra-bg-4 rounded p-2 mb-2">
                    <p className="text-sm font-medium">{call.function.name}</p>
                    <pre className="text-xs mt-1 overflow-x-auto">
                      {JSON.stringify(JSON.parse(call.function.arguments), null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="bg-mastra-bg-5 rounded-lg p-4">
          <h4 className="text-lg font-semibold mb-2">Instructions</h4>
          <p className="text-sm text-gray-300 whitespace-pre-wrap">{metadata.run.instructions}</p>
        </div>

        <div className="bg-mastra-bg-5 rounded-lg p-4">
          <h4 className="text-lg font-semibold mb-2">Available Tools</h4>
          <div className="flex flex-wrap gap-2">
            {metadata.run.tools.map((tool: any, index: number) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tool.type === 'function' ? tool.function.name : tool.type}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    );
  } else if (metadata.tool) {
    return (
      <div className="bg-mastra-bg-6 rounded-lg p-6 space-y-6">
        <div className="flex justify-between items-start">
          <h3 className="text-xl font-bold text-white mb-2">Tool Call</h3>
          <Badge variant="outline" className="bg-purple-600 text-white">
            Function
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <InfoItem label="Tool ID" value={metadata.tool.id} />
          <InfoItem label="Function" value={metadata.tool.fn} />
        </div>

        <div className="bg-mastra-bg-5 rounded-lg p-4">
          <h4 className="text-lg font-semibold mb-2">Available Tools</h4>
          <div className="flex flex-wrap gap-2">
            {metadata.tool.availableTools.map((tool: string, index: number) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tool}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    );
  } else if (metadata.args) {
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
  } else if (metadata.output) {
    return (
      <div className="bg-mastra-bg-6 rounded-lg p-6 space-y-6">
        <div className="flex justify-between items-start">
          <h3 className="text-xl font-bold text-white mb-2">Tool Output</h3>
          <Badge variant="outline" className="bg-green-600 text-white">
            Output
          </Badge>
        </div>
        <div className="bg-mastra-bg-5 rounded-lg p-4">
          <pre className="text-sm text-gray-300 whitespace-pre-wrap overflow-x-auto">
            {JSON.stringify(metadata.output, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-mastra-bg-6 rounded-lg p-4">
      <p className="text-sm text-gray-400">Unknown metadata type</p>
    </div>
  );
};
const InfoItem = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-gray-400 text-xs mb-1">{label}</p>
    <p className="text-sm font-medium text-white truncate">{value}</p>
  </div>
);
