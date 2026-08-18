# Mastra for people who don't write the code

An example built around a question the docs don't currently answer: **what can a
product manager or a subject-matter expert actually do with a Mastra agent?**

The answer turns out to be "most of the interesting parts" — rewrite what the
agent says, ship that change, prove it helped or hurt, turn a bad conversation
into a permanent test case, and add knowledge as a markdown file. None of that
needs a pull request. All of it needs someone who knows the subject better than
the engineer does.

Everything here runs on one small support agent for a fictional file-sync
company, so the domain never gets in the way of the mechanics.

```
studio/           persistent DB + seeded dashboard   ← the browser half
  src/mastra/case-file.ts   working memory: the schema, and the rules that fill it
  workspace/skills/   6 markdown skills every agent inherits
headless/         12 runnable exercises, CI-safe     ← the same story in code
shared/           the agent, the scorers, the dataset
  support-tools.ts    a 9-tool support desk over one shared fixture
  web-tools.ts        live web search, page fetch, ask-a-human
local-packages/   3 earlier memory-eval scripts, separate workspace
```

## What someone without a terminal can do here

Every row is a thing to click, and a thing it proves.

| They can | Where | Why it matters |
|---|---|---|
| Describe an agent in a sentence and get one | **Agent Builder** → New agent | Owning an agent stops needing a repo |
| Rewrite the agent's instructions and ship it | Agents → Editor | Prompt changes stop being a deploy |
| See what that edit did, as a number | Evaluation → Datasets → Experiments | "This reads better" becomes measurable |
| Turn a real conversation into a test case | Observability → Traces → **Save as Dataset Item** | Answers where datasets come from |
| Rate an answer, leave a correction | Trace panel → **Feedback** | Human judgment stored beside machine scores |
| Add knowledge as a markdown file | Workspaces → Skills | No code, no deploy, no engineer |
| Read what the agent concluded — and fix it | Agents → chat → Memory panel | State you can inspect and edit, not a black box |
| Install a community skill | Agent Builder → Skills → Browse registries | Reuse without a repository |
| Re-grade past traffic against a new standard | Trace panel → **Evaluate Trace** | Yesterday's conversations, today's bar |

The engineer keeps what should stay theirs. The editor can override
`instructions` and `tools` and nothing else — `model`, `memory` and `scorers`
hold live objects that can't survive a database row. That boundary is a
feature: the model is pinned, so a score that moves between two prompt
versions moved *because of the prompt*.

The Builder is the exception that proves the rule. It doesn't edit the agent in
this repository — it writes a *new* one straight to the database, and an agent
that was never code has no live objects to protect, so it gets a model picker
the editor can't offer. Both agents then land in the same list, get scored by
the same scorers, and appear in the same traces.

## Setup

```bash
pnpm install
cp .env.example .env     # optional — see below
pnpm seed                # dataset, 3 experiments, prompt v1, stored skills
pnpm dev                 # http://localhost:4111
```

Everything except exercise 2 runs with **no API key**. The agent uses a
deterministic mock model, so every number in this README is reproducible
byte-for-byte. Add a key and the Studio agent switches to `openai/gpt-5-mini`,
the LLM-judge scorers attach themselves, live chat gets scored as it arrives,
and the **Agent Builder** appears in the sidebar.

The Builder is the one part of this example that a key is not optional for. Its
whole job is to *write* a prompt, and the deterministic mock answers from a
fixed knowledge base — it has nothing to write with. So the surface is gated on
the key rather than left to fail on first message: no key, no Builder, and the
rest of the workshop is unchanged.

`pnpm seed` deliberately does *not* load `.env`, so seeded history is identical
on every machine while live chat uses the real model. Reproducible past, real
present, one dashboard.

Starting over is one command:

```bash
pnpm reset               # delete both databases, then re-seed from code
```

Reach for it whenever you have changed the agent's `instructions` in code and
the browser is still serving the old ones — see the gotcha on published
versions below for why that happens. Stop `pnpm dev` first; the DuckDB file
takes a single writer.

## The browser half

### Building an agent by describing it

**Agent Builder** — top of the sidebar, above Primitives, its own full-screen
surface at `/agent-builder`. **New agent** opens one text box under the words
*"What should we build today?"*

Type the request as the person who wants it would say it:

> I run support for Nimbus, our file-sync product. When a customer writes in
> saying they are out of storage, I want an agent that looks up their account,
> tells them what plan they are on and how much space they have used, and then
> recommends whether to clear space or upgrade. It should be warm but brief.

About twenty seconds later there is a working agent. What scrolls past while it
builds is the part worth watching, because every line is a decision:

