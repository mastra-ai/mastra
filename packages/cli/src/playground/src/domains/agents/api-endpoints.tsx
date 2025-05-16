import { useCodemirrorTheme } from '@/components/syntax-highlighter';
import CodeMirror from '@uiw/react-codemirror';

import { Badge, Txt } from '@mastra/playground-ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState, useMemo } from 'react';
import clsx from 'clsx';

import { typescriptLanguage } from '@codemirror/lang-javascript';
import { useOpenApi } from './hooks/use-open-api';

import { openApiToJs } from './utils/openapi-to-js';
import { getApiEndpoints } from './utils/get-api-endpoints';
import { ApiEndpoint } from '@/types';
import { CopyIcon } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

export interface ApiEndpointsProps {
  agentId: string;
}

export const ApiEndpoints = ({ agentId }: ApiEndpointsProps) => {
  const { data: openApi, isLoading } = useOpenApi();

  const allEndpoints = getApiEndpoints(openApi?.paths || {});
  if (isLoading) return <div>Loading...</div>;
  if (!allEndpoints.length) return <div>No endpoints found</div>;

  return <ApiEndpointsInner endpoints={allEndpoints} agentId={agentId} />;
};

const ApiEndpointsInner = ({ endpoints, agentId }: { endpoints: ApiEndpoint[]; agentId: string }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onlyAgents = useMemo(
    () =>
      endpoints.filter(endpoint => endpoint.tags.includes('agents')).sort((a, b) => a.method.localeCompare(b.method)),
    [endpoints],
  );
  const selectedEndpoint = onlyAgents[selectedIndex];

  const { handleCopy } = useCopyToClipboard({ text: selectedEndpoint.endpoint });

  return (
    <div className="grid grid-cols-[260px_1fr] gap-4">
      <div className="border-r-sm border-border1 pr-5 py-5 max-h-[50vh] overflow-y-auto">
        <ul className="space-y-[2px]">
          {onlyAgents.map((endpoint, index) => {
            const variantFromMethod = endpoint.method === 'get' ? 'success' : 'info';
            return (
              <li key={`${endpoint.endpoint}-${endpoint.method}`}>
                <button
                  className={clsx(
                    'py-2 pl-2 pr-4 text-icon3 rounded-lg hover:bg-surface4 block w-full text-left hover:text-icon6 flex gap-2',
                    selectedIndex === index && 'bg-surface4 text-icon6',
                  )}
                  onClick={() => setSelectedIndex(index)}
                >
                  <Badge variant={variantFromMethod}>{endpoint.method.toUpperCase()}</Badge>
                  <Txt>{endpoint.description}</Txt>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="py-5 [&_pre]:border-none">
        <Txt as="h2" variant="header-md" className="text-icon6">
          {selectedEndpoint.description}
        </Txt>
        <div className="flex flex-row gap-2 items-center pb-4">
          <Txt as="p" variant="ui-md" className="text-icon3">
            {selectedEndpoint.method.toUpperCase()} {selectedEndpoint.endpoint}
          </Txt>

          <button className="text-icon3 hover:text-icon6" onClick={handleCopy}>
            <CopyIcon className="w-3 h-3" />
          </button>
        </div>

        <Codeblock code={openApiToJs(selectedEndpoint, { agentId, resourceid: agentId, resourceId: agentId })} />
      </div>
    </div>
  );
};

interface CodeblockProps {
  code: string;
}

const Codeblock = ({ code }: CodeblockProps) => {
  const codeMirrorTheme = useCodemirrorTheme();
  const [selectedTab, setSelectedTab] = useState('js');
  const { handleCopy } = useCopyToClipboard({ text: code });

  return (
    <Tabs value={selectedTab} onValueChange={setSelectedTab} className="bg-surface4 rounded-lg py-2">
      <TabsList className="border-b border-border1 px-4 flex justify-between">
        <TabsTrigger
          value="js"
          className={clsx(
            'pb-2 text-ui-sm text-icon3 border-b border-transparent px-2',
            selectedTab === 'js' && 'text-icon6 border-b-sm border-icon6',
          )}
        >
          JavaScript
        </TabsTrigger>

        <button className="text-icon3 hover:text-icon6" onClick={handleCopy}>
          <CopyIcon className="w-3 h-3" />
        </button>
      </TabsList>
      <div className="px-4">
        <TabsContent value="js">
          <CodeMirror value={code} theme={codeMirrorTheme} extensions={[typescriptLanguage]} />
        </TabsContent>
      </div>
    </Tabs>
  );
};
