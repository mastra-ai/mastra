import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import * as readline from 'node:readline';

const OPENCODE_CONFIG_DIR = join(homedir(), '.config', 'opencode');
const OPENCODE_COMMAND_DIR = join(OPENCODE_CONFIG_DIR, 'command');
const PLUGIN_NAME = 'opencode-observational-memory@latest';

/**
 * Strip JSONC comments from a string
 */
function stripJsoncComments(content: string): string {
  let result = content.replace(/\/\/.*$/gm, '');
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  return result;
}

const OM_INIT_COMMAND = `---
description: Initialize Observational Memory with comprehensive codebase knowledge
---

# Initializing Observational Memory

You are initializing persistent memory for this codebase using Mastra's Observational Memory system.

## Understanding Context

Mastra's Observational Memory automatically compresses your conversation history into structured observations. This helps maintain context across long coding sessions and multiple conversations.

## What Gets Remembered

The Observational Memory system automatically captures:
1. **Code patterns** - Architectures, conventions, and styles used in the codebase
2. **Decisions** - Technical decisions and their reasoning
3. **Workflows** - Build, test, and deployment procedures
4. **Preferences** - User and project preferences

## Memory Scopes

**Resource-scoped** (default):
- Observations are shared across all threads for a resource (user)
- Ideal for capturing cross-project knowledge

**Thread-scoped**:
- Observations are specific to a single conversation thread
- Useful for isolated contexts

## How to Research the Codebase

### File-based Research
- README.md, CONTRIBUTING.md, AGENTS.md, CLAUDE.md
- Package manifests (package.json, Cargo.toml, pyproject.toml, go.mod)
- Config files (.eslintrc, tsconfig.json, .prettierrc)
- CI/CD configs (.github/workflows/)

### Git-based Research
- \`git log --oneline -20\` - Recent history
- \`git branch -a\` - Branching strategy
- \`git log --format="%s" -50\` - Commit conventions
- \`git shortlog -sn --all | head -10\` - Main contributors

## Using the Memory Tool

You can use the \`observational-memory\` tool to:

\`\`\`
observational-memory(mode: "status")              // Check memory status
observational-memory(mode: "get-observations")   // View current observations
observational-memory(mode: "search", query: "...") // Search memories
observational-memory(mode: "list-threads")       // List conversation threads
\`\`\`

## Your Task

1. Ask the user about any specific rules or preferences
2. Research the codebase structure
3. Note important patterns and conventions
4. The system will automatically create observations from your conversation

After exploration, summarize what you've learned about the codebase.
`;

const OM_STATUS_COMMAND = `---
description: Check Observational Memory status and view current observations
---

# Observational Memory Status

Run this command to check the status of your Observational Memory:

\`\`\`
observational-memory(mode: "status")
\`\`\`

This will show:
- Whether memory is enabled
- Current observation count
- Token usage
- Observation/reflection status

To view the actual observations:

\`\`\`
observational-memory(mode: "get-observations")
\`\`\`

To search through memories:

\`\`\`
observational-memory(mode: "search", query: "your search query")
\`\`\`
`;

function createReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function confirm(rl: readline.Interface, question: string): Promise<boolean> {
  return new Promise(resolve => {
    rl.question(`${question} (y/n) `, answer => {
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer.trim());
    });
  });
}

function findOpencodeConfig(): string | null {
  const candidates = [
    join(OPENCODE_CONFIG_DIR, 'opencode.jsonc'),
    join(OPENCODE_CONFIG_DIR, 'opencode.json'),
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      return path;
    }
  }

  return null;
}

function addPluginToConfig(configPath: string): boolean {
  try {
    const content = readFileSync(configPath, 'utf-8');

    if (content.includes('opencode-observational-memory')) {
      console.log('✓ Plugin already registered in config');
      return true;
    }

    const jsonContent = stripJsoncComments(content);
    let config: Record<string, unknown>;

    try {
      config = JSON.parse(jsonContent);
    } catch {
      console.error('✗ Failed to parse config file');
      return false;
    }

    const plugins = (config.plugin as string[]) || [];
    plugins.push(PLUGIN_NAME);
    config.plugin = plugins;

    if (configPath.endsWith('.jsonc')) {
      if (content.includes('"plugin"')) {
        const newContent = content.replace(/("plugin"\s*:\s*\[)([^\]]*?)(\])/, (_match, start, middle, end) => {
          const trimmed = middle.trim();
          if (trimmed === '') {
            return `${start}\n    "${PLUGIN_NAME}"\n  ${end}`;
          }
          return `${start}${middle.trimEnd()},\n    "${PLUGIN_NAME}"\n  ${end}`;
        });
        writeFileSync(configPath, newContent);
      } else {
        const newContent = content.replace(/^(\s*\{)/, `$1\n  "plugin": ["${PLUGIN_NAME}"],`);
        writeFileSync(configPath, newContent);
      }
    } else {
      writeFileSync(configPath, JSON.stringify(config, null, 2));
    }

    console.log(`✓ Added plugin to ${configPath}`);
    return true;
  } catch (err) {
    console.error('✗ Failed to update config:', err);
    return false;
  }
}

function createNewConfig(): boolean {
  const configPath = join(OPENCODE_CONFIG_DIR, 'opencode.jsonc');
  mkdirSync(OPENCODE_CONFIG_DIR, { recursive: true });

  const config = `{
  "plugin": ["${PLUGIN_NAME}"]
}
`;

  writeFileSync(configPath, config);
  console.log(`✓ Created ${configPath}`);
  return true;
}