```
Using super-powers: customer-support-agent
Using super-powers: agent-prompt-quality-bar
Setting the agent name:        Nimbus Sync Resolver
Setting the agent description: Diagnoses Nimbus sync failures, explains whether…
Enabling tools:                getAccountOverview, listDevices, getSyncHealth,
                               getServiceStatus, searchKnowledgeBase,
                               searchPastTickets, createSupportTicket
Enabling skills:               privacy-guardrails, evidence-discipline, nimbus-voice
Setting the agent instructions: You are Nimbus Sync Resolver…
```

#### Why there are thirteen tools and not one

Seven of thirteen, and what it left out is the interesting part: both billing
tools, because sync has nothing to do with invoices; `lookupAccount`, because
`getAccountOverview` already covers it; and all three web tools, because the
answer was in the account, not on the internet. Selection only reads as
intelligence when there was something to get wrong.

Ask for something else and you get a different agent:

| Ask for | It attaches |
|---|---|
| "customer is out of storage" | `lookupAccount` alone — nothing else was needed |
| "diagnose sync failures" | account, devices, sync health, service status, KB, past tickets, escalation |
| "handle refund requests" | billing history, refund eligibility, ticket creation |
| "check a competitor's claim" | `webSearch`, `webFetch`, `searchKnowledgeBase` — and none of the seven account tools |

That is the demo. Run two requests back to back and the room sees the same
system produce two genuinely different agents.

The registry splits in two, and the Builder crosses the line only when the
outcome needs it:

| | Support desk (`support-tools.ts`) | Web (`web-tools.ts`) |
|---|---|---|
| Reads | one fixed fixture | the live internet |
| Deterministic | yes, forever | no, and never will be |
| Safe to gate CI on | yes | no |
| Tools | 9 account, billing and diagnostic tools | `webSearch`, `webFetch`, `askUser` |

#### And it isn't a toy

The built agent works, and works well enough to be worth chatting with live.
Ask it *"my iPad stopped syncing a week ago but my laptop and phone are fine,
account acct-42"* and it walks a real diagnostic chain:

```
getAccountOverview → getServiceStatus → listDevices → getSyncHealth → searchKnowledgeBase
```

Note the second call. It checks whether **Nimbus** is broken before it checks
whether the *customer* is — which is exactly the order the `sync-troubleshooting`
skill prescribes, and the opposite of what an agent left to its own devices
does. It lands on the right answer (four devices on a plan that syncs three),
names the specific device to remove, mentions upgrading second because the free
fix should come first, and does **not** open a ticket, because it could explain
the problem.

Then ask the same agent about `acct-77` — six devices, none syncing since this
morning — and it reaches a completely different conclusion:

> This is a Nimbus-side problem in your region, not something you did.

It's us, said first and without hedging; what's affected; no data lost; no
invented fix time; no troubleshooting steps. That is the `incident-communication`
skill, followed to the letter, by an agent nobody wrote.

Two customers, one agent, two correct root causes. The fixtures behind
`getSyncHealth` and friends are deterministic, so it lands the same way every
time you run it.

#### Reaching outside the fixture

Nine of the tools read a fixed dataset, which is what keeps the workshop
reproducible. Three deliberately do not, because an agent that can only answer
from canned data is a demo, and an agent that can look something up is
something you would deploy.

| Tool | What it does |
|---|---|
| `webSearch` | Answers a question from the live web and returns the citations as data |
| `webFetch` | Reads one URL the user already named |
| `askUser` | Suspends the run, asks a human, resumes with their answer |

Ask the Builder for *"check whether a competitor really offers what a customer
claims, and never overpromise"* and it builds **Honest Competitor Reply** with
`webSearch`, `webFetch` and `searchKnowledgeBase` — and none of the seven
account tools, because a competitor question has nothing to do with anyone's
storage quota.

Then ask it *"a customer says Dropbox gives way more free storage than our
15 GB — is that true?"* and it searches, checks the internal docs, and opens
with:

> **Verdict — False.** Dropbox's free Basic account only includes 2 GB.

with live links, a note that referral bonuses can raise that, and an
acknowledgement that the internal knowledge base returned no public URL to
link. That last part is `evidence-discipline` doing its job: say where the fact
came from, and admit when you cannot.

`askUser` is the one worth dwelling on for this audience. Without it an
ambiguous request makes the agent guess; with it the run pauses, the question
appears in the chat, and the answer resumes the same run. It also makes the
agent unsuitable for scheduled work where nobody is watching — a real trade,
and a good thing for a non-engineer to have to think about.

#### Where the judgment actually lives

None of that behaviour is in the prompt the Builder wrote. It comes from the
skills — and the two kinds pull in from different directions:

| | Workspace skills | Stored skills |
|---|---|---|
| Live in | `studio/workspace/skills/*/SKILL.md` | the database |
| Reach an agent by | inheriting the workspace | being attached, one at a time |
| Picked by | nobody — everyone gets them | the Builder's `set-agent-skills` |
| Good for | domain knowledge everyone needs | rules only some agents should carry |
| Here | refund policy, storage limits, sync troubleshooting, escalation, incident comms | voice, evidence discipline, privacy guardrails |

