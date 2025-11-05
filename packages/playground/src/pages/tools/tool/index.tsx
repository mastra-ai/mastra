import { useMemo } from 'react';
import { Link, useParams } from 'react-router';

import {
  Header,
  Breadcrumb,
  Crumb,
  Icon,
  ToolsIcon,
  HeaderAction,
  Button,
  DocsIcon,
  ToolPanel,
  HeaderGroup,
  Combobox,
  useTools,
  useAgents,
  useLinkComponent,
} from '@mastra/playground-ui';

const Tool = () => {
  const { toolId } = useParams();
  const { navigate, paths } = useLinkComponent();
  const { data: tools = {} } = useTools();
  const { data: agents = {} } = useAgents();

  const toolOptions = useMemo(() => {
    const allTools = new Map<string, { id: string }>();

    // Get tools from agents
    Object.values(agents).forEach(agent => {
      if (agent.tools) {
        Object.values(agent.tools).forEach(tool => {
          if (!allTools.has(tool.id)) {
            allTools.set(tool.id, tool);
          }
        });
      }
    });

    // Get standalone/discovered tools
    Object.values(tools).forEach(tool => {
      if (!allTools.has(tool.id)) {
        allTools.set(tool.id, tool);
      }
    });

    return Array.from(allTools.values()).map(tool => ({
      label: tool.id,
      value: tool.id,
    }));
  }, [tools, agents]);

  const handleToolChange = (newToolId: string) => {
    if (newToolId && newToolId !== toolId) {
      navigate(paths.toolLink(newToolId));
    }
  };

  return (
    <div className="h-full w-full overflow-y-hidden">
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/tools`} isCurrent>
            <Icon>
              <ToolsIcon />
            </Icon>
            Tools
          </Crumb>
        </Breadcrumb>

        <HeaderGroup>
          <div className="w-[240px]">
            <Combobox
              options={toolOptions}
              value={toolId}
              onValueChange={handleToolChange}
              placeholder="Select a tool..."
              searchPlaceholder="Search tools..."
              emptyText="No tools found."
              buttonClassName="h-8"
            />
          </div>
        </HeaderGroup>

        <HeaderAction>
          <Button as={Link} to="https://mastra.ai/en/docs/agents/using-tools-and-mcp" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            Tools documentation
          </Button>
        </HeaderAction>
      </Header>

      <ToolPanel toolId={toolId!} />
    </div>
  );
};

export default Tool;
