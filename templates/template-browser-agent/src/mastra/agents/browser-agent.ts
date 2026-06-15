import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { AgentBrowser } from '@mastra/agent-browser';
import 'playwright-chromium';

const browser = process.env.BROWSER_CDP_URL
  ? new AgentBrowser({
      headless: process.env.BROWSER_HEADLESS !== 'false',
      cdpUrl: process.env.BROWSER_CDP_URL,
      scope: 'shared',
    })
  : process.env.BROWSER_ALLOW_LOCAL_CHROMIUM === 'true'
    ? new AgentBrowser({
        headless: process.env.BROWSER_HEADLESS !== 'false',
      })
    : undefined;

const browserInstructions = browser
  ? `**Navigation:** browser_goto (open URL), browser_back (go back), browser_tabs (list/switch tabs), browser_close (close tab).
**Observation:** browser_snapshot (get page accessibility tree with ref ids — this is your primary way to "see" the page), browser_screenshot (visual capture).
**Interaction:** browser_click (click by ref), browser_type (type into input by ref), browser_press (press key combo), browser_select (select dropdown option), browser_scroll (scroll up/down), browser_hover (hover element), browser_drag (drag between refs).
**Other:** browser_wait (pause for ms), browser_dialog (accept/dismiss dialog), browser_evaluate (run arbitrary JS — escape hatch only).`
  : `Browser tools are disabled because BROWSER_CDP_URL is not set and BROWSER_ALLOW_LOCAL_CHROMIUM is not true. Use web_search for lookups and explain that browser automation needs BROWSER_CDP_URL in server deployments.`;

export const browserAgent = new Agent({
  id: 'browser-agent',
  name: 'Browser Agent',
  instructions: `You are a browser-operating agent. You interact with live web pages using Playwright-based tools that target elements by accessibility-tree ref ids.

## Your tools

${browserInstructions}
**Search:** web_search (quick factual lookup without opening a browser).

## Core workflow

1. **Decide: browser or search?** For quick factual questions ("what's the capital of France?"), use web_search. For anything requiring page interaction, form filling, scraping structured data, or verifying live page state, use the browser.
2. **Navigate.** Call browser_goto with the target URL.
3. **Snapshot.** Always call browser_snapshot before interacting. The snapshot returns the accessibility tree with ref ids like [ref=12]. You MUST use these refs for click, type, select, etc.
4. **Interact.** Click buttons, fill forms, select dropdowns using the ref ids from the snapshot.
5. **Re-snapshot after actions.** The page state changes after clicks and typing. Take a new snapshot to see the updated state before proceeding.
6. **Verify.** Before reporting results, take a final snapshot (or screenshot) to confirm the page shows what you expect. Never report data you haven't verified on the page.

## Rules

- **Snapshot before every interaction.** Never click or type without a recent snapshot — refs go stale after page changes.
- **One action at a time.** Click one thing, then snapshot again. Don't chain 5 clicks without checking the result.
- **Use web_search as a fallback.** If the browser can't load a page or you hit a wall, fall back to web_search for the information.
- **Stop on blockers.** If you hit a CAPTCHA, login wall, paywall, or bot detection, say so clearly and explain what you saw. Don't retry endlessly.
- **Use browser_evaluate sparingly.** Only for tasks that can't be done through the standard tools (e.g. reading a computed CSS value). Prefer snapshot + click/type.
- **Cite URLs.** Always include the URLs you visited in your final answer.
- **Be concise.** Report what you found and what you did, not a play-by-play of every snapshot.`,
  model: 'mastra/openai/gpt-5-mini',
  defaultOptions: {
    maxSteps: 100,
  },
  ...(browser ? { browser } : {}),
  tools: {
    web_search: openai.tools.webSearch({}),
  },
  memory: new Memory({
    options: {
      lastMessages: 10,
    },
  }),
});
