import { BookIcon } from 'lucide-react';

import {
  useLinkComponent,
  PromptBlockCreateContent,
  MainContentLayout,
  Header,
  HeaderTitle,
  Icon,
} from '@mastra/playground-ui';

function CmsPromptBlocksCreatePage() {
  const { navigate, paths } = useLinkComponent();

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <BookIcon />
          </Icon>
          Create a prompt block
        </HeaderTitle>
      </Header>
      <PromptBlockCreateContent onSuccess={block => navigate(paths.cmsPromptBlockEditLink(block.id))} />
    </MainContentLayout>
  );
}

export { CmsPromptBlocksCreatePage };

export default CmsPromptBlocksCreatePage;