function createCommands(): boolean {
  mkdirSync(OPENCODE_COMMAND_DIR, { recursive: true });

  const initPath = join(OPENCODE_COMMAND_DIR, 'om-init.md');
  writeFileSync(initPath, OM_INIT_COMMAND);
  console.log('✓ Created /om-init command');

  const statusPath = join(OPENCODE_COMMAND_DIR, 'om-status.md');
  writeFileSync(statusPath, OM_STATUS_COMMAND);
  console.log('✓ Created /om-status command');

  return true;
}

function createPluginConfig(mastraUrl: string, agentId: string, apiKey?: string): boolean {
  const configPath = join(OPENCODE_CONFIG_DIR, 'observational-memory.jsonc');

  const config: Record<string, unknown> = {
    mastraUrl,
    agentId,
  };

  if (apiKey) {
    config.apiKey = apiKey;
  }

  const content = `{
  // Mastra server URL
  "mastraUrl": "${mastraUrl}",

  // Agent ID for memory operations
  "agentId": "${agentId}"${apiKey ? `,

  // API key for authentication (optional)
  "apiKey": "${apiKey}"` : ''}

  // Uncomment to customize:
  // "maxObservations": 5,
  // "maxSearchResults": 10,
  // "injectWorkingMemory": true,
  // "injectObservations": true
}
`;

  writeFileSync(configPath, content);
  console.log(`✓ Created ${configPath}`);
  return true;
}

interface InstallOptions {
  tui: boolean;
  mastraUrl?: string;
  agentId?: string;
  apiKey?: string;
}

async function install(options: InstallOptions): Promise<number> {
  console.log('\n🧠 opencode-observational-memory installer\n');

  const rl = options.tui ? createReadline() : null;

  // Step 1: Register plugin in config
  console.log('Step 1: Register plugin in OpenCode config');
  const configPath = findOpencodeConfig();

  if (configPath) {
    if (options.tui) {
      const shouldModify = await confirm(rl!, `Add plugin to ${configPath}?`);
      if (!shouldModify) {
        console.log('Skipped.');
      } else {
        addPluginToConfig(configPath);
      }
    } else {
      addPluginToConfig(configPath);
    }
  } else {
    if (options.tui) {
      const shouldCreate = await confirm(rl!, 'No OpenCode config found. Create one?');
      if (!shouldCreate) {
        console.log('Skipped.');
      } else {
        createNewConfig();
      }
    } else {
      createNewConfig();
    }
  }

  // Step 2: Create commands
  console.log('\nStep 2: Create /om-init and /om-status commands');
  if (options.tui) {
    const shouldCreate = await confirm(rl!, 'Add observational memory commands?');
    if (!shouldCreate) {
      console.log('Skipped.');
    } else {
      createCommands();
    }
  } else {
    createCommands();
  }

  // Step 3: Configure Mastra connection
  console.log('\nStep 3: Configure Mastra connection');

  let mastraUrl = options.mastraUrl || process.env.MASTRA_URL;
  let agentId = options.agentId || process.env.MASTRA_AGENT_ID;
  let apiKey = options.apiKey || process.env.MASTRA_API_KEY;

  if (options.tui) {
    if (!mastraUrl) {
      mastraUrl = await prompt(rl!, 'Mastra server URL (e.g., http://localhost:3000): ');
    }
    if (!agentId) {
      agentId = await prompt(rl!, 'Agent ID: ');
    }
    if (!apiKey) {
      const needsKey = await confirm(rl!, 'Does your Mastra server require an API key?');
      if (needsKey) {
        apiKey = await prompt(rl!, 'API key: ');
      }
    }

    if (mastraUrl && agentId) {
      createPluginConfig(mastraUrl, agentId, apiKey);
    } else {
      console.log('Skipped config creation - missing required values');
    }
  } else if (mastraUrl && agentId) {
    createPluginConfig(mastraUrl, agentId, apiKey);
  } else {
    console.log('Skipped config creation - set MASTRA_URL and MASTRA_AGENT_ID environment variables');
  }

  if (rl) rl.close();

  console.log('\n' + '─'.repeat(50));
  console.log('\n✓ Setup complete! Restart OpenCode to activate.\n');

  if (!mastraUrl || !agentId) {
    console.log('Environment variables required:');
    console.log('  export MASTRA_URL="http://your-mastra-server:3000"');
    console.log('  export MASTRA_AGENT_ID="your-agent-id"');
    console.log('  export MASTRA_API_KEY="your-api-key"  # optional');
    console.log('');
  }

  return 0;
}

function printHelp(): void {
  console.log(`
opencode-observational-memory - Persistent memory for OpenCode agents using Mastra

Commands:
  install    Install and configure the plugin
    --no-tui           Non-interactive mode (for LLM agents)
    --mastra-url URL   Mastra server URL
    --agent-id ID      Agent ID for memory operations
    --api-key KEY      API key for authentication (optional)

Examples:
  npx opencode-observational-memory install
  npx opencode-observational-memory install --no-tui --mastra-url http://localhost:3000 --agent-id my-agent
`);
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
  printHelp();
  process.exit(0);
}

if (args[0] === 'install') {
  const noTui = args.includes('--no-tui');

  // Parse optional arguments
  let mastraUrl: string | undefined;
  let agentId: string | undefined;
  let apiKey: string | undefined;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--mastra-url' && args[i + 1]) {
      mastraUrl = args[++i];
    } else if (args[i] === '--agent-id' && args[i + 1]) {
      agentId = args[++i];
    } else if (args[i] === '--api-key' && args[i + 1]) {
      apiKey = args[++i];
    }
  }

  install({ tui: !noTui, mastraUrl, agentId, apiKey }).then(code => process.exit(code));
} else {
  console.error(`Unknown command: ${args[0]}`);
  printHelp();
  process.exit(1);
}
