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

## How It Works

Mastra's Observational Memory runs **locally** in the plugin - no external server needed. It uses:
- **Local SQLite database** for storage (~/.opencode/observational-memory.db)
- **Observer agent** to extract observations when conversation grows long
- **Reflector agent** to condense observations when they grow too large

## What Gets Captured

The system automatically observes:
1. **Code patterns** - Architectures, conventions, and styles
2. **Decisions** - Technical decisions and their reasoning  
3. **Workflows** - Build, test, and deployment procedures
4. **Preferences** - User and project preferences

## Research the Codebase

To help the system build good initial observations, explore:

### File-based
- README.md, CONTRIBUTING.md, AGENTS.md, CLAUDE.md
- Package manifests (package.json, Cargo.toml, etc.)
- Config files (.eslintrc, tsconfig.json, .prettierrc)
- CI/CD configs (.github/workflows/)

### Git-based
\`\`\`bash
git log --oneline -20        # Recent history
git branch -a                # Branching strategy
git log --format="%s" -50    # Commit conventions
\`\`\`

## Using the Memory Tool

Check status:
\`\`\`
observational-memory(mode: "status")
\`\`\`

View observations:
\`\`\`
observational-memory(mode: "get-observations")
\`\`\`

## Your Task

1. Ask about specific rules or preferences
2. Explore the codebase structure
3. Note important patterns and conventions
4. The system will automatically capture observations from this conversation

After exploration, summarize what you've learned.
`;

const OM_STATUS_COMMAND = `---
description: Check Observational Memory status and view current observations
---

# Observational Memory Status

Check the status:
\`\`\`
observational-memory(mode: "status")
\`\`\`

View observations:
\`\`\`
observational-memory(mode: "get-observations")
\`\`\`

List conversation threads:
\`\`\`
observational-memory(mode: "list-threads")
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

function createPluginConfig(model: string): boolean {
  const configPath = join(OPENCODE_CONFIG_DIR, 'observational-memory.jsonc');

  const content = `{
  // Model for Observer and Reflector agents
  // Supports any model ID like "openai/gpt-4o", "anthropic/claude-3-sonnet", etc.
  "model": "${model}",

  // Scope for observational memory
  // "resource" = shared across all threads for a user (default)
  // "thread" = specific to each conversation
  "scope": "resource",

  // Token thresholds for triggering observation/reflection
  // "messageTokenThreshold": 30000,
  // "observationTokenThreshold": 40000,

  // Database path (default: ~/.opencode/observational-memory.db)
  // "dbPath": "~/.opencode/observational-memory.db"
}
`;

  writeFileSync(configPath, content);
  console.log(`✓ Created ${configPath}`);
  return true;
}

interface InstallOptions {
  tui: boolean;
  model?: string;
}

async function install(options: InstallOptions): Promise<number> {
  console.log('\n🧠 opencode-observational-memory installer\n');
  console.log('This plugin provides persistent memory using Mastra\'s');
  console.log('Observational Memory system with local SQLite storage.\n');

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

  // Step 3: Configure model
  console.log('\nStep 3: Configure model for Observer/Reflector agents');

  let model = options.model || process.env.OM_MODEL;

  if (options.tui && !model) {
    console.log('\nThe Observer and Reflector agents need a model to run.');
    console.log('Examples: google/gemini-2.0-flash, openai/gpt-4o, anthropic/claude-3-sonnet');
    model = await prompt(rl!, 'Model ID (default: google/gemini-2.0-flash): ');
    if (!model) {
      model = 'google/gemini-2.0-flash';
    }
  }

  if (!model) {
    model = 'google/gemini-2.0-flash';
  }

  createPluginConfig(model);

  if (rl) rl.close();

  console.log('\n' + '─'.repeat(50));
  console.log('\n✓ Setup complete!\n');
  console.log('Next steps:');
  console.log('1. Restart OpenCode');
  console.log('2. Run /om-init to explore your codebase');
  console.log('3. The system will automatically build observations\n');
  console.log('Data is stored locally at ~/.opencode/observational-memory.db');
  console.log('');

  return 0;
}

function printHelp(): void {
  console.log(`
opencode-observational-memory - Persistent memory for OpenCode using Mastra

This plugin runs LOCALLY - no external server needed. Uses SQLite for storage.

Commands:
  install    Install and configure the plugin
    --no-tui           Non-interactive mode
    --model MODEL      Model ID for Observer/Reflector (default: google/gemini-2.0-flash)

Environment Variables:
  OM_MODEL             Model for Observer/Reflector agents
  OM_OBSERVER_MODEL    Override model for Observer only
  OM_REFLECTOR_MODEL   Override model for Reflector only
  OM_DB_PATH           Custom database path

Examples:
  npx opencode-observational-memory install
  npx opencode-observational-memory install --model openai/gpt-4o
  npx opencode-observational-memory install --no-tui --model anthropic/claude-3-sonnet
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

  // Parse model argument
  let model: string | undefined;
  const modelIndex = args.indexOf('--model');
  if (modelIndex !== -1 && args[modelIndex + 1]) {
    model = args[modelIndex + 1];
  }

  install({ tui: !noTui, model }).then(code => process.exit(code));
} else {
  console.error(`Unknown command: ${args[0]}`);
  printHelp();
  process.exit(1);
}