Every Builder-created agent starts attached to the Nimbus workspace, because
`configuration.agent.workspace` pins it — so the domain knowledge arrives
without anyone choosing it. The stored skills are the opt-in half, and they are
what the Builder is deciding between when it writes `Enabling skills:`.

The practical version of that split: **a subject-matter expert who adds a
markdown file to `workspace/skills/` has just changed the behaviour of every
agent anyone builds afterwards.** No deploy, no engineer, no code.

#### Skills you didn't write

**Agent Builder → Skills → Browse registries** searches
[skills.sh](https://skills.sh) — a live public registry, several hundred
thousand installs on the popular entries. `registries: { skillsSh: { enabled: true } }`
turns it on and it is off by default in Mastra, which is the right default:
installing a skill drops somebody else's instructions into your agent's system
prompt. Worth demoing, and worth saying out loud that it's a supply-chain
decision rather than a download.

#### One more thing to point at

The Builder's edit screen has a **Model** picker; the editor in the next
section does not and cannot. The allowlist here pins it to one provider, so
that picker shows OpenAI models and nothing else — an admin control a
non-engineer never sees but is bounded by.

Read `createBuilderAgent()`'s own system prompt at some point too. It opens by
naming its audience as "non-technical users (Product, founders, operators,
business stakeholders)", forbids follow-up questions, and forbids saying
"tool", "schema" or "id" to the user — all of which it holds to. It is a good
answer to what a prompt written *for* that audience looks like.

#### Wiring it into a project of your own

Shorter than it looks. The Builder is three things in `studio/src/mastra/index.ts`,
and each one fails quietly in its own way if you skip it.

```ts
import { MastraEditor } from '@mastra/editor'
import { createBuilderAgent } from '@mastra/editor/ee'

// 1. Turn the surface on. Omit `builder` entirely and there is no nav entry
//    and /editor/builder/settings reports { enabled: false }.
export const editor = new MastraEditor({
  source: 'db',
  builder: {
    enabled: true,
    configuration: {
      agent: {
        // Every built agent starts attached to this workspace, so it inherits
        // the markdown skills without anyone choosing them.
        workspace: { type: 'id', workspaceId: 'workshop-workspace' },
        // An admin control the non-engineer never sees but is bounded by.
        models: {
          allowed: [{ provider: 'openai' }],
          default: { provider: 'openai', modelId: 'gpt-5-mini' },
        },
      },
    },
    // Optional: let the Builder install skills from https://skills.sh.
    registries: { skillsSh: { enabled: true } },
  },
})

// 2. The agent that does the building.
const builderAgent = createBuilderAgent({ model: 'openai/gpt-5.6-sol' })

new Mastra({
  editor,
  workspace,
  agents: {
    'support-agent': supportAgent,
    // The key is NOT a convention you can rename — Studio resolves it by a
    // hard-coded constant. `createBuilderAgent()` sets the same id itself.
    'builder-agent': builderAgent,
  },
  // 3. The capability surface the Builder picks from. This registry populates
  //    the pickers; it does not hand any tool to any agent.
  tools: { ...supportDeskTools, ...webTools },
})
```

Three more things, none of them obvious:

- **A real model is required.** The Builder's job is to *write* a prompt, so a
  deterministic mock has nothing to write with. This example gates the whole
  block on `hasApiKey()` — no key, no Builder, rest of the workshop unchanged —
  rather than letting it boot and fail on first message.
- **No licence key in development.** `@mastra/editor/ee` is Enterprise-gated at
  runtime, but the check passes whenever `NODE_ENV` is not `production`. Expect
  one warning on boot; that is the check working, not an error.
- **Registering a tool is not the same as giving it to an agent.** The code
  agent above takes `tools: supportDeskTools` explicitly. The instance registry
  exists so the Builder has a menu.

### Editing the prompt, and shipping it

**Agents → Nimbus Support Agent → Editor.** System prompt on the left, live
chat on the right, version picker on top. `pnpm seed` snapshots the code prompt
as **v1** and publishes it, so the tab opens on a real baseline instead of "No
versions yet."

Try the edit a real support lead would ask for — append *"Avoid overwhelming
the customer with specific numbers"* — then:

| Button | What it actually does |
|---|---|
| **Save New Version** | Writes v2. Changes nothing for anyone. |
| **Publish** | Points the live agent at v2. This is the one that ships. |

Save and Publish being separate is worth saying out loud, because the editor's
own banner blurs it: *"Save your draft to ensure the chat uses your latest
changes"* is not true. Agents resolve at `status: 'published'`, chat pane
included. Verified here — with v2 saved and v1 published, the server still
serves v1.

