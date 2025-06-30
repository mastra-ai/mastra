import { FolderIcon, AgentIcon, ToolsIcon, WorkflowIcon } from '@/ds/icons';
import { Txt } from '@/ds/components/Txt';
import { PanelLayout, CodeMirrorBlock } from '@/components/ui/elements';
import { Badge } from '@/ds/components/Badge';
import { CopyButton } from '@/components/ui/copy-button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export const ToolIconMap = {
  agent: AgentIcon,
  workflow: WorkflowIcon,
  tool: ToolsIcon,
};

type AgentPanelProps = {
  className?: string;
  style?: React.CSSProperties;
  Link?: any;
  server?: any; // Replace with actual agent type
  sseUrl?: string;
  httpStreamUrl?: string;
  linkComponent?: React.ComponentType<any>;
};

export function McpsPanel({ server, sseUrl, httpStreamUrl, className, style, Link }: AgentPanelProps) {
  if (!server || !sseUrl || !httpStreamUrl) {
    return null;
  }

  return (
    <PanelLayout>
      <div className="px-8 py-20 mx-auto max-w-[604px] w-full">
        <Txt as="h1" variant="header-md" className="text-icon6 font-medium pb-4">
          {server.name}
        </Txt>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <Badge
              icon={<span className="font-mono w-6 text-accent1 text-ui-xs font-medium">SSE</span>}
              className="!text-icon4"
            >
              {sseUrl}
            </Badge>
            <CopyButton content={sseUrl} />
          </div>

          <div className="flex items-center gap-1">
            <Badge
              icon={<span className="font-mono w-6 text-accent1 text-ui-xs font-medium">HTTP</span>}
              className="!text-icon4"
            >
              {httpStreamUrl}
            </Badge>
            <CopyButton content={httpStreamUrl} />
          </div>
        </div>

        <div className="flex items-center gap-1 pt-3 pb-9">
          <Badge icon={<FolderIcon className="text-icon6" />} className="rounded-r-sm !text-icon4">
            Version
          </Badge>

          <Badge className="rounded-l-sm !text-icon4">{server.version_detail.version}</Badge>
        </div>

        <McpSetupTabs sseUrl={sseUrl} serverName={server.name} />
      </div>
    </PanelLayout>
  );
}

const McpSetupTabs = ({ sseUrl, serverName }: { sseUrl: string; serverName: string }) => {
  const [tab, setTab] = useState('cursor');
  const tabTriggerClass = 'p-3 text-ui-lg text-icon3 font-medium border-b-2 border-transparent -mb-[0.5px]';

  return (
    <Tabs onValueChange={setTab} value={tab}>
      <TabsList className="border-b-sm border-border1 w-full">
        <TabsTrigger value="cursor" className={cn(tabTriggerClass, tab === 'cursor' && 'text-icon6 border-b-icon6')}>
          Cursor
        </TabsTrigger>
        <TabsTrigger
          value="windsurf"
          className={cn(tabTriggerClass, tab === 'windsurf' && 'text-icon6 border-b-icon6')}
        >
          Windsurf
        </TabsTrigger>
      </TabsList>

      <TabsContent value="cursor" className="pt-5">
        <Txt className="text-icon3 pb-4">
          Cursor comes with built-in MCP Support.{' '}
          <a
            href="https://docs.cursor.com/context/model-context-protocol"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-icon6"
          >
            Following the documentation
          </a>
          , you can register an MCP server using SSE with the following configuration.
        </Txt>

        <CodeMirrorBlock
          editable={false}
          value={`{
  "mcpServers": {
    "${serverName}": {
      "url": "${sseUrl}"
    }
  }
}`}
        />
      </TabsContent>
      <TabsContent value="windsurf" className="pt-5">
        <Txt className="text-icon3 pb-4">
          Windsurf comes with built-in MCP Support.{' '}
          <a
            href="https://docs.windsurf.com/windsurf/cascade/mcp#mcp-config-json"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-icon6"
          >
            Following the documentation
          </a>
          , you can register an MCP server using SSE with the following configuration.
        </Txt>

        <CodeMirrorBlock
          editable={false}
          value={`{
  "mcpServers": {
    "${serverName}": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${sseUrl}"]
    }
  }
}`}
        />
      </TabsContent>
    </Tabs>
  );
};
