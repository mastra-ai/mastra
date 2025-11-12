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
  ToolCombobox,
} from '@mastra/playground-ui';

const Tool = () => {
  const { toolId } = useParams();

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
            <ToolCombobox value={toolId} />
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