### Proving the edit helped

That friendlier prompt is a plausible, well-meant, actively harmful change: it
takes `answer-accuracy` from **0.875 to 0.125**, because the numbers it removes
were the answers. Nobody would catch that by reading it.

**Evaluation → Datasets → nimbus-support-qa** has three seeded experiments —
baseline `0.875`, regression `0.375`, fix `0.875`. Noticing a regression you
didn't intend is the whole argument for evals, and that shape is the lesson.

`pnpm ex:12` runs the same comparison in the terminal and ends on the trap: an
experiment that isn't pinned to a version silently grades the prompt in the
*code*, which by then is neither version anyone is arguing about.

### Where datasets come from

**Observability → Traces**, click any `agent run`. The panel has three buttons,
and each is one of the last three exercises:

| Button | The exercise it is |
|---|---|
| **Save as Dataset Item** | The production→dataset loop |
| **Add tool mocks to item** | Exercise 10's `collectToolMocks` |
| **Evaluate Trace** → Scoring → **Start Scoring** | Exercise 11's `scoreTraces` |

**Save as Dataset Item** is the one to spend time on. It opens pre-filled from
the trace: the real question as `input`, the agent's actual answer as
`groundTruth` (edit it to what it *should* have said), the step sequence as
`expectedTrajectory`, the tool calls as `toolMocks`. A support lead who spots a
bad answer converts it into a permanent regression test without describing it
to anyone.

The same panel has a **Feedback** tab — thumbs, ratings and corrections, stored
next to the machine scores rather than in a spreadsheet.

### Knowledge as markdown

**Workspaces** opens `studio/workspace/`: a **Files** tab that browses and
searches it, and a **Skills** tab listing every directory containing a
`SKILL.md`.

Skills are just markdown — a directory, a `SKILL.md` with `name` and
`description` frontmatter, and whatever supporting files it needs. Six ship
here:

| Skill | What it governs |
|---|---|
| `sync-troubleshooting` | The order to rule things out, and the four sync error codes |
| `escalation-policy` | When to open a ticket, the severity matrix, how to write the summary |
| `incident-communication` | What to say during an outage, and what never to say |
| `storage-limits` | Quotas, file caps, device limits, trash retention |
| `refund-policy` | The refund window and how to handle billing questions |
| `eval-triage` | How to read a failing experiment row |

`sync-troubleshooting/` and `eval-triage/` each keep a `references/` file
beside their `SKILL.md`, which is the multi-file shape the Agent Skills spec
expects. Adding a skill means adding a directory; nothing is registered in
code.

These are where the built agent's judgment actually comes from. Open
`sync-troubleshooting/SKILL.md` and read the numbered checklist, then look back
at the tool call order in the Builder section — it is the same order, because
the agent read the file.

