import type { Meta, StoryObj } from '@storybook/react-vite';
import { Bell, Check, ChevronDown, Copy, Folder, Play, Plus, Search, Settings, Trash2, X } from 'lucide-react';
import { Icon } from './Icon';
import type { IconSize } from './Icon';
import {
  AgentIcon,
  AgentCoinIcon,
  AgentNetworkCoinIcon,
  AiIcon,
  ApiIcon,
  BranchIcon,
  CheckIcon,
  ClaudeIcon,
  ChevronIcon,
  CommitIcon,
  CrossIcon,
  DbIcon,
  DebugIcon,
  DeepSeekIcon,
  DeploymentIcon,
  DividerIcon,
  DocsIcon,
  EnvIcon,
  FiltersIcon,
  FolderIcon,
  GeminiIcon,
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
  MetaIcon,
  MemoryIcon,
  MinimaxIcon,
  MistralIcon,
  MoonshotIcon,
  NvidiaIcon,
  OpenAIIcon,
  OpenRouterIcon,
  PromptIcon,
  QwenIcon,
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
  XaiIcon,
  ZaiIcon,
} from './index';
import { Button } from '@/ds/components/Button';
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
      <div key={name} className="state-layer flex flex-col items-center gap-2 rounded-lg bg-card p-3">
        <Icon size={size} className="text-foreground">
          <IconComponent />
        </Icon>
        <span className="text-center text-caption text-muted-foreground">{name.replace('Icon', '')}</span>
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
      <Icon className="text-success-indicator">
        <AgentIcon />
      </Icon>
      <Icon className="text-success-indicator">
        <AgentIcon />
      </Icon>
      <Icon className="text-destructive-foreground">
        <AgentIcon />
      </Icon>
    </div>
  ),
};

export const AgentIcons: Story = {
  render: () => (
    <div className="flex gap-4">
      <div className="flex flex-col items-center gap-2 rounded-lg bg-card p-3">
        <Icon size="lg" className="text-foreground">
          <AgentIcon />
        </Icon>
        <span className="text-caption text-muted-foreground">Agent</span>
      </div>
      <div className="flex flex-col items-center gap-2 rounded-lg bg-card p-3">
        <Icon size="lg" className="text-foreground">
          <AgentCoinIcon />
        </Icon>
        <span className="text-caption text-muted-foreground">AgentCoin</span>
      </div>
      <div className="flex flex-col items-center gap-2 rounded-lg bg-card p-3">
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
      <div className="flex flex-col items-center gap-2 rounded-lg bg-card p-3">
        <Icon size="lg" className="text-foreground">
          <WorkflowIcon />
        </Icon>
        <span className="text-caption text-muted-foreground">Workflow</span>
      </div>
      <div className="flex flex-col items-center gap-2 rounded-lg bg-card p-3">
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
      <div className="flex flex-col items-center gap-2 rounded-lg bg-card p-3">
        <Icon size="lg" className="text-foreground">
          <ToolsIcon />
        </Icon>
        <span className="text-caption text-muted-foreground">Tools</span>
      </div>
      <div className="flex flex-col items-center gap-2 rounded-lg bg-card p-3">
        <Icon size="lg" className="text-foreground">
          <ToolCoinIcon />
        </Icon>
        <span className="text-caption text-muted-foreground">ToolCoin</span>
      </div>
    </div>
  ),
};

const brandIcons = [
  { name: 'Github', component: GithubIcon },
  { name: 'GithubCoin', component: GithubCoinIcon },
  { name: 'Google', component: GoogleIcon },
  { name: 'OpenAI', component: OpenAIIcon },
  { name: 'Claude', component: ClaudeIcon },
  { name: 'Gemini', component: GeminiIcon },
  { name: 'DeepSeek', component: DeepSeekIcon },
  { name: 'OpenRouter', component: OpenRouterIcon },
  { name: 'Qwen', component: QwenIcon },
  { name: 'Mistral', component: MistralIcon },
  { name: 'Z.ai', component: ZaiIcon },
  { name: 'NVIDIA', component: NvidiaIcon },
  { name: 'MiniMax', component: MinimaxIcon },
  { name: 'Meta', component: MetaIcon },
  { name: 'Moonshot', component: MoonshotIcon },
  { name: 'xAI', component: XaiIcon },
];

export const BrandIcons: Story = {
  render: () => (
    <div className="grid w-200 grid-cols-6 gap-4">
      {brandIcons.map(({ name, component: BrandIcon }) => (
        <div key={name} className="flex flex-col items-center gap-2 rounded-lg bg-card p-3">
          <Icon size="lg" className="text-foreground">
            <BrandIcon />
          </Icon>
          <span className="text-caption text-muted-foreground">{name}</span>
        </div>
      ))}
    </div>
  ),
};

const strokeGlyphs = [Plus, Search, Settings, ChevronDown, Trash2, Copy, X, Check, Folder, Bell];

// Every lucide icon draws its line from `--icon-stroke-width`, however it is sized.
// Use this story for before/after shots of a stroke change.
export const Stroke: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {(['xs', 'sm', 'md', 'lg'] as const).map(size => (
        <div key={size} className="flex items-center gap-6">
          <span className="w-16 text-caption text-muted-foreground">
            {size} · {Sizes[`icon-${size}`]}
          </span>
          {['text-foreground', 'text-muted-foreground'].map(tone => (
            <div key={tone} className={`flex items-center gap-3 ${tone}`}>
              {strokeGlyphs.map(Glyph => (
                <Icon key={Glyph.displayName} size={size}>
                  <Glyph />
                </Icon>
              ))}
            </div>
          ))}
        </div>
      ))}
      <div className="flex items-center gap-3">
        <Button size="sm" icon={<Plus />}>
          Add header
        </Button>
        <Button size="md" icon={<Plus />}>
          Add header
        </Button>
        <Button size="lg" icon={<Play />}>
          Run
        </Button>
        <Button size="icon-md" tooltip="Copy">
          <Copy />
        </Button>
      </div>
      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="w-16 text-caption">Unwrapped</span>
        <Search className="size-3" />
        <Search className="size-3.5" />
        <Search className="size-4" />
        <Search className="size-5" />
        <span className="flex items-center [&>svg]:size-3.5">
          <Folder />
        </span>
      </div>
    </div>
  ),
};
