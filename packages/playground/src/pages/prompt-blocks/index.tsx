import {
  Button,
  DocsIcon,
  HeaderAction,
  Icon,
  MainContentContent,
  useLinkComponent,
  useIsCmsAvailable,
  useStoredPromptBlocks,
} from '@mastra/playground-ui';
import { Header, HeaderTitle, MainContentLayout, PromptBlocksTable } from '@mastra/playground-ui';
import { FileTextIcon, Plus } from 'lucide-react';
import { Link } from 'react-router';

export default function PromptBlocks() {
  const { Link: FrameworkLink, paths } = useLinkComponent();
  const { data, isLoading } = useStoredPromptBlocks();
  const { isCmsAvailable } = useIsCmsAvailable();

  const promptBlocks = data?.promptBlocks ?? [];

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <FileTextIcon />
          </Icon>
          Prompts
        </HeaderTitle>

        <HeaderAction>
          {isCmsAvailable && (
            <Button variant="light" as={FrameworkLink} to={paths.cmsPromptBlockCreateLink()}>
              <Icon>
                <Plus />
              </Icon>
              Create a prompt block
            </Button>
          )}
          <Button
            variant="outline"
            as={Link}
            to="https://mastra.ai/en/docs/agents/agent-instructions#prompt-blocks"
            target="_blank"
          >
            <Icon>
              <DocsIcon />
            </Icon>
            Documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={!isLoading && promptBlocks.length === 0}>
        <PromptBlocksTable isLoading={isLoading} promptBlocks={promptBlocks} />
      </MainContentContent>
    </MainContentLayout>
  );
}
