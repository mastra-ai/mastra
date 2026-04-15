# Browser Workspace Test Plan

This document outlines test scenarios for validating CLI browser providers in Studio.

## Quick Start

```bash
# 1. Wipe everything (clean slate)
./scripts/teardown.sh

# 2. Start dev server
pnpm dev

# 3. Open Studio
open http://localhost:4111

# 4. Go to Browser Agent and ask it to install the skill
```

---

## Core Testing Flow

The key insight: **the agent should install its own skill**. This validates the full workspace flow.

### Step 1: Teardown (Clean Slate)

```bash
./scripts/teardown.sh
```

This removes:
- `workspace-data/` (filesystem + skills)
- Database files (`mastra.db*`)
- `.mastra/` directory

### Step 2: Start Studio

```bash
pnpm dev
open http://localhost:4111
```

### Step 3: Agent Installs Skill

1. Navigate to **Browser Agent**
2. Ask: "Install the agent-browser skill using: npx skills add vercel-labs/agent-browser --skill agent-browser --yes"
3. **Expected**: Agent runs the command via `workspace_execute_command`
4. **Important**: Restart the server (`Ctrl+C` then `pnpm dev`) for the skill to be discovered
5. **Verify**: Skill appears in agent details after server restart

This tests:
- Workspace sandbox execution
- Skill discovery paths
- Agent self-setup capability

---

## Providers Under Test

| Provider      | CLI Binary      | Skill Repo                  | Skill Name      |
| ------------- | --------------- | --------------------------- | --------------- |
| agent-browser | `agent-browser` | `vercel-labs/agent-browser` | `agent-browser` |
| browser-use   | `browser-use`   | TBD                         | TBD             |

---

## Workspace Configuration

```typescript
// src/mastra/agents/browser-agent.ts
export const browserWorkspace = new Workspace({
  id: 'browser-workspace',
  filesystem: new LocalFilesystem({ basePath: './workspace-data' }),
  sandbox: new LocalSandbox({
    workingDirectory: './workspace-data',
  }),
  browser: {
    cli: 'agent-browser',
    headless: false,
  },
  // Skills paths - relative to filesystem basePath
  skills: ['.agents/skills', '.claude/skills'],
});
```

### Expected Directory Structure (After Skill Install)

```
src/mastra/public/workspace-data/
├── .agents/
│   └── skills/
│       └── agent-browser/   # Skill installed here
├── .claude/
│   └── skills/
│       └── agent-browser -> ../.agents/skills/agent-browser  # Symlink
└── ... (other workspace files)
```

---

## Part 0: Setup Validation

### Test 0.1: Clean Start

**Verify teardown works**

1. [ ] Run `./scripts/teardown.sh`
2. [ ] **Expected**: No errors, directories removed
3. [ ] Verify: `ls src/mastra/public/` shows no `workspace-data/`

**Results:**
- [ ] Teardown succeeds ✓/✗

---

### Test 0.2: Agent Skill Installation

**Verify agent can install its own skill**

1. [ ] Start Studio: `pnpm dev`
2. [ ] Open http://localhost:4111
3. [ ] Navigate to Browser Agent
4. [ ] Check agent details - should show NO skills yet
5. [ ] Send: "Install the agent-browser skill using: npx skills add vercel-labs/agent-browser --skill agent-browser --yes"
6. [ ] **Expected**: Agent uses `workspace_execute_command` to run the install
7. [ ] Refresh the page
8. [ ] Check agent details - should now show `agent-browser` skill

**Results:**
- [ ] Agent executes install command ✓/✗
- [ ] Skill appears after refresh ✓/✗
- [ ] Skill directory created at correct path ✓/✗

**Debug if fails:**
```bash
# Check if skill was installed
ls -la src/mastra/public/workspace-data/.agents/skills/

# Check workspace-data exists
ls -la src/mastra/public/workspace-data/
```

---

## Part 1: Basic Functionality

### Test 1.1: Skill Discovery

**Verify the agent can see its skills**

1. [ ] (After Test 0.2) Agent should have skill installed
2. [ ] Send: "What skills do you have?"
3. [ ] **Expected**: Agent mentions browser automation skill

**Results:**
- [ ] Skill appears in agent details ✓/✗
- [ ] Agent knows about skill ✓/✗

---

### Test 1.2: Browser Launch

**Verify browser launches and screencast appears**

1. [ ] Send: "Open a browser and go to https://example.com"
2. [ ] **Expected**:
   - Browser window opens (visible, not headless)
   - Screencast panel appears in Studio
   - URL bar shows `https://example.com`

