import {
  MainContentLayout,
  Header,
  HeaderTitle,
  HeaderAction,
  Icon,
  Button,
  DocsIcon,
  PageHeader,
  SkillsTable,
  useSkills,
  SearchSkillsPanel,
  useSearchSkills,
} from '@mastra/playground-ui';

import { Link } from 'react-router';
import { Wand2, Search } from 'lucide-react';
import { useState } from 'react';

export default function Skills() {
  const { data, isLoading } = useSkills();
  const searchSkills = useSearchSkills();
  const [showSearch, setShowSearch] = useState(false);

  const skills = data?.skills ?? [];
  const isSkillsConfigured = data?.isSkillsConfigured ?? false;

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <Wand2 className="h-4 w-4" />
          </Icon>
          Skills
        </HeaderTitle>

        <HeaderAction>
          {isSkillsConfigured && skills.length > 0 && (
            <Button variant="light" onClick={() => setShowSearch(!showSearch)}>
              <Icon>
                <Search className="h-4 w-4" />
              </Icon>
              Search
            </Button>
          )}
          <Button as={Link} to="https://mastra.ai/en/docs/skills/overview" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            Documentation
          </Button>
        </HeaderAction>
      </Header>

      <div className="grid overflow-y-auto h-full">
        <div className="max-w-[100rem] px-[3rem] mx-auto grid content-start gap-6 h-full w-full">
          <PageHeader
            title="Skills"
            description="Manage agent skills following the Agent Skills specification"
            icon={<Wand2 />}
          />

          {/* Search Panel */}
          {showSearch && isSkillsConfigured && (
            <div className="border border-border1 rounded-lg p-4 bg-surface2">
              <SearchSkillsPanel
                onSearch={params => searchSkills.mutate(params)}
                results={searchSkills.data?.results ?? []}
                isSearching={searchSkills.isPending}
              />
            </div>
          )}

          <SkillsTable skills={skills} isLoading={isLoading} isSkillsConfigured={isSkillsConfigured} />
        </div>
      </div>
    </MainContentLayout>
  );
}
