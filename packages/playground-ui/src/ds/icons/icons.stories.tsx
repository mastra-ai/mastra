import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon, type IconSize } from './Icon';
import {
  AgentIcon,
  AgentCoinIcon,
  AgentNetworkCoinIcon,
  AiIcon,
  ApiIcon,
  BranchIcon,
  CheckIcon,
  ChevronIcon,
  CommitIcon,
  CrossIcon,
  DbIcon,
  DebugIcon,
  DeploymentIcon,
  DividerIcon,
  DocsIcon,
  EnvIcon,
  FiltersIcon,
  FolderIcon,
  GithubCoinIcon,
  GithubIcon,
  GoogleIcon,
  HomeIcon,
  InfoIcon,
  JudgeIcon,
  LatencyIcon,
  LogsIcon,
  McpCoinIcon,
  McpServerIcon,
  MemoryIcon,
  OpenAIIcon,
  PromptIcon,
  RepoIcon,
  SettingsIcon,
  SlashIcon,
  ToolCoinIcon,
  ToolsIcon,
  TraceIcon,
  TsIcon,
  VariablesIcon,
  WorkflowCoinIcon,
  WorkflowIcon,
} from './index';
import { Sizes } from '@/ds/tokens/sizes';

const meta: Meta<typeof Icon> = {
  title: 'Icons/All Icons',
  component: Icon,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof Icon>;

const icons = [
  { name: 'AgentIcon', component: AgentIcon },
  { name: 'AgentCoinIcon', component: AgentCoinIcon },
  { name: 'AgentNetworkCoinIcon', component: AgentNetworkCoinIcon },
  { name: 'AiIcon', component: AiIcon },
  { name: 'ApiIcon', component: ApiIcon },
  { name: 'BranchIcon', component: BranchIcon },
  { name: 'CheckIcon', component: CheckIcon },
  { name: 'ChevronIcon', component: ChevronIcon },
  { name: 'CommitIcon', component: CommitIcon },
  { name: 'CrossIcon', component: CrossIcon },
  { name: 'DbIcon', component: DbIcon },
  { name: 'DebugIcon', component: DebugIcon },
  { name: 'DeploymentIcon', component: DeploymentIcon },
  { name: 'DividerIcon', component: DividerIcon },
  { name: 'DocsIcon', component: DocsIcon },
  { name: 'EnvIcon', component: EnvIcon },
  { name: 'FiltersIcon', component: FiltersIcon },
  { name: 'FolderIcon', component: FolderIcon },
  { name: 'GithubCoinIcon', component: GithubCoinIcon },
  { name: 'GithubIcon', component: GithubIcon },
  { name: 'GoogleIcon', component: GoogleIcon },
  { name: 'HomeIcon', component: HomeIcon },
  { name: 'InfoIcon', component: InfoIcon },
  { name: 'JudgeIcon', component: JudgeIcon },
  { name: 'LatencyIcon', component: LatencyIcon },
  { name: 'LogsIcon', component: LogsIcon },
  { name: 'McpCoinIcon', component: McpCoinIcon },
  { name: 'McpServerIcon', component: McpServerIcon },
  { name: 'MemoryIcon', component: MemoryIcon },
  { name: 'OpenAIIcon', component: OpenAIIcon },
  { name: 'PromptIcon', component: PromptIcon },
  { name: 'RepoIcon', component: RepoIcon },
  { name: 'SettingsIcon', component: SettingsIcon },
  { name: 'SlashIcon', component: SlashIcon },
  { name: 'ToolCoinIcon', component: ToolCoinIcon },
  { name: 'ToolsIcon', component: ToolsIcon },
  { name: 'TraceIcon', component: TraceIcon },
  { name: 'TsIcon', component: TsIcon },
  { name: 'VariablesIcon', component: VariablesIcon },
  { name: 'WorkflowCoinIcon', component: WorkflowCoinIcon },
  { name: 'WorkflowIcon', component: WorkflowIcon },
];

const IconGrid = ({ size = 'md' }: { size?: IconSize }) => (
  <div className="grid grid-cols-6 gap-4">
    {icons.map(({ name, component: IconComponent }) => (
      <div key={name} className="state-layer bg-card flex flex-col items-center gap-2 rounded-lg p-3">
        <Icon size={size} className="text-foreground">
          <IconComponent />
        </Icon>
        <span className="text-caption text-muted-foreground text-center">{name.replace('Icon', '')}</span>
      </div>
    ))}
  </div>
);

export const AllIcons: Story = {
  render: () => (
    <div className="w-200">
      <IconGrid />
    </div>
  ),
};

export const SmallIcons: Story = {
  render: () => (
    <div className="w-200">
      <IconGrid size="sm" />
    </div>
  ),
};

export const LargeIcons: Story = {
  render: () => (
    <div className="w-200">
      <IconGrid size="lg" />
    </div>
  ),
};

export const IconSizes: Story = {
  render: () => (
    <div className="flex items-end gap-8">
      {(['xs', 'sm', 'md', 'lg'] as const).map(size => (
        <div key={size} className="flex flex-col items-center gap-2">
          <Icon size={size} className="text-foreground">
            <AgentIcon />
          </Icon>
          <span className="text-caption text-muted-foreground">
            {size} · {Sizes[`icon-${size}`]}
          </span>
        </div>
      ))}
    </div>
  ),
};

export const IconColors: Story = {
  render: () => (
    <div className="flex gap-4">
      <Icon className="text-muted-foreground">
        <AgentIcon />
      </Icon>
      <Icon className="text-foreground">
        <AgentIcon />
      </Icon>
      <Icon className="text-foreground">
        <AgentIcon />
      </Icon>
      <Icon className="text-accent1">
        <AgentIcon />
      </Icon>
      <Icon className="text-accent1">
        <AgentIcon />
      </Icon>
      <Icon className="text-error">
        <AgentIcon />
      </Icon>
    </div>
  ),
};

export const AgentIcons: Story = {
  render: () => (
    <div className="flex gap-4">
      <div className="bg-card flex flex-col items-center gap-2 rounded-lg p-3">
        <Icon size="lg" className="text-foreground">
          <AgentIcon />
        </Icon>
        <span className="text-caption text-muted-foreground">Agent</span>
      </div>
      <div className="bg-card flex flex-col items-center gap-2 rounded-lg p-3">
        <Icon size="lg" className="text-foreground">
          <AgentCoinIcon />
        </Icon>
        <span className="text-caption text-muted-foreground">AgentCoin</span>
      </div>
      <div className="bg-card flex flex-col items-center gap-2 rounded-lg p-3">
        <Icon size="lg" className="text-foreground">
          <AgentNetworkCoinIcon />
        </Icon>
        <span className="text-caption text-muted-foreground">AgentNetworkCoin</span>
      </div>
    </div>
  ),
};

export const WorkflowIcons: Story = {
  render: () => (
    <div className="flex gap-4">
      <div className="bg-card flex flex-col items-center gap-2 rounded-lg p-3">
        <Icon size="lg" className="text-foreground">
          <WorkflowIcon />
        </Icon>
        <span className="text-caption text-muted-foreground">Workflow</span>
      </div>
      <div className="bg-card flex flex-col items-center gap-2 rounded-lg p-3">
        <Icon size="lg" className="text-foreground">
          <WorkflowCoinIcon />
        </Icon>
        <span className="text-caption text-muted-foreground">WorkflowCoin</span>
      </div>
    </div>
  ),
};

export const ToolIcons: Story = {
  render: () => (
    <div className="flex gap-4">
      <div className="bg-card flex flex-col items-center gap-2 rounded-lg p-3">
        <Icon size="lg" className="text-foreground">
          <ToolsIcon />
        </Icon>
        <span className="text-caption text-muted-foreground">Tools</span>
      </div>
      <div className="bg-card flex flex-col items-center gap-2 rounded-lg p-3">
        <Icon size="lg" className="text-foreground">
          <ToolCoinIcon />
        </Icon>
        <span className="text-caption text-muted-foreground">ToolCoin</span>
      </div>
    </div>
  ),
};

export const BrandIcons: Story = {
  render: () => (
    <div className="flex gap-4">
      <div className="bg-card flex flex-col items-center gap-2 rounded-lg p-3">
        <Icon size="lg" className="text-foreground">
          <GithubIcon />
        </Icon>
        <span className="text-caption text-muted-foreground">Github</span>
      </div>
      <div className="bg-card flex flex-col items-center gap-2 rounded-lg p-3">
        <Icon size="lg" className="text-foreground">
          <GithubCoinIcon />
        </Icon>
        <span className="text-caption text-muted-foreground">GithubCoin</span>
      </div>
      <div className="bg-card flex flex-col items-center gap-2 rounded-lg p-3">
        <Icon size="lg" className="text-foreground">
          <GoogleIcon />
        </Icon>
        <span className="text-caption text-muted-foreground">Google</span>
      </div>
      <div className="bg-card flex flex-col items-center gap-2 rounded-lg p-3">
        <Icon size="lg" className="text-foreground">
          <OpenAIIcon />
        </Icon>
        <span className="text-caption text-muted-foreground">OpenAI</span>
      </div>
    </div>
  ),
};
