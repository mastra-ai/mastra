import {
  Button,
  ButtonWithTooltip,
  DocsIcon,
  HeaderAction,
  Icon,
  MainContentContent,
  useLinkComponent,
  useIsCmsAvailable,
  useStoredPromptBlocks,
  Header,
  HeaderTitle,
  MainContentLayout,
  PromptBlocksTable,
  PromptsList,
  ListSearch,
  MainHeader,
  EntityListPageLayout,
} from '@mastra/playground-ui';
import { BookIcon, FileTextIcon, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useExperimentalUI } from '@/domains/experimental-ui/use-experimental-ui';

export default function PromptBlocks() {
  const { Link: FrameworkLink, paths } = useLinkComponent();
  const { data, isLoading } = useStoredPromptBlocks();
  const { isCmsAvailable } = useIsCmsAvailable();
  const { variant } = useExperimentalUI('entity-list-page');
  const [search, setSearch] = useState('');

  const promptBlocks = data?.promptBlocks ?? [];

  if (variant === 'new-proposal') {
    return (
      <EntityListPageLayout>
        <EntityListPageLayout.Top>
          <MainHeader withMargins={false}>
            <MainHeader.Column>
              <MainHeader.Title isLoading={isLoading}>
                <FileTextIcon /> Prompts
              </MainHeader.Title>
            </MainHeader.Column>
            <MainHeader.Column className="flex justify-end gap-2">
              <ButtonWithTooltip
                as="a"
                href="https://mastra.ai/en/docs/agents/agent-instructions#prompt-blocks"
                target="_blank"
                rel="noopener noreferrer"
                tooltipContent="Go to Prompts documentation"
              >
                <BookIcon />
              </ButtonWithTooltip>
              {isCmsAvailable && (
                <Button as={Link} to={paths.cmsPromptBlockCreateLink()} variant="primary">
                  <Plus />
                  Create Prompt
                </Button>
              )}
            </MainHeader.Column>
          </MainHeader>
          <div className="max-w-[30rem]">
            <ListSearch onSearch={setSearch} label="Filter prompts" placeholder="Filter by name or description" />
          </div>
        </EntityListPageLayout.Top>

        <PromptsList promptBlocks={promptBlocks} isLoading={isLoading} search={search} onSearch={setSearch} />
      </EntityListPageLayout>
    );
  }

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
            as={Link}
            to="https://mastra.ai/en/docs/agents/agent-instructions#prompt-blocks"
            target="_blank"
            variant="ghost"
            size="md"
          >
            <DocsIcon />
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
