# Browser Workspace Testing Guide

This document outlines the testing process for browser agents in the Mastra workspace. We test both SDK providers (control cases) and CLI providers to ensure feature parity.

## Agents Under Test

| Agent ID | Type | Provider | Skill/Install Required |
|----------|------|----------|------------------------|
| `sdk-stagehand` | SDK | `@mastra/stagehand` | None |
| `sdk-agent-browser` | SDK | `@mastra/agent-browser` | None |
| `browser-agent` | CLI | `agent-browser` | `npx skills add vercel-labs/agent-browser --skill agent-browser --yes` |
| `browser-use-agent` | CLI | `browser-use` | `pip3 install browser-use` + `npx skills add browser-use/browser-use --skill browser-use --yes` |
| `browse-cli-agent` | CLI | `browse-cli` | `npm install -g @browserbasehq/browse-cli` + `npx skills add browserbase/skills --skill browser --yes` |

## Testing Order

Test SDK providers first as control cases, then CLI providers:

1. **sdk-stagehand** (control)
2. **sdk-agent-browser** (control)
3. **browser-agent** (CLI)
4. **browser-use-agent** (CLI)
5. **browse-cli-agent** (CLI)

## Setup

### 1. Install Dependencies

```bash
cd examples/browser-workspace
pnpm install
```

### 2. Install CLI Skills (for CLI agents)

Skills can be installed non-interactively using the `--yes` flag:

```bash
# agent-browser
npx skills add vercel-labs/agent-browser --skill agent-browser --yes

# browser-use (Python CLI)
pip3 install browser-use
npx skills add browser-use/browser-use --skill browser-use --yes

# browse-cli
npm install -g @browserbasehq/browse-cli
npx skills add browserbase/skills --skill browser --yes
```

**Note:** Agents can also install their own skills at runtime using `execute_command`. The `--yes` flag ensures non-interactive installation.

### 3. Start Dev Server

```bash
pnpm dev
```

Open Studio at http://localhost:4111

---

## Test Cases

Each test should be run for every agent. Record results in `RESULTS.md`.

### Test 0: Skill Self-Installation (CLI agents only)

**Goal:** Verify CLI agents can install their own skills when prompted.

**Applies to:** `browser-agent`, `browser-use-agent`, `browse-cli-agent`

**Prompt:**
```
Install your browser skill so you can browse the web. Use the appropriate install command for your CLI tool.
```

**Expected:**
- Agent recognizes it needs to install a skill
- Agent uses `execute_command` to run the install command
- Installation completes successfully
- Agent confirms skill is installed

**Install commands by agent:**
- `browser-agent`: `npx skills add vercel-labs/agent-browser --skill agent-browser --yes`
- `browser-use-agent`: `pip3 install browser-use && npx skills add browser-use/browser-use --skill browser-use --yes`
- `browse-cli-agent`: `npm install -g @browserbasehq/browse-cli`

**Verify:**
- [ ] Agent attempted installation
- [ ] Install command executed successfully
- [ ] No errors in output

**Note:** After this test passes, proceed with Test 1-8 for that agent.

---

### Test 1: Basic Navigation

**Goal:** Verify the agent can navigate to a URL and the browser opens.

**Prompt:**
```
Go to https://www.google.com
```

**Expected:**
- Browser window opens (non-headless)
- Page navigates to Google
- Agent confirms navigation completed

**Verify:**
- [ ] Browser opened
- [ ] Correct URL loaded
- [ ] Agent response acknowledges success

---

### Test 2: Screencast Display

**Goal:** Verify screencast appears in Studio.

**Prompt:**
```
Go to https://news.ycombinator.com
```

**Expected:**
- Screencast panel shows live browser view in Studio
- Screencast updates as page loads

**Verify:**
- [ ] Screencast visible in Studio
- [ ] Screencast shows correct page content
- [ ] Screencast updates in real-time

---

### Test 3: Page Interaction

**Goal:** Verify the agent can interact with page elements.

**Prompt:**
```
Go to https://www.google.com and search for "mastra ai"
```

**Expected:**
- Agent navigates to Google
- Types "mastra ai" in search box
- Submits search (or clicks search button)
- Search results page loads

**Verify:**
- [ ] Navigation successful
- [ ] Text input worked
- [ ] Search executed
- [ ] Results page visible

---

### Test 4: Data Extraction

**Goal:** Verify the agent can extract information from a page.

**Prompt:**
```
Go to https://news.ycombinator.com and tell me the top 3 headlines
```

**Expected:**
- Agent navigates to HN
- Extracts headline text
- Returns 3 headlines in response

**Verify:**
- [ ] Navigation successful
- [ ] Headlines extracted correctly
- [ ] Response contains actual headline text

---

### Test 5: Thread Isolation

**Goal:** Verify different threads get separate browser instances.

**Setup:** Open two chat threads in Studio for the same agent.

**Thread 1 Prompt:**
```
Go to https://www.google.com
```

**Thread 2 Prompt:**
```
Go to https://github.com
```

**Expected:**
- Two separate browser windows open
- Each shows different URL
- Actions in one don't affect the other

**Verify:**
- [ ] Two browser windows opened
- [ ] Thread 1 shows Google
- [ ] Thread 2 shows GitHub
- [ ] Windows are independent

---

### Test 6: Tab Tracking (Screencast)

**Goal:** Verify screencast follows active tab when new tabs open.

**Prompt:**
```
Go to https://www.google.com, then open a new tab and go to https://github.com
```

**Expected:**
- First tab opens Google
- Second tab opens GitHub
- Screencast shows the active/focused tab

**Verify:**
- [ ] Both tabs opened
- [ ] Screencast updated to show new tab
- [ ] Screencast reflects currently active page

---

### Test 7: Browser Close/Reopen

**Goal:** Verify browser can be closed and reopened cleanly.

**Prompt 1:**
```
Go to https://www.google.com
```

**Then close the browser window manually.**

**Prompt 2:**
```
Go to https://github.com
```

**Expected:**
- First navigation works
- After manual close, second navigation launches new browser
- No errors or stale state

**Verify:**
- [ ] First navigation worked
- [ ] Browser closed cleanly
- [ ] Second navigation launched new browser
- [ ] No errors in console/logs

---

### Test 8: Studio Self-Interaction

**Goal:** Verify the agent can navigate to its own Studio and interact with the UI.

**Prompt:**
```
Go to http://localhost:4111, click on any agent in the sidebar, and tell me what agents are available
```

**Expected:**
- Agent navigates to Studio
- Finds and lists available agents from sidebar
- Can read UI content

**Verify:**
- [ ] Navigated to localhost:4111
- [ ] Read agent list from sidebar
- [ ] Response contains agent names

**Note:** This tests that the browser can interact with the local Studio instance where it's being controlled from, which validates real-world usage.

---

## Recording Results

After running tests, record results in `RESULTS.md` using the template provided there.

## Troubleshooting

### Common Issues

1. **"Could not extract CDP URL"** - BrowserViewer failed to get CDP endpoint from Chrome
2. **"No browser session"** - Session not registered, screencast won't work
3. **Same browser across threads** - Thread ID not being passed correctly
4. **Screencast stuck on first tab** - CDP session not refreshed for new pages
5. **CLI timeout** - Warmup command may be needed or CDP URL not injected

### Debug Logging

Enable debug logs by setting:
```bash
DEBUG=mastra:* pnpm dev
```

### Check Browser Status

In Studio, the browser context panel should show:
- Current URL
- Page title
- Browser running status