**Add Skill** searches [skills.sh](https://skills.sh) and installs into the
same directory, so one page covers both hand-written and third-party skills.

The workspace is registered on the `Mastra` instance, which makes it *global* —
agents inherit it. It's independent of the editor: skills appear here whether
or not `@mastra/editor` is configured.

> **Agent Builder → Skills** is a different thing with the same name: those are
> *stored* skills, kept in the database and attached per agent. `pnpm seed`
> creates three. See the comparison table in the Builder section.

### Chatting, and being graded for it

Chat under **Agents**. With a key, `answer-relevancy` and `toxicity` score
every reply as it arrives and land under **Evaluation → Overview**.

Which scorers belong on live traffic is a real decision. Real requests have no
`groundTruth`, so only *reference-free* scorers work here — `answer-accuracy`
would return 0 on every request forever and paint a healthy agent as a
flatline. It stays where labels exist: datasets and experiments.

### What the agent remembers, and what you can do about it

Chat with the support agent and open the **Memory** panel beside the
conversation. It fills in as you talk:

```json
{ "customer": { "accountId": "acct-42", "plan": "Free",
                "storageUsedGb": 11.2, "deviceCount": 4, "region": "us-east" },
  "issue":    { "summary": "my new iPad won't sync",
                "rootCause": "DEVICE_LIMIT", "status": "diagnosed" },
  "checksRun": ["getAccountOverview: …", "getServiceStatus: us-east operational"],
  "ruledOut":  ["regional incident — us-east operational"],
  "nextStep":  "ask the customer to remove an unused device or upgrade" }
```

That is **working memory**, and it is a different thing from the transcript
above it. The transcript is what was *said*. This is what the agent has
*concluded*, in a shape someone chose in advance — `studio/src/mastra/case-file.ts`
defines it as a Zod schema, so `rootCause` can only ever be one of five error
codes and never becomes "seems like a sync issue".

Three things make it worth a slide rather than a footnote.

**It survives the recall window.** The agent keeps the last 10 messages. The
case file outlives them, at a fraction of the tokens, so turn 30 still knows
which account this is.

**It changes what the agent does next.** `checksRun` and `ruledOut` are the
two fields that earn their place: they are what stops an agent asking a
customer to retry something it already watched fail. That failure is the most
recognisable way support bots waste people's time, and message history alone
does not reliably prevent it.

**You can edit it.** The panel has an **Edit Working Memory** button, and what
you type there is what the agent reads on its next turn. So it is not a log of
the agent's thinking — it is shared state, with a human on the other side of
it. That is the honest answer to *"can I correct it when it gets something
wrong"*, and it is why **managed state** describes this better than *memory*
does.

Watch it move: the agent writes `status: "reported"` before it knows anything,
`"diagnosed"` once a tool confirms the cause, and `"resolved"` when the
customer says it is fixed. Tell it *"we're all done, close this out"* and the
status advances — the record is not deleted. State transitions, not amnesia.

#### Two decisions behind it worth copying

**A schema, not a template.** Working memory comes in two shapes. A Markdown
`template` is a free-form blob the agent rewrites whole; a `schema` is a typed
object it updates field by field. The schema wins here because this example is
about *measuring* things and a typed record is diffable — two conversations
about the same customer produce two objects you can compare field by field,
where two blobs produce prose a human has to read. Studio renders the JSON in a
monospace block and the Markdown as formatted text, so you can see which one
you picked without reading any code.

**Thread scope, not the default.** Working memory defaults to `scope:
'resource'`, which persists across every thread belonging to one resource — in
production that is a customer, and a case file that survives from ticket to
ticket is exactly right. But Studio's chat has no notion of who the customer
is: it passes the **agent id** as the resourceId. Under resource scope, every
conversation with this agent would share one case file, and a fresh thread
about `acct-77` would open with `acct-42`'s device count already in it. So this
example uses `'thread'` — one case file per conversation, which demos cleanly
and is honest about what Studio can express. In your own app, pass a real
`resource` and switch it back:

```ts
await agent.generate(text, { memory: { thread: ticketId, resource: customerId } })
```

The panel's badge tells you which mode you are in without reading code: blue
`thread`, purple `resource`.

## The same story in code

The dashboard is more convincing when the numbers behind it are reproducible.
Run them in order; each builds on the last.

| # | Command | Teaches | Key? |
|---|---------|---------|------|
| 1 | `pnpm ex:1` | Writing a scorer: `preprocess → analyze → generateScore → generateReason` | no |
| 2 | `pnpm ex:2` | The 23 prebuilt scorers; code vs LLM judge; RAG context | 2b/2c |
| 3 | `pnpm ex:3` | Gates, thresholds, verdicts — making CI fail | no |
| 4 | `pnpm ex:4` | Multi-turn: `inputs` vs `turns`, and thread ownership | no |
| 5 | `pnpm ex:5` | Workflow targets: overall / per-step / trajectory scoring | no |
| 6 | `pnpm ex:6` | Datasets and experiments — the durable version | no |
| 7 | `pnpm ex:7` | Evaluating an agent that has memory | no |
| 8 | `pnpm ex:8` | `compareExperiments` — regression detection and the real CI gate | no |
| 9 | `pnpm ex:9` | Dataset versioning, item history, and the score that lies | no |
| 10 | `pnpm ex:10` | Tool mocks; recording a real trace and replaying it forever | no |
| 11 | `pnpm ex:11` | Scoring traffic that already happened | no |
| 12 | `pnpm ex:12` | Versioning the prompt, and evaluating the edit | no |

`pnpm ex:offline` runs everything that needs no key. `pnpm ex:all` runs all twelve.

The arc is a loop, not a list:

```
production traffic → dataset → experiment → compare → gate → fix → back to production
        11              10,9        6,7         8       8,3
```

**8 — comparing.** A gate asks *is this acceptable at all*; `compareExperiments`
asks *is this worse than last time*. A release can pass every gate and still be
a clear regression. Thresholds carry a `direction`, because plenty of things
you score are costs — latency, tokens, tool calls — where up is bad.

**9 — versioning.** Manufactures a lie: edit one question the agent kept
failing and the score jumps 0.875 → 1.000 with the agent untouched. Pinning to
the old version reproduces 0.875 and proves the data moved, not the model.

**10 — tool mocks.** The flagship. The same item passes, then fails, because a
row changed in a database. Mocks pin it, `unmockedToolPolicy: 'deny'` proves
nothing leaked, and `collectToolMocks` reads a real trace and writes the mocks
for you — production incident to deterministic regression test in one step.

**11 — scoring history.** Inverts the usual order: the traffic happened first,
the scorer came second. Write a scorer today, learn how the agent has been
doing on it since March. Nothing is re-run.

**12 — the prompt itself.** The thing teams change most often and measure
least.

## Things worth stopping on

Each has a comment block in the file that raises it. Most are **silent** — no
error, just wrong numbers — which is the real reason they're worth a slide.

**Saving a version does not ship it.** Save writes v2; only Publish moves
`activeVersionId`. Everything resolving an agent reads `status: 'published'`,
so an unpublished version affects nothing — including the chat pane next to the
editor, whose banner implies otherwise.

**A code agent's first save becomes v1 — including the edit.** Studio doesn't
snapshot the repository first, so unless you record a baseline deliberately
(`pnpm seed` does), the original prompt never enters version history and there
is nothing to compare against. Exercise 12a.

**The editor always shows three tabs, whoever made the agent.** Variables,
System Prompt, Tools — hard-coded in Studio 1.23.0, with no code-versus-stored
branch. It's tempting to assume the longer feature list (scorers, workflows,
skills, memory, favorites, avatar, browser, model) unlocks more tabs here; it
doesn't. That list is `AgentFeatures`, and it governs what the **Builder** is
allowed to configure — which capability setters the builder agent is handed —
not what the editor renders.