**Results:**
- [ ] Browser launches ✓/✗
- [ ] Screencast visible ✓/✗
- [ ] URL bar updates ✓/✗

---

### Test 1.3: Navigation

**Verify agent can navigate**

1. [ ] Send: "Navigate to https://news.ycombinator.com"
2. [ ] **Expected**: Browser shows Hacker News, screencast updates

**Results:**
- [ ] Navigation works ✓/✗
- [ ] Screencast updates ✓/✗

---

### Test 1.4: Input Injection

**Verify you can interact via screencast**

1. [ ] With browser showing in screencast
2. [ ] Click somewhere in the screencast (e.g., a link)
3. [ ] **Expected**: Browser responds to click

**Results:**
- [ ] Mouse clicks work ✓/✗
- [ ] Keyboard input works ✓/✗

---

## Part 2: Multi-Tab Support

### Test 2.1: Open New Tab

1. [ ] Send: "Open a new tab and go to https://github.com"
2. [ ] **Expected**: New tab opens, screencast switches to it

**Results:**
- [ ] New tab created ✓/✗
- [ ] Screencast shows new tab ✓/✗

---

### Test 2.2: Switch Tabs

1. [ ] Send: "Switch back to the first tab"
2. [ ] **Expected**: Screencast switches to first tab

**Results:**
- [ ] Tab switch works ✓/✗
- [ ] Screencast updates ✓/✗

---

### Test 2.3: Close Tab

1. [ ] Send: "Close the current tab"
2. [ ] **Expected**: Tab closes, screencast shows remaining tab

**Results:**
- [ ] Tab closes ✓/✗
- [ ] Screencast updates ✓/✗

---

## Part 3: Thread Isolation (scope: 'thread')

> Note: Requires changing workspace config to `scope: 'thread'`

### Test 3.1: Separate Browser Per Thread

1. [ ] Create new thread (new conversation)
2. [ ] Send: "Open browser and go to https://example.com"
3. [ ] **Expected**: New browser instance spawns
4. [ ] Switch back to first thread
5. [ ] **Expected**: Original browser still there

**Results:**
- [ ] Each thread has own browser ✓/✗
- [ ] Screencasts are independent ✓/✗

---

## Part 4: State Persistence

### Test 4.1: Browser State Survives Restart

1. [ ] With browser open showing a specific page
2. [ ] Stop server (Ctrl+C)
3. [ ] Restart: `pnpm dev`
4. [ ] Go back to same thread
5. [ ] **Expected**: Browser reconnects, shows same state

**Results:**
- [ ] State restored ✓/✗
- [ ] Multi-tab state restored ✓/✗

---

## Troubleshooting

### Skill not appearing

**Most common cause: Server needs restart after skill installation.**

Skills are discovered at server startup. If you install a skill while the server is running:
1. Stop the server (`Ctrl+C`)
2. Restart: `pnpm dev`
3. Refresh the browser

```bash
# Check skill path configuration
cat src/mastra/agents/browser-agent.ts | grep skills

# Check if skill directory exists
ls -la src/mastra/public/workspace-data/.agents/skills/

# Check sandbox working directory matches filesystem basePath
# Both should be ./workspace-data
```

### Browser not launching

```bash
# Check if agent-browser CLI is available
which agent-browser || npx agent-browser --version

# Check environment
echo $AGENT_BROWSER_HEADED
```

### Screencast not showing

- Check browser console for WebSocket errors
- Verify CDP connection is established
- Check if browser process is running: `ps aux | grep agent-browser`

---

## Test Matrix Summary

| Test | Description | Status | Notes |
|------|-------------|--------|-------|
| 0.1 | Teardown works | ✅ | |
| 0.2 | Agent installs skill | ✅ | Requires server restart for discovery |
| 1.1 | Skill discovery | ✅ | Agent knows about its skills |
| 1.2 | Browser launch | ✅ | Screencast streams to UI |
| 1.3 | Navigation | ✅ | URL bar updates |
| 1.4 | Input injection | ⏳ | Needs manual testing |
| 2.1 | Open new tab | ✅ | `--new-tab` flag works |
| 2.2 | Switch tabs | ⏳ | `tab` command syntax TBD |
| 2.3 | Close tab | ⏳ | Not yet tested |
| 3.1 | Thread isolation | ⏳ | Requires `scope: 'thread'` |
| 4.1 | State persistence | ⏳ | Not yet tested |

### Last Tested: 2026-04-15

**Key Findings:**
- Skill installation via agent works (`workspace_execute_command`)
- Server restart required for new skills to be discovered
- Browser launches in headed mode
- Screencast streams correctly via ViewerRegistry
- Multi-tab navigation works with `--new-tab` flag
