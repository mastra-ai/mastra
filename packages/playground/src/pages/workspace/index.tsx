import { useState } from 'react';
import {
  MainContentLayout,
  Header,
  HeaderTitle,
  HeaderAction,
  Icon,
  Button,
  DocsIcon,
  PageHeader,
  useWorkspaceInfo,
  useWorkspaceFiles,
  useWorkspaceSkills,
  useSearchWorkspace,
  useSearchWorkspaceSkills,
  useDeleteWorkspaceFile,
  useCreateWorkspaceDirectory,
  FileBrowser,
  FileViewer,
  SkillsTable,
  SearchWorkspacePanel,
  SearchSkillsPanel,
  WorkspaceNotConfigured,
  useWorkspaceFile,
} from '@mastra/playground-ui';

import { Link } from 'react-router';
import { Folder, FileText, Wand2, Search } from 'lucide-react';

type TabType = 'files' | 'skills';

export default function Workspace() {
  const [activeTab, setActiveTab] = useState<TabType>('files');
  const [showSearch, setShowSearch] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Workspace info
  const { data: workspaceInfo, isLoading: isLoadingInfo } = useWorkspaceInfo();

  // Files
  const {
    data: filesData,
    isLoading: isLoadingFiles,
    refetch: refetchFiles,
  } = useWorkspaceFiles(currentPath, {
    enabled: workspaceInfo?.isWorkspaceConfigured && workspaceInfo?.capabilities?.hasFilesystem,
  });
  const deleteFile = useDeleteWorkspaceFile();
  const createDirectory = useCreateWorkspaceDirectory();
  const searchWorkspace = useSearchWorkspace();

  // Selected file content
  const { data: fileContent, isLoading: isLoadingFileContent } = useWorkspaceFile(selectedFile ?? '', {
    enabled: !!selectedFile,
  });

  // Skills
  const { data: skillsData, isLoading: isLoadingSkills } = useWorkspaceSkills();
  const searchSkills = useSearchWorkspaceSkills();

  const isWorkspaceConfigured = workspaceInfo?.isWorkspaceConfigured ?? false;
  const hasFilesystem = workspaceInfo?.capabilities?.hasFilesystem ?? false;
  const hasSkills = workspaceInfo?.capabilities?.hasSkills ?? false;
  const canBM25 = workspaceInfo?.capabilities?.canBM25 ?? false;
  const canVector = workspaceInfo?.capabilities?.canVector ?? false;

  const skills = skillsData?.skills ?? [];
  const isSkillsConfigured = skillsData?.isSkillsConfigured ?? false;
  const files = filesData?.entries ?? [];

  // If workspace is not configured, show the not configured message
  if (!isLoadingInfo && !isWorkspaceConfigured) {
    return (
      <MainContentLayout>
        <Header>
          <HeaderTitle>
            <Icon>
              <Folder className="h-4 w-4" />
            </Icon>
            Workspace
          </HeaderTitle>

          <HeaderAction>
            <Button as={Link} to="https://mastra.ai/en/docs/workspace/overview" target="_blank">
              <Icon>
                <DocsIcon />
              </Icon>
              Documentation
            </Button>
          </HeaderAction>
        </Header>

        <div className="grid overflow-y-auto h-full">
          <div className="max-w-[100rem] px-[3rem] mx-auto grid content-start h-full w-full">
            <PageHeader
              title="Workspace"
              description="Manage files, skills, and search your workspace"
              icon={<Folder />}
            />
            <WorkspaceNotConfigured />
          </div>
        </div>
      </MainContentLayout>
    );
  }

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <Folder className="h-4 w-4" />
          </Icon>
          Workspace
        </HeaderTitle>

        <HeaderAction>
          {(hasFilesystem || hasSkills) && (
            <Button variant="light" onClick={() => setShowSearch(!showSearch)}>
              <Icon>
                <Search className="h-4 w-4" />
              </Icon>
              Search
            </Button>
          )}
          <Button as={Link} to="https://mastra.ai/en/docs/workspace/overview" target="_blank">
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
            title="Workspace"
            description="Manage files, skills, and search your workspace"
            icon={<Folder />}
          />

          {/* Search Panel */}
          {showSearch && (
            <div className="border border-border1 rounded-lg p-4 bg-surface2 space-y-4">
              {hasFilesystem && (canBM25 || canVector) && (
                <div>
                  <h3 className="text-sm font-medium text-icon5 mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Search Files
                  </h3>
                  <SearchWorkspacePanel
                    onSearch={params => searchWorkspace.mutate(params)}
                    isSearching={searchWorkspace.isPending}
                    searchResults={searchWorkspace.data}
                    canBM25={canBM25}
                    canVector={canVector}
                    onViewResult={id => setSelectedFile(id)}
                  />
                </div>
              )}

              {hasSkills && isSkillsConfigured && skills.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-icon5 mb-3 flex items-center gap-2">
                    <Wand2 className="h-4 w-4" />
                    Search Skills
                  </h3>
                  <SearchSkillsPanel
                    onSearch={params => searchSkills.mutate(params)}
                    results={searchSkills.data?.results ?? []}
                    isSearching={searchSkills.isPending}
                  />
                </div>
              )}
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-border1">
            {hasFilesystem && (
              <button
                onClick={() => setActiveTab('files')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'files' ? 'border-accent1 text-icon6' : 'border-transparent text-icon4 hover:text-icon5'
                }`}
              >
                <FileText className="h-4 w-4" />
                Files
              </button>
            )}
            {hasSkills && (
              <button
                onClick={() => setActiveTab('skills')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'skills'
                    ? 'border-accent1 text-icon6'
                    : 'border-transparent text-icon4 hover:text-icon5'
                }`}
              >
                <Wand2 className="h-4 w-4" />
                Skills
                {isSkillsConfigured && skills.length > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-surface4 text-icon4">{skills.length}</span>
                )}
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="pb-8">
            {activeTab === 'files' && hasFilesystem && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <FileBrowser
                    entries={files}
                    currentPath={currentPath}
                    isLoading={isLoadingFiles}
                    onNavigate={setCurrentPath}
                    onFileSelect={setSelectedFile}
                    onRefresh={() => refetchFiles()}
                    onCreateDirectory={path => createDirectory.mutate({ path })}
                    onDelete={path => deleteFile.mutate({ path, recursive: true, force: true })}
                  />
                  {selectedFile && (
                    <FileViewer
                      path={selectedFile}
                      content={fileContent?.content ?? ''}
                      isLoading={isLoadingFileContent}
                      mimeType={fileContent?.mimeType}
                      onClose={() => setSelectedFile(null)}
                    />
                  )}
                </div>
              </div>
            )}

            {activeTab === 'skills' && hasSkills && (
              <SkillsTable
                skills={skills}
                isLoading={isLoadingSkills}
                isSkillsConfigured={isSkillsConfigured}
                basePath="/workspace/skills"
              />
            )}

            {/* Show default tab if only one is available */}
            {!hasFilesystem && !hasSkills && (
              <div className="py-12 text-center text-icon4">
                <p>No workspace capabilities are configured.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainContentLayout>
  );
}