**A Builder-created agent turns on observational memory, and then needs a
thread.** The Builder writes `memory: { observationalMemory: true }` onto every
agent it makes. Studio's chat always supplies a thread, so this is invisible in
the browser — but call the same agent over the API without one and it fails
with `ObservationalMemory (scope: 'thread') requires a threadId`. Pass
`memory: { thread, resource }` and it works. That error is the one this
example's `local-packages/` scripts exist to explain, which makes the Builder
an unusually good way to reproduce it.

**`webSearchTool` cannot go in the instance registry.** `@mastra/core/tools`
exports one, and for a code-defined agent it is the right answer — one import
and Mastra swaps in whichever native search the active model provides. But it
is a *placeholder symbol*, not a `ToolAction`: no id, no description, no schema
until an agent run resolves it against a model. The instance registry is typed
`Record<string, ToolAction>` and the Builder's picker renders from exactly that
registry, so a placeholder can neither appear there nor serialise into a stored
agent. `web-tools.ts` hand-rolls a real tool over OpenAI's Responses API for
that reason. Use the built-in when you are writing the agent in code.

**Web search is not deterministic, and the web moves.** `webSearch` is the one
tool here whose output changes between runs. Keep it out of anything that gates
CI, and out of a dataset you plan to compare against later — a scorer that
grades an answer built on live search is measuring the internet, not the agent.
It belongs to the Builder half of this example, not to the twelve exercises.

**`webFetch` refuses your own network, on purpose.** Non-HTTP schemes,
`localhost`, and private or reserved IP ranges are blocked — including
addresses that only resolve to one after DNS. An agent any customer can talk to
should not be a way to probe an internal network. Responses truncate at 100,000
characters with `truncated: true`.

**The Builder needs an agent registered under exactly `builder-agent`.** Studio
resolves it by a hard-coded constant, so the key is not a naming convention you
can choose. `createBuilderAgent()` sets the id itself; register it under a
different key and the surface loads and then can't find its agent.

**The Enterprise gate passes in dev, and only in dev.** `@mastra/editor/ee` is
licence-checked at runtime, but `isEEEnabled()` returns true whenever
`MASTRA_DEV=true` or `NODE_ENV` is anything other than `production` — which is
every `mastra dev`. Expect one warning on boot saying a licence would be
required in production. Nothing is broken; that is the check working. Deploy
the same code with `NODE_ENV=production` and no `MASTRA_LICENSE_KEY` and it
fails there instead.

**The Builder's model allowlist doesn't govern the Builder's own model.**
`configuration.agent.models` filters what the *created* agent may run on — set
it and the picker shows one provider instead of every provider Mastra knows.
The builder agent itself takes whatever model it was constructed with, and
defaults to a flagship. Two separate dials that both read as "the model".

**An experiment ignores prompt edits unless you pin it.** Without
`agentVersion` the target resolves out of the code registry — no overrides, no
published version, no warning. Prompts get edited in the browser for weeks
while CI keeps grading the prompt in the repo, and the dashboard stays green as
the deployed agent drifts. Exercise 12e.

**A missed threshold does not fail the run.** Only gates produce
`verdict: 'failed'`; a threshold miss yields `'scored'`. CI written as
`if (verdict === 'failed') exit(1)` merges straight through a quality
regression. Exercise 3 shows the correct check, exercise 8 the better one.

**Comparing across a dataset edit is meaningless, and only a warning.**
`compareExperiments` notices the version mismatch and still returns a delta.
Treating that warning as an error in CI is your job. Exercises 8 and 9.

**Agent output is not a string.** `runEvals` hands scorers `MastraDBMessage[]`,
whose `content` is an object. A scorer that only handles strings silently
scores 0 on every row. See `extractText` in
`shared/src/scorers/answer-accuracy.ts`.

