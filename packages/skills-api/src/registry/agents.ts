/**
 * Supported AI Agents
 * These are the agents that support the Agent Skills specification
 */

export interface SupportedAgent {
  /** Agent identifier (used in icon URLs) */
  id: string;
  /** Display name */
  name: string;
  /** Agent website URL */
  url: string;
  /** Icon URL on skills.sh */
  iconUrl: string;
  /** Description */
  description?: string;
}

/**
 * List of AI agents that support Agent Skills
 * Scraped from skills.sh
 */
export const supportedAgents: SupportedAgent[] = [
  {
    id: 'amp',
    name: 'AMP',
    url: 'https://ampcode.com/',
    iconUrl: 'https://skills.sh/agents/amp.svg',
    description: 'AI-powered code assistant',
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    url: 'https://antigravity.google/',
    iconUrl: 'https://skills.sh/agents/antigravity.svg',
    description: 'Google AI coding assistant',
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    url: 'https://claude.ai/code',
    iconUrl: 'https://skills.sh/agents/claude-code.svg',
    description: 'Anthropic Claude for coding',
  },
  {
    id: 'clawdbot',
    name: 'Clawdbot',
    url: 'https://github.com/clawdbot',
    iconUrl: 'https://skills.sh/agents/clawdbot.svg',
    description: 'Claude-based coding bot',
  },
  {
    id: 'cline',
    name: 'Cline',
    url: 'https://github.com/cline/cline',
    iconUrl: 'https://skills.sh/agents/cline.svg',
    description: 'VS Code AI assistant',
  },
  {
    id: 'codex',
    name: 'Codex',
    url: 'https://openai.com/codex',
    iconUrl: 'https://skills.sh/agents/codex.svg',
    description: 'OpenAI Codex',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    url: 'https://cursor.sh',
    iconUrl: 'https://skills.sh/agents/cursor.svg',
    description: 'AI-first code editor',
  },
  {
    id: 'droid',
    name: 'Droid',
    url: 'https://droid.dev',
    iconUrl: 'https://skills.sh/agents/droid.svg',
    description: 'AI coding assistant',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com',
    iconUrl: 'https://skills.sh/agents/gemini.svg',
    description: 'Google Gemini AI',
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    url: 'https://github.com/features/copilot',
    iconUrl: 'https://skills.sh/agents/copilot.svg',
    description: 'GitHub AI pair programmer',
  },
  {
    id: 'goose',
    name: 'Goose',
    url: 'https://github.com/block/goose',
    iconUrl: 'https://skills.sh/agents/goose.svg',
    description: 'Block AI agent',
  },
  {
    id: 'kilo',
    name: 'Kilo',
    url: 'https://kilo.dev',
    iconUrl: 'https://skills.sh/agents/kilo.svg',
    description: 'AI coding assistant',
  },
  {
    id: 'kiro-cli',
    name: 'Kiro CLI',
    url: 'https://kiro.dev',
    iconUrl: 'https://skills.sh/agents/kiro-cli.svg',
    description: 'Command-line AI assistant',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    url: 'https://opencode.ai',
    iconUrl: 'https://skills.sh/agents/opencode.svg',
    description: 'Open-source AI coding',
  },
  {
    id: 'roo',
    name: 'Roo',
    url: 'https://roo.dev',
    iconUrl: 'https://skills.sh/agents/roo.svg',
    description: 'AI development assistant',
  },
  {
    id: 'trae',
    name: 'Trae',
    url: 'https://trae.ai',
    iconUrl: 'https://skills.sh/agents/trae.svg',
    description: 'AI coding agent',
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    url: 'https://codeium.com/windsurf',
    iconUrl: 'https://skills.sh/agents/windsurf.svg',
    description: 'Codeium AI IDE',
  },
];

/**
 * Get an agent by ID
 */
export function getAgent(id: string): SupportedAgent | undefined {
  return supportedAgents.find(a => a.id === id);
}
