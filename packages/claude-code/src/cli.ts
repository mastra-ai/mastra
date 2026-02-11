#!/usr/bin/env node

import { readFileSync, existsSync, mkdirSync, writeFileSync, appendFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { resolveConfig, getMemoryDir } from './config.js';
import { ObservationalMemoryEngine } from './engine.js';
import { FileStorage } from './storage.js';
import { MastraOMPlugin } from './plugin.js';

const HELP = `
@mastra/claude-code — Observational Memory for Claude Code

USAGE:
  mastra-om <command> [options]

COMMANDS:
  inject              Output observations for system prompt injection
  observe <file>      Observe conversation context from a file or stdin
  reflect             Force reflection on current observations
  status              Show current memory state
  reset               Clear all observations and start fresh
  plugin              Run as Claude Code plugin (stdin/stdout JSON protocol)
  init                Initialize memory directory and CLAUDE.md integration

OPTIONS:
  --threshold <n>     Observation threshold in tokens (default: 80000)
  --reflect-at <n>    Reflection threshold in tokens (default: 40000)
  --model <model>     Model for observer/reflector (default: claude-sonnet-4-20250514)
  --debug             Enable debug logging
  --help, -h          Show this help message

ENVIRONMENT:
  MASTRA_OM_MEMORY_DIR              Memory directory (default: .mastra/memory)
  MASTRA_OM_OBSERVATION_THRESHOLD   Observation threshold
  MASTRA_OM_REFLECTION_THRESHOLD    Reflection threshold
  MASTRA_OM_MODEL                   Observer/Reflector model
  MASTRA_OM_DEBUG                   Enable debug logging (1 or true)

EXAMPLES:
  # Initialize in your project
  mastra-om init

  # Check memory status
  mastra-om status

  # Observe a conversation log
  mastra-om observe conversation.txt

  # Observe from stdin (pipe conversation context)
  cat conversation.txt | mastra-om observe -

  # Get observations for system prompt
  mastra-om inject

  # Force reflection to compress observations
  mastra-om reflect

  # Reset all memory
  mastra-om reset
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(HELP);
    process.exit(0);
  }

  const command = args[0];

  // Parse flags
  const debug = args.includes('--debug');
  const thresholdIdx = args.indexOf('--threshold');
  const reflectAtIdx = args.indexOf('--reflect-at');
  const modelIdx = args.indexOf('--model');

  const config = resolveConfig({
    debug,
    observationThreshold: thresholdIdx !== -1 ? parseInt(args[thresholdIdx + 1]!, 10) : undefined,
    reflectionThreshold: reflectAtIdx !== -1 ? parseInt(args[reflectAtIdx + 1]!, 10) : undefined,
    model: modelIdx !== -1 ? args[modelIdx + 1] : undefined,
  });

  const engine = new ObservationalMemoryEngine(config);

  switch (command) {
    case 'inject':
      await handleInject(engine);
      break;

    case 'observe':
      await handleObserve(engine, args.slice(1));
      break;

    case 'reflect':
      await handleReflect(engine);
      break;

    case 'status':
      handleStatus(engine, config);
      break;

    case 'reset':
      handleReset(config);
      break;

    case 'plugin':
      await handlePlugin(config);
      break;

    case 'init':
      handleInit(config);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.log(HELP);
      process.exit(1);
  }
}

async function handleInject(engine: ObservationalMemoryEngine) {
  const injection = engine.getContextInjection();
  if (injection) {
    // Output to stdout for piping into system prompt
    process.stdout.write(injection);
  } else {
    process.stderr.write('No observations to inject\n');
  }
}

async function handleObserve(engine: ObservationalMemoryEngine, args: string[]) {
  let context: string;

  const fileArg = args.find(a => !a.startsWith('--'));

  if (!fileArg || fileArg === '-') {
    // Read from stdin
    context = readFileSync(0, 'utf-8');
  } else {
    const filePath = resolve(fileArg);
    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    context = readFileSync(filePath, 'utf-8');
  }

  if (!context.trim()) {
    console.error('No context provided');
    process.exit(1);
  }

  const result = await engine.processConversation(context);
  console.log(result.message);

  if (result.observed) {
    console.log(`  Observations: ${result.observationTokens} tokens`);
    if (result.reflected) {
      console.log('  Reflection: completed');
    }
  }
}

async function handleReflect(engine: ObservationalMemoryEngine) {
  const state = engine.getState();

  if (!state.observations) {
    console.log('No observations to reflect on');
    return;
  }

  console.log(`Current observations: ${state.observationTokens} tokens`);
  console.log('Running reflector...');

  const success = await engine.forceReflect();
  if (success) {
    const newState = engine.getState();
    console.log(`Reflection complete:`);
    console.log(`  Before: ${state.observationTokens} tokens`);
    console.log(`  After: ${newState.observationTokens} tokens`);
    console.log(`  Compression: ${Math.round((1 - newState.observationTokens / state.observationTokens) * 100)}%`);
    console.log(`  Generation: ${newState.generationCount}`);
  } else {
    console.error('Reflection failed');
    process.exit(1);
  }
}

function handleStatus(engine: ObservationalMemoryEngine, config: ReturnType<typeof resolveConfig>) {
  const state = engine.getState();
  const memDir = getMemoryDir(config);

  console.log('Mastra Observational Memory Status');
  console.log('══════════════════════════════════');
  console.log(`Memory directory: ${memDir}`);
  console.log(`Observation tokens: ${state.observationTokens}`);
  console.log(`Observation threshold: ${config.observationThreshold}`);
  console.log(`Reflection threshold: ${config.reflectionThreshold}`);
  console.log(`Generation count: ${state.generationCount}`);
  console.log(`Last observed: ${state.lastObservedAt || 'never'}`);
  console.log(`Current task: ${state.currentTask || '(none)'}`);
  console.log(`Model: ${config.model}`);

  if (state.observations) {
    const lines = state.observations.split('\n').filter(l => l.trim()).length;
    console.log(`Observation lines: ${lines}`);

    // Show observation usage bar
    const obsPercent = Math.min(100, Math.round((state.observationTokens / config.reflectionThreshold) * 100));
    const bar = '█'.repeat(Math.round(obsPercent / 2.5)) + '░'.repeat(40 - Math.round(obsPercent / 2.5));
    console.log(`\nObservation usage: [${bar}] ${obsPercent}%`);
  }
}

function handleReset(config: ReturnType<typeof resolveConfig>) {
  const storage = new FileStorage(config);

  storage.saveState({
    observations: '',
    observationTokens: 0,
    generationCount: 0,
    lastObservedAt: null,
    currentTask: null,
    suggestedResponse: null,
  });

  console.log('Memory reset. All observations cleared.');
}

async function handlePlugin(config: ReturnType<typeof resolveConfig>) {
  // Run as Claude Code plugin using stdin/stdout JSON protocol
  const plugin = new MastraOMPlugin(config);

  // Read JSON messages from stdin
  const readline = await import('node:readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  for await (const line of rl) {
    try {
      const message = JSON.parse(line);
      let response: Record<string, unknown> = {};

      switch (message.type) {
        case 'manifest':
          response = plugin.getManifest();
          break;

        case 'on_session_start':
          response = plugin.onSessionStart();
          break;

        case 'on_tool_result':
          response = await plugin.onToolResult(message.payload || {});
          break;

        case 'on_session_end':
          response = await plugin.onSessionEnd(message.payload || {});
          break;

        default:
          response = { error: `Unknown message type: ${message.type}` };
      }

      process.stdout.write(JSON.stringify(response) + '\n');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      process.stdout.write(JSON.stringify({ error: errorMsg }) + '\n');
    }
  }
}

function handleInit(config: ReturnType<typeof resolveConfig>) {
  const memDir = getMemoryDir(config);

  // Create memory directory
  if (!existsSync(memDir)) {
    mkdirSync(memDir, { recursive: true });
    console.log(`Created memory directory: ${memDir}`);
  }

  // Create history directory
  const historyDir = join(memDir, 'history');
  if (!existsSync(historyDir)) {
    mkdirSync(historyDir, { recursive: true });
  }

  // Create config file
  const configPath = join(memDir, 'config.json');
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify({
      observationThreshold: config.observationThreshold,
      reflectionThreshold: config.reflectionThreshold,
      model: config.model,
    }, null, 2), 'utf-8');
    console.log(`Created config: ${configPath}`);
  }

  // Create .gitignore for memory directory
  const gitignorePath = join(memDir, '.gitignore');
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, `# Mastra Observational Memory state
state.json
observations.md
history/
`, 'utf-8');
    console.log(`Created .gitignore: ${gitignorePath}`);
  }

  // Check for CLAUDE.md
  const claudeMdPath = join(process.cwd(), 'CLAUDE.md');
  const omSnippet = `
## Observational Memory

This project uses Mastra Observational Memory for persistent context across Claude Code sessions.

**Before starting work**, check your memory:
\`\`\`
cat .mastra/memory/observations.md
\`\`\`

**When you notice important context** (user preferences, project decisions, architecture patterns, key file paths), use the observations file to maintain continuity.

Memory files are in \`.mastra/memory/\`. The \`observations.md\` file contains your accumulated observations about this project and user.
`;

  if (existsSync(claudeMdPath)) {
    const content = readFileSync(claudeMdPath, 'utf-8');
    if (!content.includes('Observational Memory')) {
      appendFileSync(claudeMdPath, '\n' + omSnippet);
      console.log('Added Observational Memory section to CLAUDE.md');
    } else {
      console.log('CLAUDE.md already has Observational Memory section');
    }
  } else {
    writeFileSync(claudeMdPath, `# CLAUDE.md\n${omSnippet}`);
    console.log(`Created CLAUDE.md with Observational Memory section`);
  }

  // Create/update .claude/settings.json
  const claudeSettingsDir = join(process.cwd(), '.claude');

  if (!existsSync(claudeSettingsDir)) {
    mkdirSync(claudeSettingsDir, { recursive: true });
  }

  console.log('\nMastra Observational Memory initialized');
  console.log('\nNext steps:');
  console.log('  1. Run `mastra-om status` to check memory state');
  console.log('  2. Start a Claude Code session — observations will be loaded automatically');
  console.log('  3. After long sessions, run `mastra-om observe <context-file>` to save observations');
  console.log('  4. Memory persists across sessions in .mastra/memory/');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