**Scorers must be registered on the `Mastra` instance to persist.** Skip it and
runs still print scores, but every save logs
`MASTRA_GET_SCORER_BY_ID_NOT_FOUND` and the dashboard stays empty — a terminal
that looks fine and a dashboard that looks broken.

**`getScorerById` resolves `scorer.id`, not your registration key.** Prebuilt
scorers name themselves with a suffix (`answer-relevancy-scorer`). Register one
under a tidier key, ask for that key, and you get a not-found for a scorer
sitting right there. Exercise 11.

**Code scorers are ~660× faster than judges.** Measured: 4 items × 3 code
scorers in **124 ms**, then 4 items × 2 LLM judges in **82,311 ms**.

**A judge can only grade what you show it.** `support-rubric` sees
`groundTruth` and nothing else, so it marks *true* extra detail as invented —
0.667 on an answer that is entirely correct. Design bug, not model failure.

**LibSQL cannot serve the Evaluation dashboard, or store spans.** Studio's
Overview and Scorers views call the generic `listScores()`, which LibSQL
doesn't implement, so those pages return `500 — "This storage provider does not
support listing scores"`. Only **clickhouse, convex, duckdb, oracledb, pg**
implement it. That's why both surfaces run a `MastraCompositeStore`: LibSQL for
everything, DuckDB for observability alone.

**Live scoring needs an `Observability` config, or it silently does nothing.**
Scores from agent-attached scorers hang off trace spans. Without an exporter
there are no spans, so no scores are written — and nothing errors.

**A short-lived script writes zero traces unless you flush.** Spans export in
batches; a script that generates traffic and exits takes the pending batch with
it. `await observability.shutdown()` first. Exercises 10 and 11.

**Paths must be absolute — for the database and the workspace.** Under
`mastra dev` the process runs from `src/mastra/public`, not the project root,
so a relative `file:./x.db` gives scripts and server two different databases,
and a relative workspace `basePath` browses an empty directory and finds no
skills. Nothing is logged either way. See `studio/src/mastra/db-path.ts`.

**Experiments take `targetType` + `targetId`, not an object.** Passing
`target: agent` fails with *"No task: provide targetType+targetId or task"*.

**`runEvals` owns the thread on the multi-turn path.** A single `input` passes
your `memory.thread` through untouched; `inputs`/`turns` generates one per item
and overrides yours. Per-item isolation is `inputs: [question]` — no manual
loop. Exercise 4.

**`scoreTraces` needs an internal workflow only the CLI registers.** It drives
`__batch-scoring-traces`, which `mastra dev` wires up — so it works on the
server and throws in a plain script. Use `scoreTraceBatch` instead, which is
direct and returns the scores. Exercise 11.

**`toolMockReport` only exists once you opt into interception.** No mocks and
no `deny` policy means no matcher is installed, so an unmocked suite can't even
tell you what it touched. Exercise 10a.

**A real model has no knowledge; the mock does.** The mock answers from
`NIMBUS_KNOWLEDGE`, so it looks omniscient. A real model correctly says *"I
don't have the Nimbus documentation"* — live relevancy was 0.0–0.65 until the
facts were inlined into the instructions, then 0.77–1.0. A production agent
would retrieve them.

**The DuckDB file takes a single writer.** `pnpm seed` while `pnpm dev` is
running fails with a lock error. Stop the server first — `pnpm reset` assumes
you have.

**Editing the prompt in code does nothing once a version is published.** This
is the one most likely to waste your afternoon. `MastraEditor({ source: 'db' })`
means a published stored version *overrides* the code, and `pnpm seed`
publishes v1 on first run. Change `instructions` in the file afterwards and the
server keeps serving v1 — no warning, no diff, no clue. `pnpm reset` fixes it
by rebuilding the database from code. On a database you want to keep, publish a
new version instead (`PATCH /api/stored/agents/:id`, then activate it). Note
what is *not* affected: `model`, `memory` and `tools` come from code every
time, so a code change to any of those takes effect on reload while an
instructions change silently does not.

**In schema working memory, `null` means delete.** Updates merge, so a field
you omit is preserved — but a field you send as `null` is removed. Models pad
their tool calls with nulls out of habit, and the result is a case file that
fills up on turn one and empties on turn two:

```
model sent  {"customer":null,"issue":null,"checksRun":null,"nextStep":"…"}
stored      {"nextStep":"…"}
```

`@mastra/memory` guards against exactly this — `stripNullsFromOptional` drops
nulls for optional fields before the merge sees them — but the guard rides on a
custom validator that `tool-builder/builder.ts` replaces whenever a provider
schema compat layer applies, and OpenAI has one. So on this stack the guard
never runs. The defence here is in the prompt: `CASE_FILE_INSTRUCTIONS` tells
the model that null deletes and that unchanged fields are omitted rather than
nulled. That holds — across fifteen live turns the model only nulled fields
that were already empty. But it is a prompt, not a type system. A Markdown
`template` uses replace semantics and has no deletion hazard at all, if you
would rather not depend on one.

