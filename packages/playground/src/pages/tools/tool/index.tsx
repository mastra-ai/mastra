import { Breadcrumb, Button, Crumb, DocsIcon, Header, HeaderAction, Icon, ToolsIcon } from '@mastra/playground-ui';
import { Link, useParams } from 'react-router';
import { ToolCombobox } from '@/domains/tools/components/tool-combobox';
import { ToolPanel } from '@/domains/tools/components/ToolPanel';

const Tool = () => {
  const { toolId } = useParams();

  return (
    <div className="h-full w-full overflow-y-hidden">
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/tools`}>
            <Icon>
              <ToolsIcon />
            </Icon>
            Tools
          </Crumb>
          <Crumb as="span" to="" isCurrent>
            <ToolCombobox value={toolId} variant="ghost" />
          </Crumb>
        </Breadcrumb>

        <HeaderAction>
          <Button as={Link} to="https://mastra.ai/docs/agents/using-tools" target="_blank" variant="ghost" size="md">
            <DocsIcon />
            Tools documentation
          </Button>
        </HeaderAction>
      </Header>

      <ToolPanel toolId={toolId!} />
    </div>
  );
};

export default Tool;