**Working memory needs a thread, and resource scope needs a resource.** Calling
an agent with `agent.generate(text)` and no thread skips memory tools entirely
— `listMemoryTools` returns early when there is neither a thread nor a
resource, so the tool is never offered and nothing is written. That is why the
headless exercises leave working memory off: it would be inert there anyway.
Under `scope: 'resource'` a missing `resourceId` is worse than inert — the tool
throws.

**Killing `mastra dev` can strand a lock file.** `.mastra/dev.lock` records the
pid, and a hard kill leaves it behind; the next `pnpm dev` refuses to start,
naming a pid that is no longer alive. Delete `studio/.mastra/dev.lock` and
start again. A fresh clone never sees this — `.mastra/` is gitignored.

## What is covered

- Creating a whole agent from one sentence in the Agent Builder, with an
  admin-pinned model allowlist and a default workspace
- A thirteen-tool capability surface over a shared fixture, so the Builder's
  tool selection is a visible decision rather than a foregone one
- Both skill systems: filesystem skills inherited from the workspace, stored
  skills attached per agent, and installing from the skills.sh registry
- Live web search with structured citations, page fetching with SSRF guards,
  and human-in-the-loop `askUser`
- Editing, versioning and publishing a prompt from the browser, and pinning an
  experiment to a version
- A workspace with filesystem-backed skills, browsable and searchable in Studio
- Custom scorers, all four steps, as plain functions and as an LLM judge
- Prebuilt scorers: 8 code (deterministic) + 15 LLM judge, including the RAG set
- Gates, thresholds (`number` or `{min, max}`), verdicts, CI exit codes
- Experiment comparison, per-scorer deltas, threshold direction, regression gating
- Dataset versioning, SCD-2 item history, pinning a run to a past version
- Tool mocks, arg matching, hermetic runs, and trace→fixture recording
- Multi-turn: holistic vs per-turn assertions
- Workflow targets: overall, per-step by id, trajectory
- Live sampled scoring on real traffic, and retroactive scoring of traces
- Working memory as typed, editable state: a Zod-schema case file the agent
  maintains while it works, visible and correctable in the browser
- Memory-enabled agents, thread isolation strategies

## Not covered, and why

**Variables.** The agent declares no `requestContextSchema`, so the editor's
Variables tab reads *"No variables defined"*. Tools used to be empty in the
same way; registering `lookupAccount` on the `Mastra` instance fixed that and
gave the Builder something to attach. A schema would do the same for Variables
and is the smallest remaining gap.

**Sub-agents and workflows in the Builder.** Its `agents` and `workflows`
pickers read the same registry as the tools picker, so `support-agent` and
`support-workflow` are both offerable — but with one of each there is no real
choice to watch it make, the way there is with thirteen tools. A second specialist
agent would fix that and hasn't been written.

**Live scoring on a Builder-created agent.** The stored agent snapshot *does*
have a `scorers` field, and `AgentFeatures` lists `scorers: true` — but the
Builder ships eight capability setters and none of them is a scorer setter
(`set-agent-name`, `-description`, `-instructions`, `-workspace-id`, `-tools`,
`-skills`, `-model`, `-browser-enabled`). So a built agent starts with no live
scorers attached, and the editor has no tab to add them. `PATCH
/api/stored/agents/:id` can set the field directly; nothing in the UI does.
Evaluating one against the seeded dataset works fine either way.

**Authoring an LLM judge in the Studio UI** is not usable in
`@mastra/core@1.57.0`. The backend is complete — `POST /api/stored/scorers`
creates one, versions it, supports activate/restore — but new definitions land
in `status: 'draft'`, the list endpoint returns only `published`, and nothing
exposes a transition. A created judge is invisible. Demo judge design with
exercise 2 and `shared/src/scorers/support-rubric.ts` instead.

**Experiment lifecycle hooks** (`beforeAll` / `beforeEach` / …) and **experiment
grouping** (`experimentSetId`, `comparisonId`, `variantId`, `trialIndex`) exist
in the Mastra source but not in the published version pinned here.

**Shipped in Studio, not yet demonstrated here:** dataset CSV/JSON import (a
full upload → map columns → validate wizard), AI-generated dataset items
(`POST /datasets/:id/generate-items`, which reads your schemas *and* the
agent's instructions and tool list), failure clustering, the review queue
(`needs-review | reviewed | complete` with tags and ratings), prompt blocks
(reusable instruction text shared across agents, at **Prompts** in the
sidebar), and role impersonation for previewing Studio as a collaborator.
Each is a strong non-engineer story and none is built into this example yet.
