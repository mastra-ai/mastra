# @mastra/factory

## 0.12.0-alpha.12

### Patch Changes

- Update README to include accurate, up-to-date information ([#22858](https://github.com/mastra-ai/mastra/pull/22858))

- Improve internal observational-memory processing. ([#22738](https://github.com/mastra-ai/mastra/pull/22738))

- Fixed issues and pull requests from outside the write-access circle asking for approval again at every lane after a person had already started them. Starting, dragging, or approving a run on such a card now carries that consent through the runs queued by the card's agent on its way to review. One gesture takes the card to a pull request instead of one click per lane. The same holds when a person creates a card straight into a working lane or moves it there through the API, and when the card's agent moves it on from a chat: the run queued by that move no longer waits for a click. Runs queued by a GitHub event on the card still ask first. An agent still cannot pull a rested external card back into work. A run pre-approved by an agent opens its session under the repository connector, never under the agent's id. ([#22862](https://github.com/mastra-ai/mastra/pull/22862))

- Fixed board cards for imported GitHub and Linear issues/PRs showing "just now" — cards now show how long ago the issue or PR was opened upstream instead of when the factory first saw it. ([#22848](https://github.com/mastra-ai/mastra/pull/22848))

- Fixed "Linked card could not be filed: A work item cannot relate to itself" on Review cards. When GitHub polling re-observed a pull request that already had a card, the dispatcher tried to link the card to itself as its parent. ([#22848](https://github.com/mastra-ai/mastra/pull/22848))

- Fixed personal memory settings in the web app showing (and running) the default Gemini observer model after signing in with another provider. Signing in with a provider OAuth flow or saving a personal API key now seeds your unset observer and reflector models from that provider, matching the TUI onboarding behavior. ([#22847](https://github.com/mastra-ai/mastra/pull/22847))

- Updated dependencies [[`e983f74`](https://github.com/mastra-ai/mastra/commit/e983f749873189f767f509eb33d1a3596c0f1c74), [`b40fa91`](https://github.com/mastra-ai/mastra/commit/b40fa91496d794e060494f9c0d2fe940912f9190), [`cedc25d`](https://github.com/mastra-ai/mastra/commit/cedc25d8c2dec005d8b10b6ce2d36feef1162ff0), [`9fdb3bc`](https://github.com/mastra-ai/mastra/commit/9fdb3bc0f9bfab5269b4f3045595e62323da5d3a)]:
  - @mastra/slack@1.6.3-alpha.1
  - @mastra/code-sdk@1.6.0-alpha.9
  - @mastra/core@1.64.0-alpha.7
  - @mastra/auth-studio@1.3.5-alpha.1
  - @mastra/auth-workos@1.6.5-alpha.1

## 0.12.0-alpha.11

### Minor Changes

- Session start checks for the `.mastra-sandbox/setup` marker beside the checkout and skips the setup command when the marker holds the sha256 digest of the project's current setup command. Sandboxes booted from a warm repo template carry the marker already; setup runs once when it is missing or stale and writes the marker afterwards. ([#22837](https://github.com/mastra-ai/mastra/pull/22837))

### Patch Changes

- Updated dependencies [[`c1d3422`](https://github.com/mastra-ai/mastra/commit/c1d3422e8052a4282e8547df914b6231e5345f01), [`4596348`](https://github.com/mastra-ai/mastra/commit/45963483f4cd2810f0646469916f74266a3dd607), [`e8aca33`](https://github.com/mastra-ai/mastra/commit/e8aca339dc92c0b60baad3d948a7c48ec9ae106f), [`19b71cf`](https://github.com/mastra-ai/mastra/commit/19b71cf1de8afe6f69a3171d8a5a28086790e49b)]:
  - @mastra/core@1.64.0-alpha.6
  - @mastra/code-sdk@1.6.0-alpha.8

## 0.12.0-alpha.10

### Patch Changes

- Reduced the GitHub integration's REST request volume. Collaborator permission lookups are cached for 30 minutes per repo and login, and the PR/issue reconcile sweeps default to hourly instead of every 5 minutes; event polling and webhooks remain the primary sync. Override the interval with `MASTRACODE_PLATFORM_GITHUB_RECONCILE_INTERVAL_MS` (platform) or `MASTRACODE_GITHUB_RECONCILE_INTERVAL_MS` (direct), or the `_PR_` / `_ISSUE_` variants. ([#22835](https://github.com/mastra-ai/mastra/pull/22835))

## 0.12.0-alpha.9

### Patch Changes

- **Session status** ([#22786](https://github.com/mastra-ai/mastra/pull/22786))

  - Fixed session status disagreeing between sidebar rows, board cards, and the open chat.
  - Running, setting up, and waiting-on-you states now read the same after a reload and in every tab.
  - Removed the per-browser "your turn" mark; a card waiting on a person is marked from the card itself, and a finished session with nothing waiting shows as idle.

  **Chat**

  - Fixed the favicon claiming the session awaits input while history is still loading.
  - Allow steering or stopping a running session as soon as it is connected.

  **Done sound**

  - Plays once when a run watched in this tab ends.

- A run started from a work item with comments shows its prompt as the collapsed skill row again, with the item's discussion in its own collapsible row beside it, instead of one raw message wide enough to break the page. Only that discussion may follow the skill envelope; anything else keeps the message raw. ([#22551](https://github.com/mastra-ai/mastra/pull/22551))

  The Mastra Code terminal folds the same prompt into its skill row.

- **Session comments panel** ([#22551](https://github.com/mastra-ai/mastra/pull/22551))

  The comments panel opens at half the height of the chat and grows with the conversation up to the full column, instead of opening full height around an empty feed. It morphs open from the workspace card. The composer is a flush bar at the bottom edge and takes focus as the panel opens. A comment that lands while you are watching rises into place. Editing a comment saves on Enter and keeps Shift+Enter for a new line, with Cancel and Save inside the bottom right of the field. The edit field grows with its text up to ten lines, then scrolls, with no resize handle. The workspace card's corners are concentric with the rows inside it. Session rows in the sidebar no longer open their hover details on a touch viewport, where the card could only appear behind the tap that already navigated away.

  **Board cards**

  A sent comment lands in the feed as soon as the server stores it, with no dimmed placeholder. A failed send keeps the draft and shows the error. Opening a card widens a copy of it over the card, every row anchored where the card had it, and pulls a tray out from beneath, a little narrower than the copy, so opening moves nothing you were about to click. Hovering a card no longer floats its full title over it; the open copy shows it whole.

  The tray holds one timeline in time order: the item's runs, moves and comments, with the composer at the bottom. The description heads that stream in a block of its own, an Activity rule between them. The tray opens at its full height whatever the stream holds, waits for the description and the comments together, and lands them one after another, so nothing shifts once it loads.

  Cards share a minimum height, with their bottom row pinned to the bottom edge. That row leads with one small button, the likeliest next click: the item's run, Retry after a failure, the suggested run while one waits, Open session while one runs. It lights up only while the card waits on you, to release a suggested run, retry a failure, or answer a session that asked. It goes quiet the moment a run is starting, so a lit button on the board always means your turn. A card in a lane leads with that lane's own run. The other buttons sit tucked under the first like pulled tabs, on the card and in its open copy alike. While a session runs, no rival run is offered beside it. The suggestion itself is a badge in the status row. The last worker sits at the right of the bottom row, the name before the picture, and the External badge sits at the right of its own row above. An expand icon appears beside the card's menu on hover, in the spot where the open copy puts Collapse. The copy names its source link with the item's icon and number instead of an arrow. The card's corners round a little more, concentric with the buttons in them, and the empty state of a column rounds its corners the same way.

  **Intake and the rest of the board**

  An intake candidate opens the same way, its run buttons in the copy and its description in the tray. Labels stay on one line that scrolls sideways instead of wrapping. A card near the bottom of the window opens its tray above the card instead of climbing to fit, and in the last column the tray slides left by its overflow while the copy stays over the card. The board dims under the open card, and a click on the dim closes it without pressing whatever sat underneath.

  **On a phone**

  The sheet opens straight onto the same timeline and composer, and hugs its content instead of opening at a fixed height.

- Updated dependencies [[`decd47d`](https://github.com/mastra-ai/mastra/commit/decd47d0db2a891a6832e226557145b6658b0b19), [`285ce1c`](https://github.com/mastra-ai/mastra/commit/285ce1c1399341a37e76233aa94dbf9f1a41bd5d), [`5b5e3cc`](https://github.com/mastra-ai/mastra/commit/5b5e3cc006950b0ff9720c5be8396d4c95e8a6ac), [`045c3c7`](https://github.com/mastra-ai/mastra/commit/045c3c78f2129fea5d4467bb26cff2b49788b3d0), [`d53a056`](https://github.com/mastra-ai/mastra/commit/d53a05614893e8d1bbfdab50b42c19435e6bd065)]:
  - @mastra/core@1.64.0-alpha.5
  - @mastra/code-sdk@1.6.0-alpha.7

## 0.12.0-alpha.8

### Patch Changes

- Sessions on a remote sandbox with an absolute `workingDirectory` resolve the checkout at `<workingDirectory>/<repo>` without probing the VM. Sandboxes without one (or with a non-absolute one) keep the probe behavior. ([#22698](https://github.com/mastra-ai/mastra/pull/22698))

- Updated dependencies [[`a499422`](https://github.com/mastra-ai/mastra/commit/a499422cd7eccca184cac7b7a684a6199784aa82), [`9d3073c`](https://github.com/mastra-ai/mastra/commit/9d3073c230dbff45d58c259d676b2b137afd2ff5)]:
  - @mastra/core@1.64.0-alpha.4
  - @mastra/code-sdk@1.6.0-alpha.6

## 0.12.0-alpha.7

### Patch Changes

- Updated dependencies [[`2e87ffb`](https://github.com/mastra-ai/mastra/commit/2e87ffbb454cc88bd8a8c022d1e46325e7907482)]:
  - @mastra/core@1.64.0-alpha.3
  - @mastra/code-sdk@1.6.0-alpha.5

## 0.12.0-alpha.6

### Patch Changes

- Improved Factory issue triage to label issues by domain in addition to confirmed direct @mastra/core bugs. Triage now selects domain labels such as Agents, Workflows, Memory, Observability (AI Telemetry), and RAG from where the change would land, applying several only when a change genuinely spans domains. ([#22753](https://github.com/mastra-ai/mastra/pull/22753))

- Fixed repository-local Factory skills not loading when the bundled skills exist. Factory now layers the consumer repo's src/mastra/public/factory-skills directory over the bundled Factory skills, so projects can add custom pipeline skills (or override built-in ones) without patching node_modules. The local skills root is also resolved correctly for the cwd variants used by mastra factory dev --dir src/mastra. Fixes #22707. ([#22723](https://github.com/mastra-ai/mastra/pull/22723))

- Fixed Factory project sessions using organization model credentials. ([#22741](https://github.com/mastra-ai/mastra/pull/22741))

- Improved how a session says what it is doing. A sidebar row now carries an activity rail down its left edge instead of a dot in its trailing slot: marks travel down the rail while a run is underway, in the setup colour while the sandbox is still starting, and settle into a slow breath once the session is waiting on you. A board card shows the same thing on its own border — a lit head running the outline while work is in flight, the whole outline lit once the card is waiting on you. ([#22751](https://github.com/mastra-ai/mastra/pull/22751))

  Removed the marker for a session that is merely bound to a card: the card offers an Open session button instead, and the work item panel drops its dot for the same reason. Moving lifecycle off the row's trailing slot frees it — the actions menu no longer displaces the marker on hover, and a merged pull request keeps its badge.

- Fixed the "ready — your turn" mark only going away when a session was opened from the sidebar. Opening the same thread through a board card, a deep link, or the attention inbox left the mark lit, and a run finishing in the very thread being read marked it as needing attention. Landing on a session's route — through any door — now dismisses its mark, and the open session never gets marked at all. The completion sound still plays for it, so a backgrounded tab still calls you back. ([#22749](https://github.com/mastra-ai/mastra/pull/22749))

- Factory board cards now show live session status: idle, initializing, working, and ready. Cards and sidebar rows read the same status, so they always agree. A cloning workspace shows initializing, a running session shows working, and a finished run waiting for you shows ready. ([#22748](https://github.com/mastra-ai/mastra/pull/22748))

- Improved Factory PR review to audit documentation changes on mastra-ai/mastra with the repository's `docs-audit` skill, so docs changes are graded against the canonical authoring guidance instead of only general review judgement. ([#22766](https://github.com/mastra-ai/mastra/pull/22766))

- Remove `CHANGELOG.md` from distributed npm files resulting in reduced package size ([#22737](https://github.com/mastra-ai/mastra/pull/22737))

- Updated dependencies [[`cf58c86`](https://github.com/mastra-ai/mastra/commit/cf58c86cb48ccc72677bdaa422e43f102683184c), [`449d112`](https://github.com/mastra-ai/mastra/commit/449d1120cc1f9c43a71308a9fd8b178cfb11355f), [`2a0ca02`](https://github.com/mastra-ai/mastra/commit/2a0ca021d95e23f1d1c0b5fe858b0b56f71fe0ba), [`ff539f6`](https://github.com/mastra-ai/mastra/commit/ff539f6dc21137fbeb3f0867f07069cbce45c15f), [`420052f`](https://github.com/mastra-ai/mastra/commit/420052fcac3fc672be17fe655667dfbdbd35a2cc), [`28ce924`](https://github.com/mastra-ai/mastra/commit/28ce924276eeca492e6a360e5482ed20c2785ef6)]:
  - @mastra/core@1.64.0-alpha.2
  - @mastra/slack@1.6.3-alpha.0
  - @mastra/code-sdk@1.6.0-alpha.4
  - @mastra/auth-studio@1.3.5-alpha.0
  - @mastra/auth-workos@1.6.5-alpha.0

## 0.12.0-alpha.5

### Minor Changes

- Runs started by the Factory no longer stall without appearing in Needs attention. ([#22530](https://github.com/mastra-ai/mastra/pull/22530))

  A run that writes a plan used to suspend inside its thread and wait forever: the card said Building, nothing built, and no error appeared anywhere.

  **Added: an Auto-approve plans switch on the board**

  Find it in the board's automation settings, beside Auto-start runs. Off by default, which is what runs already did — except a plan nobody is watching now surfaces in Needs attention instead of hanging. On, the Factory answers the plan itself and the run carries the item through to Done. An agent that keeps re-planning is stopped after three approvals and handed to a person.

  **Fixed: who a parked plan waits for**

  With the switch off, where a parked plan goes depends on who started the run. A plan on a rule-started run escalates through the rule's own decision, the record Needs attention is built on. A plan on a run a person started keeps waiting for that person, because that pause is the point. With the switch on, the Factory answers both.

  **Fixed: two smaller holes on the same path**

  An agent asking to move its own card no longer parks the run behind an approval prompt nobody is watching; the rules engine still governs every move. And a failure that can never succeed on a retry stops burning attempts before it reaches someone.

- A Factory run waiting on any answer now surfaces instead of parking silently. ([#22649](https://github.com/mastra-ai/mastra/pull/22649))

  **Fixed: questions stalled the same way plans used to**

  The plan gate covered `submit_plan` only. A run that asked a question through `ask_user` still stalled with the card saying Building. Any tool suspension on an unattended run now lands in Needs attention as "Agent is waiting for an answer".

  **Unchanged: pauses that belong to a person**

  Person-started runs are untouched — their pauses wait for the person reading them. Auto-approved plans stay the only pause the Factory answers itself, because a question has no approvable default.

- Approving a proposed run now happens in the attention inbox instead of sending someone to the Rules page. ([#22709](https://github.com/mastra-ai/mastra/pull/22709))

  **A queue of proposals is a handful of decisions repeated, not a list of distinct ones.** A rules engine proposes the same run for every card it matches, so fifty rows reading `invokeSkill · triage` said nothing that "32 triage runs" does not. The queue sits grouped by role in a panel above the timeline, collapsed, one line per shape; expanding a group names the work item each proposal is for, so a row finally says what it would start. The banner that only counted the queue is gone, and the sidebar popover's approval link opens the inbox.

  **A group can be dismissed whole**, behind a confirm step — the way out of a queue nobody wants. There is deliberately no matching "run all": that would bill dozens of agent runs from one click, with no bulk route to make it atomic.

  **The queue says how much of itself it is showing.** The count in the header is the true pending total; when more proposals exist than one page holds, the panel says how many of them loaded, and the per-group "oldest" timestamp is dropped rather than reporting the oldest of a partial page as the oldest of the queue.

  **An attention row says what landed as a badge** — `mention`, `comment`, `failed` — carrying the icon of its kind and dimming once read, instead of a coloured bead beside a sentence fragment, with the card as the row's title and the author ahead of the message. The sidebar popover scrolls through its preview again: its list had been capped by the popover's own height rather than the scroller's, which left the scroller measuring no overflow and the popover clipping the rows it could not show.

  **The Rules page holds only what nothing else shows** now that failures and approvals both land in attention — the full effect lifecycle, decisions with no work item, and the succeeded/dismissed history — so it leaves the Factory navigation and is reached from an attention row or global search.

- Added a hands-off start for work items. ([#22652](https://github.com/mastra-ai/mastra/pull/22652))

  **How it works**

  Pick "Investigate hands-off" or "Build hands-off" in a card's menu instead of the plain start — restarts too: a card whose run already happened offers "Re-review hands-off" and a hands-off twin of its lane's run. "Prepare approval" has no twin — that run's outcome is a maintainer decision, which hands-off cannot remove. The run's parked plans are approved on your behalf, even while the project's Auto-approve plans switch stays off.

  The grant sticks to the item, not the run, so the Factory's own follow-up runs on that card stay hands-off too. Other cards keep waiting for plan review, and a hands-off run that keeps re-planning still stops after three approvals.

- Factory Overview now shows what landed in the repository, not only what moved on the board. ([#22709](https://github.com/mastra-ai/mastra/pull/22709))

  A **Latest commits** section reads the connected repository's default branch newest-first, on the same day-rail the Activity and attention pages use: the branch tip carries a ring, everything behind it a filled bead, and each row gives the subject, its author, the short sha and when it landed, opening the commit on GitHub. A Factory with no repository linked says so rather than sitting on a skeleton.

  A Factory whose board was busy all day but whose main branch has not moved now says so on the page that is supposed to answer that question, instead of sending someone to GitHub to find out. The section leans on `GET /web/github/projects/:id/commits`, so it costs one rate-limited call per visit rather than a poll.

- Rebuilt the Factory Overview at `/factories/:id/overview` around what needed a person and what the Factory shipped, and gave board traffic its own page. ([#22709](https://github.com/mastra-ai/mastra/pull/22709))

  **The page opens on a stage funnel** for the work created in the selected window (7, 30 or 90 days), each card placed by the furthest stage it ever reached rather than by where it sits today.

  - The saturated core is what got that far with nobody stepping in, the pale sheath what a person had to close. Moves made by Factory rules count as unattended, so the autonomy figures no longer bill automation to a person.
  - Every loss peels off as its own hatched arm, billed to the column the work actually stopped in, so a drop keeps the thickness it cost instead of turning into whitespace.
  - Each column carries its typical hold. Hovering one says how much of it ran hands-off, what it lost since the column before, and what landed as a merged pull request; hovering an arm says how much stopped there and whether it was called off, still holding the column, or left without a decision.
  - The first rung reads Entered, not Intake: that board column also holds live GitHub and Linear candidates with no work item behind them, which the page cannot count.
  - Pull requests the Factory reviewed are counted beside the funnel — a count and only a count, since whether they went on to merge is the team's decision rather than the Factory's work.

  **Why reach and not time-to-ship.** On a real board almost nothing that lands in Done has passed through Execute and Review: Done is where cards get closed, not where work lands. A "shipped in this window, this fast, this hands-off" figure reads off that same history and cannot stand behind any of the three. Reach can, from the same records, so that is what the page reports.

  Under the funnel: what is stalled, what is running now, the latest commits, and a preview of activity and of what needs you.

  **Board traffic has its own Activity page** at `/factories/:id/activity`, reading as a rail cut by day. It shows everything the Factory did, not only stage moves — the board's own stage history for the moves, and the audit trail for the runs started, commits, pushes and comments a move is not, two sources that never describe the same fact.

  - Each entry reads as a sentence: who acted, what they did, which card, hung off a coloured bead on one continuous rail.
  - A card walked through several stages by one actor folds into a single chain instead of repeating its title, and neighbours saying the same thing about a different card become one sentence with those cards listed in a panel under it.
  - Days are cut by a ruled heading and each row carries its minute on the right edge, so a screenful reads as prose down the middle rather than as a column of timestamps.

  **The attention inbox and the rule effects page now read on that same rail** — cut by day, each row hanging off the mark of what it is (the kind of message, or the status of the effect) and carrying its time on the right edge, so the three pages are one surface instead of three list styles. The attention inbox also paginates like they do: older items load as the list is scrolled instead of waiting on a click.

  **Every page opens at its top.** The data router carried the window scroll across navigations, so leaving a scrolled Overview landed on Activity halfway down it.

### Patch Changes

- Factory panels now take their shadow and their chart ramp from the design system instead of redeclaring them, so they stay in step with every other surface when those tokens change. ([#22713](https://github.com/mastra-ai/mastra/pull/22713))

- Audit log range picking moves off the chart and onto a ruler below it. ([#22709](https://github.com/mastra-ai/mastra/pull/22709))

  **The chart is display-only.** Marks outside the selected range fade instead of being framed by a drag rectangle, gridlines follow the day ticks and fade out top and bottom, and dashed guides mark the selected limits.

  **The ruler under it carries a single translucent lens.** Drag its sides to resize, drag its body to slide the window; the day and time of each edge read above and below it. Selection is continuous down to the minute rather than snapped, so a window of a few minutes is as reachable as one of several days, and the exact range also reads out next to the event count. Arrow keys nudge an edge, Escape returns to the full range.

  **On narrow screens the lens gives way to 1h/6h/24h/7d chips.** A full-width drag surface left no room for precise handles and blocked vertical scrolling.

  **The axis stops moving under the marks.** It now spans everything loaded rather than the current category filter, so toggling a category no longer rescales it, and the chart holds a fixed height at any width instead of squashing its lanes on a narrow screen. Each category lane carries a faint dotted rule, so a mark reads as sitting on its lane and a chart with nothing to plot still shows its shape rather than going blank.

  **An empty log says so** instead of drawing a chart over an invented seven-day window — filtering to a category with no events used to shift the axis onto dates where nothing had happened — and the empty states now say what is missing and how to get back.

- Fixed authenticated workspace skill runs so tenant OAuth credentials remain available to agent and memory models. ([#22721](https://github.com/mastra-ai/mastra/pull/22721))

- Added `GET /web/github/projects/:id/commits` (optional `branch`, `limit`), which lists recent commits for an installed repository. ([#22709](https://github.com/mastra-ai/mastra/pull/22709))

  It reads with the same installation token that already clones and pushes, rather than through `getInstallationOctokit`: the Platform build answers that call with a stub carrying pull-request reads only, so anything reaching for `repos.*` would have been undefined at runtime while the cast kept the compiler quiet.

- Fixed automated runs abandoning their session when a run is re-prepared (for example after a server restart). The run now lands back in the work item's existing session for that role instead of creating a replacement — so the session keeps its original owner instead of switching to whoever approved the run, and no orphaned sandbox is left behind. ([#22410](https://github.com/mastra-ai/mastra/pull/22410))

- Updated dependencies [[`733bb9a`](https://github.com/mastra-ai/mastra/commit/733bb9aa28fa35623be50b340b59cd3dd66002c9)]:
  - @mastra/code-sdk@1.6.0-alpha.3

## 0.12.0-alpha.4

### Patch Changes

- Updated dependencies [[`724467e`](https://github.com/mastra-ai/mastra/commit/724467ee03a5861490559e4afc652aec1b8e817b)]:
  - @mastra/code-sdk@1.6.0-alpha.2

## 0.12.0-alpha.3

### Minor Changes

- Slack threads and work-item feeds are now one conversation seen from two windows. ([#22641](https://github.com/mastra-ai/mastra/pull/22641))

  **Slack → feed** — a message starting with `aside`, the human chatter the agent deliberately never answers, now lands as a comment on the card the thread created. A sender who has linked their Slack account is attributed to their Mastra user; an unlinked one is stored under their Slack identity and display name, so the thread stays complete either way.

  **Feed → Slack** — a comment written in the Factory feed is posted into the bound Slack thread, attributed as `**Name**: body` (the app cannot post as the commenter).

  A Slack card is now keyed by workspace as well as thread: `ExternalWorkItemSource` grows an optional `workspaceId`, and `externalSourceKey` — the one builder cards and mirrored comments now share — includes it. A channel id and a message `ts` only identify a thread inside the workspace that issued them, so without it two workspaces running the same app could share a key: an aside could land on another tenant's card, or recover their comment instead of storing its own. Cards created before this ships keep their unscoped key, and the lookup still accepts that older form, so their threads keep syncing. Nothing writes it any more, so the set only shrinks.

  Both directions are create-only: comment edits and deletions do not propagate, and Slack edits and deletions never reach the feed because the adapter does not deliver those events to handlers. Mirroring stays best-effort — a failed post is logged, not retried — and it runs past the response: the comment is stored and its feed frame is out before the platform is called, so writing a comment never waits on Slack. `createComment` hands the in-flight mirror back as `mirrored` for callers that need to observe it. Slack's own client is now given a 15s per-request timeout, which it did not have; its default retry policy can otherwise sit on a rate-limited `chat.postMessage` for about thirty minutes.

  A channel integration opts in by implementing the new `feedPublisher` slot alongside `channels`:

  ```ts
  class SlackIntegration implements FactoryIntegration {
    channels(ctx: IntegrationContext) {
      return createSlackChannelsConfig({ ...deps, feed: ctx.feed });
    }

    feedPublisher(ctx: IntegrationContext) {
      return new SlackFeedPublisher({ controller: ctx.controller });
    }
  }
  ```

### Patch Changes

- Factory badges now follow the unified design-system `Badge`: same soft corners, inset ring and size scale everywhere, and each badge names the color it wants rather than a mood. Provider access, model packs and the model picker keep their meaning — green for a working credential, blue for one that comes from the org or the environment — but they now read as one family instead of three slightly different pills. ([#22640](https://github.com/mastra-ai/mastra/pull/22640))

- Improved Factory PR reviews by treating external CI status and issue links as advisory context while keeping independently verified defects blocking. ([#22667](https://github.com/mastra-ai/mastra/pull/22667))

- Updated dependencies [[`a3606a0`](https://github.com/mastra-ai/mastra/commit/a3606a09f3deaeef17caf04b9c6a0d7cd6b80fe6), [`4095752`](https://github.com/mastra-ai/mastra/commit/40957529233d202446ebecab1f59c76e99910230), [`a3606a0`](https://github.com/mastra-ai/mastra/commit/a3606a09f3deaeef17caf04b9c6a0d7cd6b80fe6)]:
  - @mastra/core@1.63.3-alpha.1
  - @mastra/code-sdk@1.6.0-alpha.1

## 0.12.0-alpha.2

### Minor Changes

- Board lanes now mean engagement: a card enters a working lane only when a run starts on it or a person moves it there, and resting a card takes the Factory's hand off it. ([#22531](https://github.com/mastra-ai/mastra/pull/22531))

  Every GitHub issue and pull request arrives in Intake. Trust moved out of the column layout and onto the card: arrivals are stamped with whether the Factory may pick them up on its own, an **External** mark shows cards the execution gate treats as externally authored, and a card whose run the Factory would start shows that as a suggestion you can release with a click. Reviewing means a review is running — before, a maintainer's pull request was born there with nothing reviewing it.

  Consent follows the same line. A person's drag into a working lane hands the Factory the work; any entry into Intake, Done or Canceled takes it back, whoever rested the card — a verdict, a mirrored close, a drag. The close-out run a resting transition queued still fires, pre-approved by the transition that committed it. An external event can no longer pull a rested card back into a working lane or start a run on it without a person's consent, and a card from an author without write access never self-starts — even armed, even with auto-run on. A GitHub card missing its trust stamp — created before stamps existed — fails closed and asks too. The reconcile sweep keeps the stamp current in both directions: it backfills missing stamps and withdraws trust from authors whose write access was revoked, each within one sweep cycle (a few minutes by default); the Factory's own pull requests count as trusted through their authorship.

  A card parked in Intake offers Resume as its primary action, re-entering the deepest seat it used, and asking the card's agent in chat to resume does the same through the governed transition. Dragging a card out no longer opens a session just to say so: the stop notice reaches whichever session is live on the card, or nobody. A run landing its card in a lane no longer dispatches a second run.

### Patch Changes

- The reconcile sweep now records author trust for cards it had stopped visiting, so a board whose cards reached Done or Canceled before trust was recorded gets its answers on the next sweep instead of never. The board's External mark reads a recorded answer instead of the absence of one, so a card nobody was ever asked about is no longer labelled an outside contribution. The execution-consent gate is unchanged: a card with no recorded answer still asks for a person before it starts a run. ([#22644](https://github.com/mastra-ai/mastra/pull/22644))

## 0.12.0-alpha.1

### Minor Changes

- Attention now rides the project feed stream: an automation failure, a proposal parked for approval, an approval, a dismissal, a retry, a supersede or a work-item deletion reaches every open page as it happens, and the attention list falls back to polling only while its stream is down. ([#22604](https://github.com/mastra-ai/mastra/pull/22604))

  Marking your own list read stays local — a read receipt changes nobody else's view, so it is not broadcast.

- Commenting on a work item now notifies everyone already in that discussion, not just the people it names. Participants land in a separate `activity` tier of `GET /web/factory/projects/:id/attention`, counted apart under `activityUnreadCount` so the notification badge and sound stay reserved for mentions and failures. The attention inbox also refreshes while open now: comment-driven entries arrive over the feed stream, and the list polls every 5s for the rest. The sidebar popover asks the server for the badge tier (`?tier=badge`), so busy discussions can no longer crowd mentions and failures out of its five slots. ([#22571](https://github.com/mastra-ai/mastra/pull/22571))

- Work item comment feeds now update live instead of on a five-second poll: while a browser holds its feed stream, a new comment shows up the moment it lands, and a browser whose stream dropped falls back to the old poll until it reconnects. ([#22570](https://github.com/mastra-ai/mastra/pull/22570))

  Delivery rides the factory's `pubsub`, so reaching browsers across replicas takes a shared broker — the in-process default only serves readers held by the replica that took the write:

  ```ts
  import { MastraFactory } from '@mastra/factory';
  import { RedisStreamsPubSub } from '@mastra/redis-streams';

  export const factory = new MastraFactory({
    pubsub: new RedisStreamsPubSub({ url: process.env.REDIS_URL }),
  });
  ```

### Patch Changes

- The completion chime is lower and longer. It swells into a soft tail that rings out over about two and a half seconds, instead of the short ding that stopped dead almost as soon as it started. ([#22566](https://github.com/mastra-ai/mastra/pull/22566))

  It is also much louder than the chime it replaces. If you leave the completion sound on, check your volume after this release.

## 0.12.0-alpha.0

### Minor Changes

- **BREAKING: `sandbox` is now a callback that constructs the session's sandbox** ([#22065](https://github.com/mastra-ai/mastra/pull/22065))

  ```ts
  // Before — no longer accepted
  sandbox: { machine: new RailwaySandbox({ apiToken }), workdir: '/workspace', maxSandboxes: 4 }

  // After
  sandbox: ctx => new E2BSandbox({ id: ctx.sessionId })
  ```

  A factory still configured with the old options object fails at `prepare()` with a message showing the replacement: `machine` becomes the provider instance you construct inside the callback, `workdir` is gone (remote providers clone into the VM's home directory, local providers use their own `workingDirectory`), and `maxSandboxes` is gone with the fleet. Omit `sandbox` entirely to run without sandboxes. `ctx.getRepositoryAccess` resolves the session repository's clone URL plus a fresh short-lived credential (`undefined` when the session has no repository), so providers can authenticate work such as private-repo template builds.

  Session sandboxes now boot lazily at the first real command instead of being provisioned up front. The sandbox fleet (pooling, budgets, reattach/revival, base checkpoints) is deleted, and the `/ensure` endpoint and the session UI's "preparing sandbox" step go with it — opening a thread provisions nothing. To check whether a sandbox is configured, read `sandboxEnabled` from `GET /web/github/status`.

  A failing setup command no longer wedges the session. The first failure surfaces loudly in the tool result that triggered it, then later starts skip the known-bad command — the clone and branch checkout still run, so the agent can repair or rerun setup itself. Infrastructure failures (clone, checkout, transport) keep failing hard and retry in full.

  Existing databases keep the fleet-era tables and columns as untouched orphans; dropping them is a manual operation.

### Patch Changes

- Hosted sessions no longer leak the host process's environment into the system prompt. The dynamic instructions builder drops its `process.cwd()` fallback: a session without a `projectPath` gets no working directory, no host git-branch probe, and loads no instruction files at all (project locations would resolve against the server's cwd and global locations against the server's homedir). Factory additionally blanks the SDK's default project identity seed (`projectPath`/`projectName`/`gitBranch` from the host's own checkout) so chat-only sessions show "(no workspace attached)" instead of the server's repo and branch; repo-backed sessions keep getting their real session workdir pinned by workspace resolution. ([#22065](https://github.com/mastra-ai/mastra/pull/22065))

- Updated dependencies [[`3910c77`](https://github.com/mastra-ai/mastra/commit/3910c77413a3058ab270c6dbc74a59bc3cdf67ea), [`c80547a`](https://github.com/mastra-ai/mastra/commit/c80547aa7ef33adbb08435ff847e77fa404bafbf), [`c80547a`](https://github.com/mastra-ai/mastra/commit/c80547aa7ef33adbb08435ff847e77fa404bafbf), [`c80547a`](https://github.com/mastra-ai/mastra/commit/c80547aa7ef33adbb08435ff847e77fa404bafbf)]:
  - @mastra/core@1.63.3-alpha.0
  - @mastra/code-sdk@1.6.0-alpha.0

## 0.11.1

### Patch Changes

- Improved Factory reviews for verified docs corrections and third-party review boilerplate. ([#22554](https://github.com/mastra-ai/mastra/pull/22554))

- Updated dependencies [[`0a9d29c`](https://github.com/mastra-ai/mastra/commit/0a9d29c0c4dbbaa6afc1c8146cdd41759cbd4002)]:
  - @mastra/core@1.63.2
  - @mastra/code-sdk@1.5.3

## 0.11.1-alpha.0

### Patch Changes

- Improved Factory reviews for verified docs corrections and third-party review boilerplate. ([#22554](https://github.com/mastra-ai/mastra/pull/22554))

- Updated dependencies [[`0a9d29c`](https://github.com/mastra-ai/mastra/commit/0a9d29c0c4dbbaa6afc1c8146cdd41759cbd4002)]:
  - @mastra/core@1.63.2-alpha.0
  - @mastra/code-sdk@1.5.3-alpha.0

## 0.11.0

### Minor Changes

- Agent runs now read the work item's recent discussion at kickoff. The last 20 comments ride the kickoff message, so a teammate's context reaches the agent without anyone copy-pasting it into a prompt. ([#22466](https://github.com/mastra-ai/mastra/pull/22466))

  The block is bounded to 20 comments and a 12,000 character budget, and it is framed as untrusted data: comment bodies, author names and quotes are escaped so a comment cannot forge the block's boundaries.

- Added comments to Factory work items. Every work item now stores a comment thread with quoted replies and @mentions, served by new routes for listing, posting, editing and deleting. ([#22464](https://github.com/mastra-ai/mastra/pull/22464))

  - Posts are idempotent: a client token means a retried send never duplicates a comment
  - Edits carry the revision they were written against, so two people editing the same comment get a conflict instead of silent last-write-wins
  - Deletes are tombstones, so ordering and replies stay stable
  - Listing accepts `?around=<commentId>`, returning the page that holds that comment plus everything newer, so a link to a comment opens on it in one request
  - A mention writes an attention record, and the attention inbox now merges mentions with automation failures instead of serving one hardcoded kind

### Patch Changes

- The Factory attention inbox now lists mentions alongside automation failures. A mention row opens the board card it was posted on, and read, archive and restore behave the same on both kinds. ([#22465](https://github.com/mastra-ai/mastra/pull/22465))

- Board card details now open as a bottom sheet on phones instead of a popover anchored to the card. The sheet fills the width, scrolls, and closes with a swipe down. On desktop the card keeps morphing into its popover. ([#22525](https://github.com/mastra-ai/mastra/pull/22525))

- The work item comment feed is now on the board card and in the session's workspace panel. Opening a card lands on the conversation: a long description collapses behind "Show more", the feed scrolls in its own region, and the composer sits under it. ([#22467](https://github.com/mastra-ai/mastra/pull/22467))

  Comments post without waiting for the server, quote a selected passage when you reply, autocomplete @mentions from the project roster, and can be edited or deleted in place. Cards show a comment count, and a comment someone posts elsewhere appears on an open feed within a few seconds. Opening a mention from the attention inbox lands on the card with that comment centred and highlighted.

- Improved Factory reviews and re-reviews. They now check issue scope and feature approval, verify behavior with provider integrations, and compare new implementations with existing ones. Re-reviews also verify the current head and regressions after new pushes. ([#22472](https://github.com/mastra-ai/mastra/pull/22472))

- Moved the chat transcript's streamed-reply pacing onto the shared `@mastra/playground-ui/components/ai/message-reveal` module. Nothing changes in what the transcript draws: a reply still arrives part by part, at the pace it was written. ([#22408](https://github.com/mastra-ai/mastra/pull/22408))

- Factory-hosted sessions now start with `factoryOrgUnresolved: true`, so a session whose organization seeding fails refuses knowledge capture instead of writing to the local knowledge graph. Successful org seeding still clears the marker and a resolved organization still takes precedence. ([#21823](https://github.com/mastra-ai/mastra/pull/21823))

- Project the bounded knowledge-node description into graph snapshots (hover synopsis); long-form content stays on the node detail view. ([#21830](https://github.com/mastra-ai/mastra/pull/21830))

- Fixed the board's review flow around deleted and freshly minted sessions. Deleting a session now also removes the session references work items held on it, so a card stops offering a session that no longer exists. Cards now trust their own session links instead of cross-checking the sidebar's workspace list, so the Review button flips to "Open session" as soon as an automated run binds its session — it used to stay stuck on "Review". While a run is underway its card now reads "Automated run in progress…" instead of "Starting an automated run…". ([#22409](https://github.com/mastra-ai/mastra/pull/22409))

- Fixed chat state staying stale after a connection drop: when the event stream reconnects, the session state is refetched along with the messages, so a run that started or ended during the gap is reflected right away. ([#22432](https://github.com/mastra-ai/mastra/pull/22432))

- Fixed the Factory sidebar reordering itself when you open a session. Opening a work or review session used to move its row to the top of its group, so the list shifted under your cursor as you clicked through it. Rows now keep their creation order, and a session that would sit past the first five rows is shown anyway, so you always see a row for the session you are in. ([#22411](https://github.com/mastra-ai/mastra/pull/22411))

- Fix knowledge captured in factory sessions being stored in the wrong tenant. ([#21823](https://github.com/mastra-ai/mastra/pull/21823))

  Knowledge captured during a factory session is now always stored under the organization
  that owns the session, so it is visible in that organization's knowledge graph. A session
  whose organization cannot be determined no longer stores knowledge somewhere it could
  never be read back from; it stops capturing and reports why. Local (TUI/studio) use is
  unaffected and captures under a dedicated local scope.

- Updated dependencies [[`bae1502`](https://github.com/mastra-ai/mastra/commit/bae150254b06a4da6964d7c137af97f336362359), [`f7c4d1a`](https://github.com/mastra-ai/mastra/commit/f7c4d1ab8c9490c460c7642902eabc9d96dbd497), [`0885364`](https://github.com/mastra-ai/mastra/commit/0885364c2fc7fa31febcfc444fc1ba5231ac1257), [`b8cb683`](https://github.com/mastra-ai/mastra/commit/b8cb683ba66499df254ddd1f7edd8cae3f89d2e7), [`078affd`](https://github.com/mastra-ai/mastra/commit/078affdaea57ac5e95a77e9e7b197d1878190684), [`9e3403e`](https://github.com/mastra-ai/mastra/commit/9e3403e9868240cb18841898e84cf008ebd7a87e), [`00707f3`](https://github.com/mastra-ai/mastra/commit/00707f376a7cea7a26ce8a18ddfaefdc947dcf5a), [`791bf5e`](https://github.com/mastra-ai/mastra/commit/791bf5e81cd27e2e1cff66122f1380ab8a3dda41)]:
  - @mastra/core@1.63.1
  - @mastra/code-sdk@1.5.2

## 0.10.2-alpha.3

### Patch Changes

- Updated dependencies [[`b8cb683`](https://github.com/mastra-ai/mastra/commit/b8cb683ba66499df254ddd1f7edd8cae3f89d2e7)]:
  - @mastra/core@1.63.1-alpha.3
  - @mastra/code-sdk@1.5.2-alpha.3

## 0.10.2-alpha.2

### Patch Changes

- Project the bounded knowledge-node description into graph snapshots (hover synopsis); long-form content stays on the node detail view. ([#21830](https://github.com/mastra-ai/mastra/pull/21830))

- Updated dependencies [[`f7c4d1a`](https://github.com/mastra-ai/mastra/commit/f7c4d1ab8c9490c460c7642902eabc9d96dbd497), [`0885364`](https://github.com/mastra-ai/mastra/commit/0885364c2fc7fa31febcfc444fc1ba5231ac1257)]:
  - @mastra/code-sdk@1.5.2-alpha.2
  - @mastra/core@1.63.1-alpha.2

## 0.10.2-alpha.1

### Patch Changes

- Factory-hosted sessions now start with `factoryOrgUnresolved: true`, so a session whose organization seeding fails refuses knowledge capture instead of writing to the local knowledge graph. Successful org seeding still clears the marker and a resolved organization still takes precedence. ([#21823](https://github.com/mastra-ai/mastra/pull/21823))

- Fix knowledge captured in factory sessions being stored in the wrong tenant. ([#21823](https://github.com/mastra-ai/mastra/pull/21823))

  Knowledge captured during a factory session is now always stored under the organization
  that owns the session, so it is visible in that organization's knowledge graph. A session
  whose organization cannot be determined no longer stores knowledge somewhere it could
  never be read back from; it stops capturing and reports why. Local (TUI/studio) use is
  unaffected and captures under a dedicated local scope.

- Updated dependencies [[`078affd`](https://github.com/mastra-ai/mastra/commit/078affdaea57ac5e95a77e9e7b197d1878190684), [`9e3403e`](https://github.com/mastra-ai/mastra/commit/9e3403e9868240cb18841898e84cf008ebd7a87e), [`00707f3`](https://github.com/mastra-ai/mastra/commit/00707f376a7cea7a26ce8a18ddfaefdc947dcf5a), [`791bf5e`](https://github.com/mastra-ai/mastra/commit/791bf5e81cd27e2e1cff66122f1380ab8a3dda41)]:
  - @mastra/core@1.63.1-alpha.1
  - @mastra/code-sdk@1.5.2-alpha.1

## 0.10.2-alpha.0

### Patch Changes

- Moved the chat transcript's streamed-reply pacing onto the shared `@mastra/playground-ui/components/ai/message-reveal` module. Nothing changes in what the transcript draws: a reply still arrives part by part, at the pace it was written. ([#22408](https://github.com/mastra-ai/mastra/pull/22408))

- Fixed the board's review flow around deleted and freshly minted sessions. Deleting a session now also removes the session references work items held on it, so a card stops offering a session that no longer exists. Cards now trust their own session links instead of cross-checking the sidebar's workspace list, so the Review button flips to "Open session" as soon as an automated run binds its session — it used to stay stuck on "Review". While a run is underway its card now reads "Automated run in progress…" instead of "Starting an automated run…". ([#22409](https://github.com/mastra-ai/mastra/pull/22409))

- Fixed chat state staying stale after a connection drop: when the event stream reconnects, the session state is refetched along with the messages, so a run that started or ended during the gap is reflected right away. ([#22432](https://github.com/mastra-ai/mastra/pull/22432))

- Fixed the Factory sidebar reordering itself when you open a session. Opening a work or review session used to move its row to the top of its group, so the list shifted under your cursor as you clicked through it. Rows now keep their creation order, and a session that would sit past the first five rows is shown anyway, so you always see a row for the session you are in. ([#22411](https://github.com/mastra-ai/mastra/pull/22411))

- Updated dependencies [[`bae1502`](https://github.com/mastra-ai/mastra/commit/bae150254b06a4da6964d7c137af97f336362359)]:
  - @mastra/core@1.63.1-alpha.0
  - @mastra/code-sdk@1.5.2-alpha.0

## 0.10.1

### Patch Changes

- Fixed the Work and Review boards always showing a horizontal scrollbar for people whose system draws classic (space-taking) scrollbars. The board's scroll area now reserves its scrollbar gutter, so the filter toolbar — sized to the visible width of that area — can no longer end up wider than the space it has to fit in. ([#22371](https://github.com/mastra-ai/mastra/pull/22371))

- Factory pages now share one app shell instead of two near-identical private ones. The shell takes a `scroll` prop naming who owns the scrolling — `document` for pages that scroll natively, `viewport` for chat pages whose content owns nested scroll regions — so a page can no longer silently pick the wrong frame. ([#22366](https://github.com/mastra-ai/mastra/pull/22366))

- Reworked the settings pages so every option reads as the same kind of row. ([#22375](https://github.com/mastra-ai/mastra/pull/22375))

  - **Work Intake** is now one section per source — GitHub issues, Linear issues, and Linear routing — instead of both sources stacked in a single card. Linear's connection state (connect, reconnect, expired, workspace name) moved into its section header. Both sources now use the same picker: one search box that spans every Linear team instead of a search per collapsed team, with the repositories and projects listed straight away, inset from the card edges and scrolling in the same scroll area the rest of the app uses.
  - **Memory** renders observational-memory options as regular settings rows instead of a stacked block with its own padding.
  - **Models** shows the Provider access tabs above the card instead of inside it, and each provider is a settings row rather than a data-list row.
  - **Repositories** gives the setup and teardown commands one row each, per repository, with the command field on the right like every other setting and a line saying when it runs. Both save on their own when you leave the field, so there is no save button to hunt for.
  - **Repositories** lists the repositories you can link the same way — a standard search field, rows aligned with the card, and grouped under "Linked" and "Available" instead of each row drawing its own box.
  - Section actions such as "Manage GitHub connection" now sit on the right of the section title instead of below the description.

- Removed the app shell's blanket overflow clipping. Every scroll region already declares its own scroll container, so the shell-level clipping only hid layout bugs by silently cutting content; a genuine overflow now shows up as a visible scrollbar instead. ([#22345](https://github.com/mastra-ai/mastra/pull/22345))

- Factory now uses Mona Sans across the whole app, matching Studio, instead of the system font. ([#22385](https://github.com/mastra-ai/mastra/pull/22385))

  The sidebar was retuned to go with it: each section is titled by what it lists, with an icon for work items, review sessions and user sessions, and the "Factory" title is gone since the links under it name themselves.

- Retuned the Factory chat so the composer and the tool output read as part of the conversation. ([#22403](https://github.com/mastra-ai/mastra/pull/22403))

  - The text you type is now the same size as the transcript, in a softer grey, on a lighter box.
  - The composer sits slightly wider than the messages above it and closer to the bottom edge, at every screen width.
  - Slash command suggestions highlight the selected row against the lighter composer instead of blending into it.
  - Diff blocks inside a tool call sit one step above the chat surface, so they read as a block again.

- Updated dependencies [[`7176362`](https://github.com/mastra-ai/mastra/commit/717636281a3339911a05ea2cc8ae38afe4fd2cef), [`9045b8f`](https://github.com/mastra-ai/mastra/commit/9045b8fdf622e1d735b96ddd6500bd32556636d9), [`7677a2c`](https://github.com/mastra-ai/mastra/commit/7677a2cd47729221ca28afc5067d26e22d925b59), [`e3b796d`](https://github.com/mastra-ai/mastra/commit/e3b796d29a63f0d5c97dd815aadec40687346d70), [`f7a7467`](https://github.com/mastra-ai/mastra/commit/f7a74678193921e7ea4790232d707b3237626cac), [`49ccd14`](https://github.com/mastra-ai/mastra/commit/49ccd142268a61fb55ea75bc76287643a21f3677), [`f9c56f3`](https://github.com/mastra-ai/mastra/commit/f9c56f336ee8c250763a438990f8e60a428353c9), [`3855b38`](https://github.com/mastra-ai/mastra/commit/3855b38c4c25af32ab8e298e148becc963abe92c)]:
  - @mastra/core@1.63.0
  - @mastra/slack@1.6.2
  - @mastra/code-sdk@1.5.1

## 0.10.1-alpha.1

### Patch Changes

- Factory now uses Mona Sans across the whole app, matching Studio, instead of the system font. ([#22385](https://github.com/mastra-ai/mastra/pull/22385))

  The sidebar was retuned to go with it: each section is titled by what it lists, with an icon for work items, review sessions and user sessions, and the "Factory" title is gone since the links under it name themselves.

- Retuned the Factory chat so the composer and the tool output read as part of the conversation. ([#22403](https://github.com/mastra-ai/mastra/pull/22403))

  - The text you type is now the same size as the transcript, in a softer grey, on a lighter box.
  - The composer sits slightly wider than the messages above it and closer to the bottom edge, at every screen width.
  - Slash command suggestions highlight the selected row against the lighter composer instead of blending into it.
  - Diff blocks inside a tool call sit one step above the chat surface, so they read as a block again.

- Updated dependencies [[`7677a2c`](https://github.com/mastra-ai/mastra/commit/7677a2cd47729221ca28afc5067d26e22d925b59), [`f7a7467`](https://github.com/mastra-ai/mastra/commit/f7a74678193921e7ea4790232d707b3237626cac), [`f9c56f3`](https://github.com/mastra-ai/mastra/commit/f9c56f336ee8c250763a438990f8e60a428353c9)]:
  - @mastra/core@1.63.0-alpha.1
  - @mastra/code-sdk@1.5.1-alpha.1

## 0.10.1-alpha.0

### Patch Changes

- Fixed the Work and Review boards always showing a horizontal scrollbar for people whose system draws classic (space-taking) scrollbars. The board's scroll area now reserves its scrollbar gutter, so the filter toolbar — sized to the visible width of that area — can no longer end up wider than the space it has to fit in. ([#22371](https://github.com/mastra-ai/mastra/pull/22371))

- Factory pages now share one app shell instead of two near-identical private ones. The shell takes a `scroll` prop naming who owns the scrolling — `document` for pages that scroll natively, `viewport` for chat pages whose content owns nested scroll regions — so a page can no longer silently pick the wrong frame. ([#22366](https://github.com/mastra-ai/mastra/pull/22366))

- Reworked the settings pages so every option reads as the same kind of row. ([#22375](https://github.com/mastra-ai/mastra/pull/22375))

  - **Work Intake** is now one section per source — GitHub issues, Linear issues, and Linear routing — instead of both sources stacked in a single card. Linear's connection state (connect, reconnect, expired, workspace name) moved into its section header. Both sources now use the same picker: one search box that spans every Linear team instead of a search per collapsed team, with the repositories and projects listed straight away, inset from the card edges and scrolling in the same scroll area the rest of the app uses.
  - **Memory** renders observational-memory options as regular settings rows instead of a stacked block with its own padding.
  - **Models** shows the Provider access tabs above the card instead of inside it, and each provider is a settings row rather than a data-list row.
  - **Repositories** gives the setup and teardown commands one row each, per repository, with the command field on the right like every other setting and a line saying when it runs. Both save on their own when you leave the field, so there is no save button to hunt for.
  - **Repositories** lists the repositories you can link the same way — a standard search field, rows aligned with the card, and grouped under "Linked" and "Available" instead of each row drawing its own box.
  - Section actions such as "Manage GitHub connection" now sit on the right of the section title instead of below the description.

- Removed the app shell's blanket overflow clipping. Every scroll region already declares its own scroll container, so the shell-level clipping only hid layout bugs by silently cutting content; a genuine overflow now shows up as a visible scrollbar instead. ([#22345](https://github.com/mastra-ai/mastra/pull/22345))

- Updated dependencies [[`7176362`](https://github.com/mastra-ai/mastra/commit/717636281a3339911a05ea2cc8ae38afe4fd2cef), [`e3b796d`](https://github.com/mastra-ai/mastra/commit/e3b796d29a63f0d5c97dd815aadec40687346d70), [`49ccd14`](https://github.com/mastra-ai/mastra/commit/49ccd142268a61fb55ea75bc76287643a21f3677), [`3855b38`](https://github.com/mastra-ai/mastra/commit/3855b38c4c25af32ab8e298e148becc963abe92c)]:
  - @mastra/core@1.63.0-alpha.0
  - @mastra/slack@1.6.2-alpha.0
  - @mastra/code-sdk@1.5.1-alpha.0

## 0.10.0

### Minor Changes

- Added a **Regenerate title** action to a session's ⋯ menu in the sidebar. It re-names the conversation with the model that names threads on their own — the owner's observational-memory observer model — and mirrors the new name onto the session row. ([#22156](https://github.com/mastra-ai/mastra/pull/22156))

  Use it on sessions that were started before automatic naming, or whose name no longer matches where the conversation went. Naming runs as the session's owner, so it resolves their stored provider credentials, and it never materializes a workspace: a session that has been closed for weeks can still be re-named.

- Factory session names in the sidebar now follow the thread's generated title instead of freezing on the raw first prompt. ([#22156](https://github.com/mastra-ai/mastra/pull/22156))

  A chat session used to keep the exact text you first typed ("Tell me what have been done in the factory since…"), and a work session showed its branch ("factory/pr-22160"), even though Mastra had already named the underlying thread "PR review approval". The session row now mirrors that title from whichever namer produced it — the first turn, the observational-memory observer, or an explicit rename — and reconciles against the stored thread title whenever the session is reopened, so sessions started before this also get named.

- Added encryption at rest for Factory-managed provider credentials, GitHub PATs, and integration OAuth tokens, including automatic migration and key rotation support. ([#22152](https://github.com/mastra-ai/mastra/pull/22152))

- **Card details open in place** ([#22257](https://github.com/mastra-ai/mastra/pull/22257))

  Clicking a board card expands it over itself instead of opening a centered dialog, so you keep your place in the column. The panel carries the card's labels, stage, related cards, activity and the source's own description — the GitHub issue or pull request body, the Linear issue description — with the same actions the card menu offers. It is as tall as what it holds, so a card whose source has no description opens onto a short panel and a description arriving from the fetch grows the box into place; re-opening a card paints from cache. Everything the card already showed keeps its exact place while the box grows and folds back around it; only the description and the actions are staged in. A link to the card's source, a collapse button and the actions menu sit in the panel's top corner, and the main action spans the footer — which is “Open session” when the card already has one, instead of offering to start a duplicate.

  Descriptions are read through the Factory server with the org's own GitHub installation and Linear connection, scoped to the sources bound to that Factory project, so no provider token reaches the browser and a board only ever reads its own sources.

  **A faster board, and a way to search it**

  Boards with hundreds of cards no longer redraw all of them on every poll: each column renders a page of cards at a time and reveals the next as you scroll it, offscreen cards skip layout and paint, relationships between cards resolve in one pass instead of once per card, and the activity feed reads a bounded window of the audit trail rather than replaying the project's whole history on every visit.

  Because a column now shows a page at a time, the board filter bar carries a search: type a card's title or its issue key (`#812`, `ENG-42`) and matching cards surface however deep they sat. It narrows before the paging, composes with the teammate and label filters, and lives in the URL (`?q=`), so a narrowed board is a link you can share.

- Added a durable Factory action center for unresolved automation failures and proposed work waiting for approval. Per-user read/archive receipts survive reloads, while retries and canonical reconciliation resolve failures for every project member. ([#22021](https://github.com/mastra-ai/mastra/pull/22021))

  Historical decision state is repaired on startup: accepted transitions become `succeeded`, obsolete terminal work and proposals become `superseded`, and active unresolved failures remain `failed`. Retry is offered only when the persisted failure code allows it.

  **Before**

  ```ts
  // Failed automation and proposed runs were visible only on their board cards.
  ```

  **After**

  ```ts
  const attention = await fetch(`/web/factory/projects/${factoryId}/attention`).then(response => response.json());
  // attention.items: per-user unresolved failures
  // attention.approvalCount: project-wide proposed work
  ```

- Improved the Factory audit log with a density timeline, category filters, responsive rows, and automatic history loading. Intake binding changes now appear in the affected project's audit history. ([#22023](https://github.com/mastra-ai/mastra/pull/22023))

  ```ts
  const response = await fetch(`/web/factory/projects/${factoryProjectId}/audit?actions=factory.run.started&limit=50`);
  const page = await response.json();
  ```

### Patch Changes

- Improved the work and review boards on small screens. Column headers now stay pinned while scrolling below the desktop breakpoint, and columns use a fixed width instead of scaling with the viewport. ([#22329](https://github.com/mastra-ai/mastra/pull/22329))

- Factory pull request review reports now show their selected model and reasoning setting: ([#22238](https://github.com/mastra-ai/mastra/pull/22238))

  ```text
  Review runtime: openai/gpt-5.6-sol, reasoning setting: high.
  ```

- Improved how streamed replies move: one document, one pace, and a transcript that stops shifting under the reader. ([#22299](https://github.com/mastra-ai/mastra/pull/22299))

  **Fixed**

  - A reply streams in the order it was written, on one clock: prose reveals word by word (thinking passages included), tool rows and cards land between the words they were written between, and a burst of parallel calls cascades in one at a time instead of dropping as a block.
  - Rows no longer replay their entrance mid-run. Adopting the server's message id, the run rotating its message at a step, a slot getting its content, or a tool run ending all used to remount rows the reader was watching — a row now keeps its bubble, its element and its place from the moment it lands.
  - Reply text split across content blocks is parsed as one markdown document, so a list item cut mid-stream no longer renders as an empty bullet followed by a paragraph.
  - Focusing the window mid-run no longer duplicates the streaming reply or jumps the scroll.
  - Steering a running reply no longer clears the view: the steer slides in under the stream instead of parking at the top with an empty screen of room beneath it, and steering while scrolled up brings the reader back to the live end.
  - An agent question fills its reserved slot without rebuilding the text around it, and the "Thinking" line settles its sweep and fades under the first output instead of vanishing mid-sweep.

  **Changed**

  - Sending a message parks it near the top of the view with most of the screen reserved beneath, so the answer grows into empty space and nothing moves while it fits that room.
  - Opening a thread that is still answering follows the stream from the live end, instead of holding the reading position it restored.
  - A run of tool calls the reader watched arrive stays expanded. Compacting into a "N steps" row is what reloaded history does; a live turn stays as it played, including in a session opened mid-run.
  - The timestamp and copy button land once, under the finished reply, and copy the whole answer — instead of once per persisted step, mid-run.
  - Long transcripts redraw only the entry a token changed, so streaming stays responsive.

- Fixed Factory lifecycle automation so feature requests and other non-bug work require explicit human approval before entering Planning or Execute, including when automatic runs are enabled. ([#22304](https://github.com/mastra-ai/mastra/pull/22304))

- Fixed automated runs for manually created board cards. Moving a manual card into Planning or Building no longer fails with 'Factory skill invocation requires a supported issue or pull request identifier'. Manual cards now start on a stable `factory/item-<id>` branch, even without a provider identity. ([#22114](https://github.com/mastra-ai/mastra/pull/22114))

- Improved scrolling on the factory work and review boards. The filter bar and column headers stay pinned while you scroll, the board scrolls natively edge to edge instead of inside nested scroll areas, and it no longer opens scrolled partway across the columns. ([#22326](https://github.com/mastra-ai/mastra/pull/22326))

- Fixed retried Factory skill runs so they deliver a fresh kickoff after execution errors while preserving duplicate protection during lease recovery. ([#21926](https://github.com/mastra-ai/mastra/pull/21926))

- Fix: Attribute approved Factory runs to the approver, not the repo connector. The approve route now persists `approved_by` on the deferred decision, session preparation prefers the approver's identity over the repository connector's, and `prepareRunStart` stamps only the starting role's session instead of repointing every role. Closes #22254. ([#22256](https://github.com/mastra-ai/mastra/pull/22256))

- Repair Factory-authored pull request review cards when GitHub provenance and the opened webhook arrive out of order, preserving any parent relationship already assigned. ([#22167](https://github.com/mastra-ai/mastra/pull/22167))

- Fix skill kickoffs delivered into a terminating run being consumed without execution. The decision dispatcher now observes the run's end after a kickoff is delivered into an active run: if that run finishes without executing the kickoff, it is redelivered to wake the idle session, and if the run never ends before the observation deadline the pending start or decision is failed for retry instead of being silently completed. ([#22263](https://github.com/mastra-ai/mastra/pull/22263))

- Added display names and avatars to Factory user session owner information. ([#22341](https://github.com/mastra-ai/mastra/pull/22341))

- Intake listings no longer fail as a whole when one provider is down. `GET /web/intake/sources` and `GET /web/intake/items` now query every connected provider concurrently and isolate the ones that error, returning what the healthy providers answered plus a `failures` entry per broken provider so the UI can show a per-source error instead of an empty board. ([#22289](https://github.com/mastra-ai/mastra/pull/22289))

  ```json
  {
    "sources": [{ "integrationId": "github", "id": "repo-1", "name": "acme/app", "type": "repository" }],
    "failures": [{ "integrationId": "linear", "message": "Linear token expired" }]
  }
  ```

  A provider that hangs is given up on after 15 seconds and reported the same way, so an unresponsive one can't hold the request open either.

  A provider that fails mid-pagination keeps the cursor it came in with, so the next page resumes where it left off instead of replaying its first page.

- Factory skill playbooks in Settings › Agent › Skills now render as formatted markdown instead of a wall of plain text, with a toggle on hover to read the raw SKILL.md source. Long skills scroll inside the card rather than stretching the page. ([#22018](https://github.com/mastra-ai/mastra/pull/22018))

- add installable PWA metadata and device icons to the Factory UI ([#22051](https://github.com/mastra-ai/mastra/pull/22051))

- Fixed the Factory board and session sidebar reshuffling while you read them. Cards and sessions are now ordered by when they were created, not by when they were last touched. A background sync or an agent run no longer moves a card. In the sidebar, a session whose pull request is merged or closed now sits below the ones still open, unless its agent is still working or left output you have not read. ([#21949](https://github.com/mastra-ai/mastra/pull/21949))

- Fixed Factory rule composition so explicitly disabled handlers stay disabled across repeated merges. ([#21924](https://github.com/mastra-ai/mastra/pull/21924))

- Made secret encryption opt-in instead of mandatory when auth is enabled. `MastraFactory.prepare()` no longer throws when `secretEncryption` is omitted with auth on; it logs a boot-time warning and falls back to plaintext credential storage. Providing `secretEncryption` (for example via `FACTORY_CREDENTIAL_ENCRYPTION_KEY`) remains the recommended configuration for encrypting stored model-provider keys, custom-provider API keys, and integration secrets at rest. ([#22259](https://github.com/mastra-ai/mastra/pull/22259))

- Fixed session timing measurements that started too early or missed workspace tool activity. ([#22213](https://github.com/mastra-ai/mastra/pull/22213))

  **First interaction time**
  Starts on the first user or assistant message. Signal-only messages (skill loads, phase markers, memory reminders) and sessions that fail before a message no longer affect this metric.

  **First meaningful tool time**
  Starts when the first workspace tool completes successfully. File operations and workspace searches count even when no shell command runs. Approval-denied and abort-while-parked tool completions are excluded because the tool never actually ran.

- Fixed the Factory board's Intake column claiming "Intake is clear" when a candidate feed had actually failed. A GitHub or Linear feed that errors now shows what went wrong with a Retry, and the Linear reconnect notice keeps its own message. ([#22289](https://github.com/mastra-ai/mastra/pull/22289))

- Fixed Factory issue triage to update its existing handoff comment across retries. ([#22303](https://github.com/mastra-ai/mastra/pull/22303))

- Fixed merged pull requests only reaching one of the two Factory cards that track them. A merge now both moves the Review card to Done and asks the work item that opened the pull request to assess whether its work is finished, no matter which card the merge event resolved to. ([#22135](https://github.com/mastra-ai/mastra/pull/22135))

- Updated dependencies [[`79f04a7`](https://github.com/mastra-ai/mastra/commit/79f04a7f6c6829da541139f638f2f1d267916e08), [`65edab1`](https://github.com/mastra-ai/mastra/commit/65edab1c233d17b8f163bad12fca410d0e6f16b1), [`1e47b75`](https://github.com/mastra-ai/mastra/commit/1e47b7520cab4cfaa8daed52f17e2e6d14ff7539), [`ab20a38`](https://github.com/mastra-ai/mastra/commit/ab20a38d0275f8d85e0f3833bd87ef487bcc609f), [`fd4d5fe`](https://github.com/mastra-ai/mastra/commit/fd4d5fe4f943699b85db5e74404f190d5a6b8c2a), [`ae8790c`](https://github.com/mastra-ai/mastra/commit/ae8790c4bfaa088d2ab279d1dcc06f326b9fd109), [`2c85f42`](https://github.com/mastra-ai/mastra/commit/2c85f428e04ccd63ea31a7ec80b5b327afdad555), [`04a815f`](https://github.com/mastra-ai/mastra/commit/04a815fc8971d29e97fcdcc5008a1eb472fc00ff), [`11bbeb9`](https://github.com/mastra-ai/mastra/commit/11bbeb9b108ef2264e05acefc6dafb9cbb342921), [`48ef1f1`](https://github.com/mastra-ai/mastra/commit/48ef1f1d24eedafbb07f64e659a81b52b67b8bf6), [`aa3a85d`](https://github.com/mastra-ai/mastra/commit/aa3a85daf094c683bb97efdf4b6a696d2e474af5), [`d29d06f`](https://github.com/mastra-ai/mastra/commit/d29d06fe00bbd35b4571150ea04c59d2ed783c71), [`e6516df`](https://github.com/mastra-ai/mastra/commit/e6516dfcdae4f4ac0e7971d84359a81385ee602f), [`1a485f3`](https://github.com/mastra-ai/mastra/commit/1a485f3538f5ec64d58bd8b5e1e99de0c695c87b), [`0d37487`](https://github.com/mastra-ai/mastra/commit/0d37487d9f349388a3f1cef6a536cf9dcc4b6273), [`8661d7d`](https://github.com/mastra-ai/mastra/commit/8661d7d7179f0a024456aabdd8679bcecd09ac28), [`dbbfeb8`](https://github.com/mastra-ai/mastra/commit/dbbfeb85ec949dc9ebc0755e1ad262e4f5eba8db), [`575e343`](https://github.com/mastra-ai/mastra/commit/575e343900451021d96110916497d334af7bc252), [`0b2a3d1`](https://github.com/mastra-ai/mastra/commit/0b2a3d1783875c5b97b7b36ab3d03d7360e0dde7), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`3cc9d00`](https://github.com/mastra-ai/mastra/commit/3cc9d00b2b4333e0377a5e9df5eff92c17ce7630), [`cacb839`](https://github.com/mastra-ai/mastra/commit/cacb8392d9e74189b56d857290b0615f98a2683d), [`57de7d6`](https://github.com/mastra-ai/mastra/commit/57de7d644ba7146edb4e9e6111ec4fa98c3a59e9), [`c8e4cea`](https://github.com/mastra-ai/mastra/commit/c8e4ceac9a390d78c8327dff3cdb2861dd71957f), [`ed01e9a`](https://github.com/mastra-ai/mastra/commit/ed01e9a807514a904374bf687a7b8f18750f6f78), [`b47b26e`](https://github.com/mastra-ai/mastra/commit/b47b26e6fe95cb8a3482be2c5e52de157fe59d0b), [`0d37487`](https://github.com/mastra-ai/mastra/commit/0d37487d9f349388a3f1cef6a536cf9dcc4b6273), [`733a537`](https://github.com/mastra-ai/mastra/commit/733a537489a858b5880b2e98809334fba895a221), [`e8e299c`](https://github.com/mastra-ai/mastra/commit/e8e299cc6abdfc39947e2fec25803493015d3882), [`edfc548`](https://github.com/mastra-ai/mastra/commit/edfc548886bc7bae17b681f8b6b41a47eb32bcd2), [`b05f486`](https://github.com/mastra-ai/mastra/commit/b05f48612984d5fe2447ea2d6cdd5c604d285b97), [`a8a4871`](https://github.com/mastra-ai/mastra/commit/a8a4871215f51da95c47129602157ce5372f634a), [`41c24e3`](https://github.com/mastra-ai/mastra/commit/41c24e376e1c61974af9aa0b48d4e0091e476dcc), [`eb9ecaa`](https://github.com/mastra-ai/mastra/commit/eb9ecaa89c36e889749e3b825cfc507ce7f7980b), [`4ff3ee2`](https://github.com/mastra-ai/mastra/commit/4ff3ee2bff7ed07528b4817f8f49639031c72a4d), [`9207dfa`](https://github.com/mastra-ai/mastra/commit/9207dfab8062e5fc68b751684797ff86fe0b4e70), [`5165cdc`](https://github.com/mastra-ai/mastra/commit/5165cdcdcf50e144bb8113278535196cc9b07065), [`e737014`](https://github.com/mastra-ai/mastra/commit/e737014e0fc7035759762bb5b48baef1d6c0f6a7), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`f591643`](https://github.com/mastra-ai/mastra/commit/f591643becdf0be9bddce6ba1748e64bc30d77f1), [`63796ba`](https://github.com/mastra-ai/mastra/commit/63796ba0fda60253be17535e68f6bbbf1e6ffa09), [`b1ad324`](https://github.com/mastra-ai/mastra/commit/b1ad324d657f3544b0701332aef7eb10e9a36258), [`61c566d`](https://github.com/mastra-ai/mastra/commit/61c566dd2f2cde2b23ed8f139924e530d4202214), [`c24754c`](https://github.com/mastra-ai/mastra/commit/c24754c1fb6fe144e5051e536e98c8a18b0214ac), [`12c61d2`](https://github.com/mastra-ai/mastra/commit/12c61d280c8cb208bc3c8dbcbe5dcc60cf9d1cd0), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`c46eb09`](https://github.com/mastra-ai/mastra/commit/c46eb09ce4987509af57a0ac582c61241a6dd2f1), [`9ee8120`](https://github.com/mastra-ai/mastra/commit/9ee8120ce17f76b9f617489e05a283353742690a), [`d975e92`](https://github.com/mastra-ai/mastra/commit/d975e924d4936f46c386bd3dee39c671720289f6), [`45dd6ee`](https://github.com/mastra-ai/mastra/commit/45dd6ee089bd7df0d0c98a10098e483fd388e04a), [`4e9a228`](https://github.com/mastra-ai/mastra/commit/4e9a2283d5fd6ed1b70a2751eb3dc2cbf82ada20), [`d6ce34a`](https://github.com/mastra-ai/mastra/commit/d6ce34aeceb06ddf3d595a1eed5cc74f481a46a1), [`f95f468`](https://github.com/mastra-ai/mastra/commit/f95f468cf1e7c2b924a13826494f98b8f2ccd581), [`30ed33e`](https://github.com/mastra-ai/mastra/commit/30ed33ee14084a26019aba15fceadda6d6ddefaf), [`04a815f`](https://github.com/mastra-ai/mastra/commit/04a815fc8971d29e97fcdcc5008a1eb472fc00ff), [`1cfa878`](https://github.com/mastra-ai/mastra/commit/1cfa8784d8da0dfaa0317e5048bc48b6084a5ea5), [`9a12ef3`](https://github.com/mastra-ai/mastra/commit/9a12ef3fccf3f4186db0f294f4ee1f02cf4d8db2), [`32d3583`](https://github.com/mastra-ai/mastra/commit/32d358332cb8ac2306b83b73cf3536e74dbd435e), [`7960688`](https://github.com/mastra-ai/mastra/commit/7960688828e04eaf3106e34f7758fa580257eef6), [`91ad69d`](https://github.com/mastra-ai/mastra/commit/91ad69d64994c89199b0c55399e64ed91c61df2f), [`8dc408d`](https://github.com/mastra-ai/mastra/commit/8dc408d34438f9e13297f792c11a5cfd6cf952e1), [`c92def1`](https://github.com/mastra-ai/mastra/commit/c92def10a13c822972c96f0a4ca6ffc1f4258aed), [`63041eb`](https://github.com/mastra-ai/mastra/commit/63041eb4c50b520a0a80e03d4cd6ea99f67715a0), [`c118318`](https://github.com/mastra-ai/mastra/commit/c1183181c9804303db4b511c2e2648f8b714712b), [`c5eaec5`](https://github.com/mastra-ai/mastra/commit/c5eaec5a860d80d0e3805e67db0414b87ac8cbed), [`fc07c64`](https://github.com/mastra-ai/mastra/commit/fc07c6465043e08e99193a6751a01c56ffc2e7a1), [`cced745`](https://github.com/mastra-ai/mastra/commit/cced745a056ec2225c5bc702e32d848847aa8b65), [`542dee2`](https://github.com/mastra-ai/mastra/commit/542dee254167f974ff8cbbbfc0ce10f9a2616a7b), [`3c19dce`](https://github.com/mastra-ai/mastra/commit/3c19dcef8e73062a80627a4927eae3ec11145afd), [`aca2869`](https://github.com/mastra-ai/mastra/commit/aca2869b2031982f3c4a2f52525c9be7cf123ef8), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`e6f8450`](https://github.com/mastra-ai/mastra/commit/e6f845074d478527026b18d85031b23353e1d0a4), [`895e9df`](https://github.com/mastra-ai/mastra/commit/895e9dfc17d6f34299eca64e317ded9e5f5e5ef8), [`e66b2ba`](https://github.com/mastra-ai/mastra/commit/e66b2ba100db63eaeab6e21e1ea34b113f2ec781), [`3e8727e`](https://github.com/mastra-ai/mastra/commit/3e8727e11ec1a5d733acedb5c872896394be18c1)]:
  - @mastra/core@1.62.0
  - @mastra/code-sdk@1.5.0

## 0.10.0-alpha.14

### Patch Changes

- Updated dependencies [[`48ef1f1`](https://github.com/mastra-ai/mastra/commit/48ef1f1d24eedafbb07f64e659a81b52b67b8bf6), [`63796ba`](https://github.com/mastra-ai/mastra/commit/63796ba0fda60253be17535e68f6bbbf1e6ffa09), [`3c19dce`](https://github.com/mastra-ai/mastra/commit/3c19dcef8e73062a80627a4927eae3ec11145afd)]:
  - @mastra/core@1.62.0-alpha.12
  - @mastra/code-sdk@1.5.0-alpha.12

## 0.10.0-alpha.13

### Patch Changes

- Improved the work and review boards on small screens. Column headers now stay pinned while scrolling below the desktop breakpoint, and columns use a fixed width instead of scaling with the viewport. ([#22329](https://github.com/mastra-ai/mastra/pull/22329))

- Improved how streamed replies move: one document, one pace, and a transcript that stops shifting under the reader. ([#22299](https://github.com/mastra-ai/mastra/pull/22299))

  **Fixed**

  - A reply streams in the order it was written, on one clock: prose reveals word by word (thinking passages included), tool rows and cards land between the words they were written between, and a burst of parallel calls cascades in one at a time instead of dropping as a block.
  - Rows no longer replay their entrance mid-run. Adopting the server's message id, the run rotating its message at a step, a slot getting its content, or a tool run ending all used to remount rows the reader was watching — a row now keeps its bubble, its element and its place from the moment it lands.
  - Reply text split across content blocks is parsed as one markdown document, so a list item cut mid-stream no longer renders as an empty bullet followed by a paragraph.
  - Focusing the window mid-run no longer duplicates the streaming reply or jumps the scroll.
  - Steering a running reply no longer clears the view: the steer slides in under the stream instead of parking at the top with an empty screen of room beneath it, and steering while scrolled up brings the reader back to the live end.
  - An agent question fills its reserved slot without rebuilding the text around it, and the "Thinking" line settles its sweep and fades under the first output instead of vanishing mid-sweep.

  **Changed**

  - Sending a message parks it near the top of the view with most of the screen reserved beneath, so the answer grows into empty space and nothing moves while it fits that room.
  - Opening a thread that is still answering follows the stream from the live end, instead of holding the reading position it restored.
  - A run of tool calls the reader watched arrive stays expanded. Compacting into a "N steps" row is what reloaded history does; a live turn stays as it played, including in a session opened mid-run.
  - The timestamp and copy button land once, under the finished reply, and copy the whole answer — instead of once per persisted step, mid-run.
  - Long transcripts redraw only the entry a token changed, so streaming stays responsive.

- Fixed Factory lifecycle automation so feature requests and other non-bug work require explicit human approval before entering Planning or Execute, including when automatic runs are enabled. ([#22304](https://github.com/mastra-ai/mastra/pull/22304))

- Improved scrolling on the factory work and review boards. The filter bar and column headers stay pinned while you scroll, the board scrolls natively edge to edge instead of inside nested scroll areas, and it no longer opens scrolled partway across the columns. ([#22326](https://github.com/mastra-ai/mastra/pull/22326))

- Added display names and avatars to Factory user session owner information. ([#22341](https://github.com/mastra-ai/mastra/pull/22341))

- Updated dependencies [[`4ff3ee2`](https://github.com/mastra-ai/mastra/commit/4ff3ee2bff7ed07528b4817f8f49639031c72a4d), [`c24754c`](https://github.com/mastra-ai/mastra/commit/c24754c1fb6fe144e5051e536e98c8a18b0214ac), [`45dd6ee`](https://github.com/mastra-ai/mastra/commit/45dd6ee089bd7df0d0c98a10098e483fd388e04a), [`32d3583`](https://github.com/mastra-ai/mastra/commit/32d358332cb8ac2306b83b73cf3536e74dbd435e), [`aca2869`](https://github.com/mastra-ai/mastra/commit/aca2869b2031982f3c4a2f52525c9be7cf123ef8)]:
  - @mastra/core@1.62.0-alpha.11
  - @mastra/code-sdk@1.5.0-alpha.11

## 0.10.0-alpha.12

### Patch Changes

- Intake listings no longer fail as a whole when one provider is down. `GET /web/intake/sources` and `GET /web/intake/items` now query every connected provider concurrently and isolate the ones that error, returning what the healthy providers answered plus a `failures` entry per broken provider so the UI can show a per-source error instead of an empty board. ([#22289](https://github.com/mastra-ai/mastra/pull/22289))

  ```json
  {
    "sources": [{ "integrationId": "github", "id": "repo-1", "name": "acme/app", "type": "repository" }],
    "failures": [{ "integrationId": "linear", "message": "Linear token expired" }]
  }
  ```

  A provider that hangs is given up on after 15 seconds and reported the same way, so an unresponsive one can't hold the request open either.

  A provider that fails mid-pagination keeps the cursor it came in with, so the next page resumes where it left off instead of replaying its first page.

- Fixed the Factory board's Intake column claiming "Intake is clear" when a candidate feed had actually failed. A GitHub or Linear feed that errors now shows what went wrong with a Retry, and the Linear reconnect notice keeps its own message. ([#22289](https://github.com/mastra-ai/mastra/pull/22289))

## 0.10.0-alpha.11

### Patch Changes

- Fixed Factory issue triage to update its existing handoff comment across retries. ([#22303](https://github.com/mastra-ai/mastra/pull/22303))

## 0.10.0-alpha.10

### Minor Changes

- **Card details open in place** ([#22257](https://github.com/mastra-ai/mastra/pull/22257))

  Clicking a board card expands it over itself instead of opening a centered dialog, so you keep your place in the column. The panel carries the card's labels, stage, related cards, activity and the source's own description — the GitHub issue or pull request body, the Linear issue description — with the same actions the card menu offers. It is as tall as what it holds, so a card whose source has no description opens onto a short panel and a description arriving from the fetch grows the box into place; re-opening a card paints from cache. Everything the card already showed keeps its exact place while the box grows and folds back around it; only the description and the actions are staged in. A link to the card's source, a collapse button and the actions menu sit in the panel's top corner, and the main action spans the footer — which is “Open session” when the card already has one, instead of offering to start a duplicate.

  Descriptions are read through the Factory server with the org's own GitHub installation and Linear connection, scoped to the sources bound to that Factory project, so no provider token reaches the browser and a board only ever reads its own sources.

  **A faster board, and a way to search it**

  Boards with hundreds of cards no longer redraw all of them on every poll: each column renders a page of cards at a time and reveals the next as you scroll it, offscreen cards skip layout and paint, relationships between cards resolve in one pass instead of once per card, and the activity feed reads a bounded window of the audit trail rather than replaying the project's whole history on every visit.

  Because a column now shows a page at a time, the board filter bar carries a search: type a card's title or its issue key (`#812`, `ENG-42`) and matching cards surface however deep they sat. It narrows before the paging, composes with the teammate and label filters, and lives in the URL (`?q=`), so a narrowed board is a link you can share.

### Patch Changes

- Updated dependencies [[`b05f486`](https://github.com/mastra-ai/mastra/commit/b05f48612984d5fe2447ea2d6cdd5c604d285b97), [`41c24e3`](https://github.com/mastra-ai/mastra/commit/41c24e376e1c61974af9aa0b48d4e0091e476dcc), [`7960688`](https://github.com/mastra-ai/mastra/commit/7960688828e04eaf3106e34f7758fa580257eef6)]:
  - @mastra/core@1.62.0-alpha.10
  - @mastra/code-sdk@1.5.0-alpha.10

## 0.10.0-alpha.9

### Patch Changes

- Updated dependencies [[`eb9ecaa`](https://github.com/mastra-ai/mastra/commit/eb9ecaa89c36e889749e3b825cfc507ce7f7980b), [`3e8727e`](https://github.com/mastra-ai/mastra/commit/3e8727e11ec1a5d733acedb5c872896394be18c1)]:
  - @mastra/core@1.62.0-alpha.9
  - @mastra/code-sdk@1.5.0-alpha.9

## 0.10.0-alpha.8

### Minor Changes

- Added a **Regenerate title** action to a session's ⋯ menu in the sidebar. It re-names the conversation with the model that names threads on their own — the owner's observational-memory observer model — and mirrors the new name onto the session row. ([#22156](https://github.com/mastra-ai/mastra/pull/22156))

  Use it on sessions that were started before automatic naming, or whose name no longer matches where the conversation went. Naming runs as the session's owner, so it resolves their stored provider credentials, and it never materializes a workspace: a session that has been closed for weeks can still be re-named.

- Factory session names in the sidebar now follow the thread's generated title instead of freezing on the raw first prompt. ([#22156](https://github.com/mastra-ai/mastra/pull/22156))

  A chat session used to keep the exact text you first typed ("Tell me what have been done in the factory since…"), and a work session showed its branch ("factory/pr-22160"), even though Mastra had already named the underlying thread "PR review approval". The session row now mirrors that title from whichever namer produced it — the first turn, the observational-memory observer, or an explicit rename — and reconciles against the stored thread title whenever the session is reopened, so sessions started before this also get named.

- Added encryption at rest for Factory-managed provider credentials, GitHub PATs, and integration OAuth tokens, including automatic migration and key rotation support. ([#22152](https://github.com/mastra-ai/mastra/pull/22152))

### Patch Changes

- Fix: Attribute approved Factory runs to the approver, not the repo connector. The approve route now persists `approved_by` on the deferred decision, session preparation prefers the approver's identity over the repository connector's, and `prepareRunStart` stamps only the starting role's session instead of repointing every role. Closes #22254. ([#22256](https://github.com/mastra-ai/mastra/pull/22256))

- Repair Factory-authored pull request review cards when GitHub provenance and the opened webhook arrive out of order, preserving any parent relationship already assigned. ([#22167](https://github.com/mastra-ai/mastra/pull/22167))

- Fix skill kickoffs delivered into a terminating run being consumed without execution. The decision dispatcher now observes the run's end after a kickoff is delivered into an active run: if that run finishes without executing the kickoff, it is redelivered to wake the idle session, and if the run never ends before the observation deadline the pending start or decision is failed for retry instead of being silently completed. ([#22263](https://github.com/mastra-ai/mastra/pull/22263))

- Fixed the Factory board and session sidebar reshuffling while you read them. Cards and sessions are now ordered by when they were created, not by when they were last touched. A background sync or an agent run no longer moves a card. In the sidebar, a session whose pull request is merged or closed now sits below the ones still open, unless its agent is still working or left output you have not read. ([#21949](https://github.com/mastra-ai/mastra/pull/21949))

- Fixed Factory rule composition so explicitly disabled handlers stay disabled across repeated merges. ([#21924](https://github.com/mastra-ai/mastra/pull/21924))

- Made secret encryption opt-in instead of mandatory when auth is enabled. `MastraFactory.prepare()` no longer throws when `secretEncryption` is omitted with auth on; it logs a boot-time warning and falls back to plaintext credential storage. Providing `secretEncryption` (for example via `FACTORY_CREDENTIAL_ENCRYPTION_KEY`) remains the recommended configuration for encrypting stored model-provider keys, custom-provider API keys, and integration secrets at rest. ([#22259](https://github.com/mastra-ai/mastra/pull/22259))

- Updated dependencies [[`aa3a85d`](https://github.com/mastra-ai/mastra/commit/aa3a85daf094c683bb97efdf4b6a696d2e474af5), [`d29d06f`](https://github.com/mastra-ai/mastra/commit/d29d06fe00bbd35b4571150ea04c59d2ed783c71), [`e6516df`](https://github.com/mastra-ai/mastra/commit/e6516dfcdae4f4ac0e7971d84359a81385ee602f), [`0b2a3d1`](https://github.com/mastra-ai/mastra/commit/0b2a3d1783875c5b97b7b36ab3d03d7360e0dde7), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`57de7d6`](https://github.com/mastra-ai/mastra/commit/57de7d644ba7146edb4e9e6111ec4fa98c3a59e9), [`e8e299c`](https://github.com/mastra-ai/mastra/commit/e8e299cc6abdfc39947e2fec25803493015d3882), [`edfc548`](https://github.com/mastra-ai/mastra/commit/edfc548886bc7bae17b681f8b6b41a47eb32bcd2), [`a8a4871`](https://github.com/mastra-ai/mastra/commit/a8a4871215f51da95c47129602157ce5372f634a), [`5165cdc`](https://github.com/mastra-ai/mastra/commit/5165cdcdcf50e144bb8113278535196cc9b07065), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`6bb5d71`](https://github.com/mastra-ai/mastra/commit/6bb5d7193fe9166b219f0fccae17db7a5ae86e65), [`9ee8120`](https://github.com/mastra-ai/mastra/commit/9ee8120ce17f76b9f617489e05a283353742690a), [`d975e92`](https://github.com/mastra-ai/mastra/commit/d975e924d4936f46c386bd3dee39c671720289f6), [`1cfa878`](https://github.com/mastra-ai/mastra/commit/1cfa8784d8da0dfaa0317e5048bc48b6084a5ea5), [`c118318`](https://github.com/mastra-ai/mastra/commit/c1183181c9804303db4b511c2e2648f8b714712b), [`fc07c64`](https://github.com/mastra-ai/mastra/commit/fc07c6465043e08e99193a6751a01c56ffc2e7a1), [`542dee2`](https://github.com/mastra-ai/mastra/commit/542dee254167f974ff8cbbbfc0ce10f9a2616a7b), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`a58483c`](https://github.com/mastra-ai/mastra/commit/a58483cff1a9d41fce7c931843f48cb0ac450f64), [`895e9df`](https://github.com/mastra-ai/mastra/commit/895e9dfc17d6f34299eca64e317ded9e5f5e5ef8)]:
  - @mastra/core@1.62.0-alpha.8
  - @mastra/code-sdk@1.5.0-alpha.8

## 0.10.0-alpha.7

### Patch Changes

- Factory pull request review reports now show their selected model and reasoning setting: ([#22238](https://github.com/mastra-ai/mastra/pull/22238))

  ```text
  Review runtime: openai/gpt-5.6-sol, reasoning setting: high.
  ```

- Fixed retried Factory skill runs so they deliver a fresh kickoff after execution errors while preserving duplicate protection during lease recovery. ([#21926](https://github.com/mastra-ai/mastra/pull/21926))

- Fixed session timing measurements that started too early or missed workspace tool activity. ([#22213](https://github.com/mastra-ai/mastra/pull/22213))

  **First interaction time**
  Starts on the first user or assistant message. Signal-only messages (skill loads, phase markers, memory reminders) and sessions that fail before a message no longer affect this metric.

  **First meaningful tool time**
  Starts when the first workspace tool completes successfully. File operations and workspace searches count even when no shell command runs. Approval-denied and abort-while-parked tool completions are excluded because the tool never actually ran.

- Updated dependencies [[`ae8790c`](https://github.com/mastra-ai/mastra/commit/ae8790c4bfaa088d2ab279d1dcc06f326b9fd109), [`04a815f`](https://github.com/mastra-ai/mastra/commit/04a815fc8971d29e97fcdcc5008a1eb472fc00ff), [`04a815f`](https://github.com/mastra-ai/mastra/commit/04a815fc8971d29e97fcdcc5008a1eb472fc00ff), [`cced745`](https://github.com/mastra-ai/mastra/commit/cced745a056ec2225c5bc702e32d848847aa8b65)]:
  - @mastra/core@1.62.0-alpha.7
  - @mastra/code-sdk@1.5.0-alpha.7

## 0.10.0-alpha.6

### Patch Changes

- Updated dependencies [[`c8e4cea`](https://github.com/mastra-ai/mastra/commit/c8e4ceac9a390d78c8327dff3cdb2861dd71957f), [`ed01e9a`](https://github.com/mastra-ai/mastra/commit/ed01e9a807514a904374bf687a7b8f18750f6f78), [`4e9a228`](https://github.com/mastra-ai/mastra/commit/4e9a2283d5fd6ed1b70a2751eb3dc2cbf82ada20), [`63041eb`](https://github.com/mastra-ai/mastra/commit/63041eb4c50b520a0a80e03d4cd6ea99f67715a0)]:
  - @mastra/core@1.62.0-alpha.6
  - @mastra/code-sdk@1.5.0-alpha.6

## 0.10.0-alpha.5

### Patch Changes

- Fixed automated runs for manually created board cards. Moving a manual card into Planning or Building no longer fails with 'Factory skill invocation requires a supported issue or pull request identifier'. Manual cards now start on a stable `factory/item-<id>` branch, even without a provider identity. ([#22114](https://github.com/mastra-ai/mastra/pull/22114))

- Updated dependencies [[`65edab1`](https://github.com/mastra-ai/mastra/commit/65edab1c233d17b8f163bad12fca410d0e6f16b1), [`ab20a38`](https://github.com/mastra-ai/mastra/commit/ab20a38d0275f8d85e0f3833bd87ef487bcc609f), [`dbbfeb8`](https://github.com/mastra-ai/mastra/commit/dbbfeb85ec949dc9ebc0755e1ad262e4f5eba8db), [`3cc9d00`](https://github.com/mastra-ai/mastra/commit/3cc9d00b2b4333e0377a5e9df5eff92c17ce7630), [`733a537`](https://github.com/mastra-ai/mastra/commit/733a537489a858b5880b2e98809334fba895a221), [`9207dfa`](https://github.com/mastra-ai/mastra/commit/9207dfab8062e5fc68b751684797ff86fe0b4e70), [`12c61d2`](https://github.com/mastra-ai/mastra/commit/12c61d280c8cb208bc3c8dbcbe5dcc60cf9d1cd0), [`9a12ef3`](https://github.com/mastra-ai/mastra/commit/9a12ef3fccf3f4186db0f294f4ee1f02cf4d8db2)]:
  - @mastra/core@1.62.0-alpha.5
  - @mastra/code-sdk@1.5.0-alpha.5

## 0.10.0-alpha.4

### Patch Changes

- Updated dependencies [[`79f04a7`](https://github.com/mastra-ai/mastra/commit/79f04a7f6c6829da541139f638f2f1d267916e08), [`fd4d5fe`](https://github.com/mastra-ai/mastra/commit/fd4d5fe4f943699b85db5e74404f190d5a6b8c2a), [`f591643`](https://github.com/mastra-ai/mastra/commit/f591643becdf0be9bddce6ba1748e64bc30d77f1), [`b1ad324`](https://github.com/mastra-ai/mastra/commit/b1ad324d657f3544b0701332aef7eb10e9a36258), [`61c566d`](https://github.com/mastra-ai/mastra/commit/61c566dd2f2cde2b23ed8f139924e530d4202214)]:
  - @mastra/core@1.62.0-alpha.4
  - @mastra/code-sdk@1.5.0-alpha.4

## 0.10.0-alpha.3

### Minor Changes

- Added a durable Factory action center for unresolved automation failures and proposed work waiting for approval. Per-user read/archive receipts survive reloads, while retries and canonical reconciliation resolve failures for every project member. ([#22021](https://github.com/mastra-ai/mastra/pull/22021))

  Historical decision state is repaired on startup: accepted transitions become `succeeded`, obsolete terminal work and proposals become `superseded`, and active unresolved failures remain `failed`. Retry is offered only when the persisted failure code allows it.

  **Before**

  ```ts
  // Failed automation and proposed runs were visible only on their board cards.
  ```

  **After**

  ```ts
  const attention = await fetch(`/web/factory/projects/${factoryId}/attention`).then(response => response.json());
  // attention.items: per-user unresolved failures
  // attention.approvalCount: project-wide proposed work
  ```

### Patch Changes

- Fixed merged pull requests only reaching one of the two Factory cards that track them. A merge now both moves the Review card to Done and asks the work item that opened the pull request to assess whether its work is finished, no matter which card the merge event resolved to. ([#22135](https://github.com/mastra-ai/mastra/pull/22135))

- Updated dependencies [[`2c85f42`](https://github.com/mastra-ai/mastra/commit/2c85f428e04ccd63ea31a7ec80b5b327afdad555), [`11bbeb9`](https://github.com/mastra-ai/mastra/commit/11bbeb9b108ef2264e05acefc6dafb9cbb342921), [`1a485f3`](https://github.com/mastra-ai/mastra/commit/1a485f3538f5ec64d58bd8b5e1e99de0c695c87b), [`0d37487`](https://github.com/mastra-ai/mastra/commit/0d37487d9f349388a3f1cef6a536cf9dcc4b6273), [`8661d7d`](https://github.com/mastra-ai/mastra/commit/8661d7d7179f0a024456aabdd8679bcecd09ac28), [`575e343`](https://github.com/mastra-ai/mastra/commit/575e343900451021d96110916497d334af7bc252), [`cacb839`](https://github.com/mastra-ai/mastra/commit/cacb8392d9e74189b56d857290b0615f98a2683d), [`b47b26e`](https://github.com/mastra-ai/mastra/commit/b47b26e6fe95cb8a3482be2c5e52de157fe59d0b), [`0d37487`](https://github.com/mastra-ai/mastra/commit/0d37487d9f349388a3f1cef6a536cf9dcc4b6273), [`c46eb09`](https://github.com/mastra-ai/mastra/commit/c46eb09ce4987509af57a0ac582c61241a6dd2f1), [`30ed33e`](https://github.com/mastra-ai/mastra/commit/30ed33ee14084a26019aba15fceadda6d6ddefaf), [`91ad69d`](https://github.com/mastra-ai/mastra/commit/91ad69d64994c89199b0c55399e64ed91c61df2f), [`8dc408d`](https://github.com/mastra-ai/mastra/commit/8dc408d34438f9e13297f792c11a5cfd6cf952e1), [`c92def1`](https://github.com/mastra-ai/mastra/commit/c92def10a13c822972c96f0a4ca6ffc1f4258aed), [`c5eaec5`](https://github.com/mastra-ai/mastra/commit/c5eaec5a860d80d0e3805e67db0414b87ac8cbed), [`e66b2ba`](https://github.com/mastra-ai/mastra/commit/e66b2ba100db63eaeab6e21e1ea34b113f2ec781)]:
  - @mastra/core@1.62.0-alpha.3
  - @mastra/code-sdk@1.5.0-alpha.3

## 0.10.0-alpha.2

### Patch Changes

- add installable PWA metadata and device icons to the Factory UI ([#22051](https://github.com/mastra-ai/mastra/pull/22051))

- Updated dependencies [[`e737014`](https://github.com/mastra-ai/mastra/commit/e737014e0fc7035759762bb5b48baef1d6c0f6a7), [`d6ce34a`](https://github.com/mastra-ai/mastra/commit/d6ce34aeceb06ddf3d595a1eed5cc74f481a46a1), [`e6f8450`](https://github.com/mastra-ai/mastra/commit/e6f845074d478527026b18d85031b23353e1d0a4)]:
  - @mastra/core@1.62.0-alpha.2
  - @mastra/code-sdk@1.4.1-alpha.2

## 0.10.0-alpha.1

### Patch Changes

- Updated dependencies [[`f95f468`](https://github.com/mastra-ai/mastra/commit/f95f468cf1e7c2b924a13826494f98b8f2ccd581)]:
  - @mastra/core@1.61.1-alpha.1
  - @mastra/code-sdk@1.4.1-alpha.1

## 0.10.0-alpha.0

### Minor Changes

- Improved the Factory audit log with a density timeline, category filters, responsive rows, and automatic history loading. Intake binding changes now appear in the affected project's audit history. ([#22023](https://github.com/mastra-ai/mastra/pull/22023))

  ```ts
  const response = await fetch(`/web/factory/projects/${factoryProjectId}/audit?actions=factory.run.started&limit=50`);
  const page = await response.json();
  ```

### Patch Changes

- Factory skill playbooks in Settings › Agent › Skills now render as formatted markdown instead of a wall of plain text, with a toggle on hover to read the raw SKILL.md source. Long skills scroll inside the card rather than stretching the page. ([#22018](https://github.com/mastra-ai/mastra/pull/22018))

- Updated dependencies [[`1e47b75`](https://github.com/mastra-ai/mastra/commit/1e47b7520cab4cfaa8daed52f17e2e6d14ff7539)]:
  - @mastra/core@1.61.1-alpha.0
  - @mastra/code-sdk@1.4.1-alpha.0

## 0.9.0

### Minor Changes

- Added a `/login` command to the web chat composer. Credential errors used to name a command the web UI did not have, leaving no way to act on them from the browser. Typing `/login` now opens Settings → Models, where providers are connected. ([#21860](https://github.com/mastra-ai/mastra/pull/21860))

### Patch Changes

- Fixed the chat jumping every time a session's stream hiccuped. Losing the connection used to push a banner above the transcript and shove every message down; the reconnect state now lives only in the status line under the composer, where the model and token readouts already are. ([#21850](https://github.com/mastra-ai/mastra/pull/21850))

  The state is also honest during a run: a drop while the agent works used to stay hidden behind the working indicator, and now shows as `Reconnecting…`. A connection lost for good reads as `Disconnected` in the alert color.

- Improved slash commands with a composer-integrated menu and consistent workspace panel elevation. ([#21980](https://github.com/mastra-ai/mastra/pull/21980))

- Improved loaded Factory conversations with a smooth staggered reveal. ([#21937](https://github.com/mastra-ai/mastra/pull/21937))

- Fixed assistant turns showing up twice in the chat transcript, with the first copy stripped of the tool cards that belong to it. ([#21851](https://github.com/mastra-ai/mastra/pull/21851))

  Tool cards stay attached to the text they ran under. The double came from the same turn arriving under a second identity after a stream gap; the transcript now recognises that copy as the turn it is already drawing and updates it in place.

- Improved model selection in Factory chats. The status line now shows one combined picker with the effective model for the current mode. ([#21871](https://github.com/mastra-ai/mastra/pull/21871))

  The picker offers:

  - Model packs as presets, with your personal default marked.
  - Models grouped by provider, to override the model for the current mode.
  - A reset action that returns the chat to your default pack.
  - A link to pack management in settings.
  - Search across packs and models.

  The picker works in draft chats and in active user chats. A pack chosen in a draft applies before the first prompt runs. Live user chats can now switch models directly from the status line.

- Trimmed what the Factory sidebar fetches while it polls. ([#21862](https://github.com/mastra-ai/mastra/pull/21862))

  The activity dots used to cost one request per user session every five seconds. They now share a single request whatever the sidebar holds, so ten sessions poll once instead of eleven times.

  Work item responses also stop carrying `factoryRuleMaterializationKey`, an internal field no client reads and the heaviest one on a large board.

- Fixed Platform GitHub/Linear integrations and the Platform API client ignoring `MASTRA_PLATFORM_ACCESS_TOKEN`, the credential Mastra Platform injects into deployed projects. Integration auto-detection and the API client now accept `MASTRA_PLATFORM_ACCESS_TOKEN` (checked first) or `MASTRA_PLATFORM_SECRET_KEY`, so platform deployments work without manually copying the secret key into the environment. ([#21982](https://github.com/mastra-ai/mastra/pull/21982))

- Creating a new Factory no longer takes over the whole screen once you already have one. The flow now runs inline at `/factories/:factoryId/new-factory`, so the sidebar stays in place and you keep the context of the Factory you were in. The full-screen version is still what you get on first run, when no Factory exists yet. ([#21932](https://github.com/mastra-ai/mastra/pull/21932))

  Each step is now a searchable list you type into instead of a form: name the Factory, pick a repository, pick the Linear project that feeds its board (or skip Linear entirely), then choose the provider and model your runs start on. Picking a Linear project routes it to the new Factory and turns its issue sync on, so the board fills up without a detour through Settings. Repository search hits GitHub directly, so large accounts are usable, and keyboard navigation works throughout (arrows to move, Enter to select, Esc to leave).

  Nothing is written to the server until the last step: the name, the repository and the Linear choice stay in the draft, and the Factory is created with all of them at once when you pick its model. Quitting the wizard halfway leaves nothing behind. Back walks the steps in reverse and only leaves the wizard from the first one.

- Factory projects now have their own configurable observational-memory settings. Board runs and channel sessions hydrate from the factory project's shared settings row (falling back to built-in defaults) instead of any individual user's personal configuration, and the OM config routes accept a `factoryId` to read and update the factory-scoped row. In settings, a dedicated Memory page shows the factory-wide and personal observational-memory configuration side by side, so factory defaults and personal chat settings are edited separately. ([#21899](https://github.com/mastra-ai/mastra/pull/21899))

  To read or update the factory-scoped configuration, pass the factory project id:

  ```ts
  await fetch(`/web/config/om?factoryId=${factoryId}`);
  await fetch(`/web/config/om/observer/model`, {
    method: 'PUT',
    body: JSON.stringify({ modelId: 'anthropic/claude-haiku-4-5', factoryId }),
  });
  ```

  Requests without `factoryId` keep operating on the caller's personal settings.

- Provider OAuth sign-in can now be shared with the whole organization. Org admins get a "Just me" / "Everyone in org" toggle on the OAuth provider list; org-scoped sign-ins are stored as shared org credentials, reported with an "Org sign-in" badge, and can be removed at org scope (admin-gated). ([#21899](https://github.com/mastra-ai/mastra/pull/21899))

- Factory runs now resolve provider credentials with org > user precedence, so an org-wide "Everyone in org" key takes priority over a run's acting user's personal key. This means factory automation always bills against the org's shared credentials when they exist, regardless of who triggered the run. Interactive (non-factory) sessions keep the existing user > org precedence, so personal plan subscriptions and keys still take priority there. ([#21899](https://github.com/mastra-ai/mastra/pull/21899))

- Provider credentials can now be managed per scope after initial setup. The provider listing reports the caller's personal and org credentials independently (`userCredential`/`orgCredential` on `ProviderInfo`), so the settings UI shows separate sign-out actions for each scope and lets org admins add an org-wide OAuth sign-in while personally signed in (and vice versa) without signing out first. ([#21899](https://github.com/mastra-ai/mastra/pull/21899))

- Provider-aware observational-memory defaults for factories. The factory creation wizard now fills the factory-scoped OM row (POST /web/config/om/provider-defaults accepts factoryId), and factory session hydration derives the OM fallback model from the factory's default model provider (e.g. anthropic/claude-haiku-4-5 when the default model is anthropic) instead of always using google/gemini-3.5-flash. GET/PUT OM routes report the same derived fallback so the settings UI no longer shows "Model credentials required" for factories whose default model provider is credentialed. ([#21899](https://github.com/mastra-ai/mastra/pull/21899))

- Interactive messages and model switches on factory sessions now resolve provider credentials org-first (org > user), matching board-run kickoff. The credential resolver keys off the session's `factoryProjectId` in controller state, so any run on a factory-owned session rides the org's shared keys with the caller's personal credentials as fallback — switching to a personal-only model still works through that fallback. Repo-backed Slack channel sessions now stamp the owning factory project onto session state so they get the same behavior. ([#21899](https://github.com/mastra-ai/mastra/pull/21899))

- Fixed factory board runs and Slack channel sessions inheriting the GitHub connection owner's personal observational-memory model settings. Factory sessions now always use the project's default model and the built-in observational-memory defaults, so runs no longer fail when the connection owner has a model configured that the workspace has no API key for. Web chat sessions still use each user's own memory settings. ([#21899](https://github.com/mastra-ai/mastra/pull/21899))

  Note: sessions created before this change keep the settings they were hydrated with. Recreate existing factory sessions after deploying to pick up the corrected defaults.

- Fixed Factory steering messages so they no longer interrupt active work. Pending steering messages now show their delivery state and use the same neutral style as other user messages. ([#21983](https://github.com/mastra-ai/mastra/pull/21983))

- Fixed shared threads running with a stale model in multi-server deployments. The model selected for a mode is now re-read from the thread's persisted settings at the start of every run, so a model switch made in one browser session or server replica is picked up by all others instead of silently diverging until the next mode switch. ([#21899](https://github.com/mastra-ai/mastra/pull/21899))

- Fixed pull request cards that stayed marked as open after an approving review. A card that an approving review moved to `done` was dropped from the GitHub reconcile sweep, so a merge landing afterwards never reached it — the board card kept saying `open` and the merged marker never appeared on its review session in the sidebar. Cards now stay in the sweep until their pull request is actually closed. ([#21870](https://github.com/mastra-ai/mastra/pull/21870))

- Split thinking defaults on the Models settings page: the factory defaults section now has a base thinking level widget, and per-mode thinking defaults moved into the personal "Your defaults" section. ([#21899](https://github.com/mastra-ai/mastra/pull/21899))

- Updated dependencies [[`88d14ca`](https://github.com/mastra-ai/mastra/commit/88d14cac008582a618fecc3d5c7fd3bdf4f6ddc3), [`480e491`](https://github.com/mastra-ai/mastra/commit/480e491588bd6a7a1c9ee4407590ad625dd33952), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`acc3471`](https://github.com/mastra-ai/mastra/commit/acc3471de5f3fde8027ee4e355af292b2bc1bc30), [`b6a771e`](https://github.com/mastra-ai/mastra/commit/b6a771ef23d203ddb348efca8065eff65def8191), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`3bb88dd`](https://github.com/mastra-ai/mastra/commit/3bb88ddf07fb98f3cd16d3bff94e51cd3b45d011), [`d23e75d`](https://github.com/mastra-ai/mastra/commit/d23e75d57cc7cf5b9bfdbee896bf5a6a2484fed7), [`c8faa4e`](https://github.com/mastra-ai/mastra/commit/c8faa4e1cfebaec56b65e754e90b9fe46d153359), [`d378d75`](https://github.com/mastra-ai/mastra/commit/d378d7511f71309ed61a8f6b93cd0361dc6cb70f), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`26d4016`](https://github.com/mastra-ai/mastra/commit/26d40160ff7f7d8bf95fee2039a52cbc83863533), [`7c60df5`](https://github.com/mastra-ai/mastra/commit/7c60df5c7872343fbac5c3e5b1175c8076a5abfd), [`57c5103`](https://github.com/mastra-ai/mastra/commit/57c51035a2a36e3df3c4f32f46bb789a66ed5946), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`10de311`](https://github.com/mastra-ai/mastra/commit/10de311e93baea36468463d25bf0f97046239d5e), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`f2031a4`](https://github.com/mastra-ai/mastra/commit/f2031a47445e8f67a89ba1309036816f97ab7a65), [`4c2b973`](https://github.com/mastra-ai/mastra/commit/4c2b97396066e97c95c3d0429b2f63a92e6af127), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`cad4208`](https://github.com/mastra-ai/mastra/commit/cad42082e6aa1776168a94914f523334be45d929), [`57c5103`](https://github.com/mastra-ai/mastra/commit/57c51035a2a36e3df3c4f32f46bb789a66ed5946), [`8e529d4`](https://github.com/mastra-ai/mastra/commit/8e529d4ac754efef04b225841349e0da9edf89a6), [`57c5103`](https://github.com/mastra-ai/mastra/commit/57c51035a2a36e3df3c4f32f46bb789a66ed5946), [`038b7b4`](https://github.com/mastra-ai/mastra/commit/038b7b405cb4ac25ab3f3031334111b1f87ac112), [`4132d61`](https://github.com/mastra-ai/mastra/commit/4132d61f8367077120ee9e6420d3224dffd93c93), [`d378d75`](https://github.com/mastra-ai/mastra/commit/d378d7511f71309ed61a8f6b93cd0361dc6cb70f)]:
  - @mastra/core@1.61.0
  - @mastra/code-sdk@1.4.0

## 0.9.0-alpha.5

### Patch Changes

- Updated dependencies [[`7c60df5`](https://github.com/mastra-ai/mastra/commit/7c60df5c7872343fbac5c3e5b1175c8076a5abfd)]:
  - @mastra/core@1.61.0-alpha.5
  - @mastra/code-sdk@1.4.0-alpha.5

## 0.9.0-alpha.4

### Patch Changes

- Updated dependencies:
  - @mastra/code-sdk@1.4.0-alpha.4
  - @mastra/core@1.61.0-alpha.4

## 0.9.0-alpha.3

### Patch Changes

- Improved slash commands with a composer-integrated menu and consistent workspace panel elevation. ([#21980](https://github.com/mastra-ai/mastra/pull/21980))

- Fixed Platform GitHub/Linear integrations and the Platform API client ignoring `MASTRA_PLATFORM_ACCESS_TOKEN`, the credential Mastra Platform injects into deployed projects. Integration auto-detection and the API client now accept `MASTRA_PLATFORM_ACCESS_TOKEN` (checked first) or `MASTRA_PLATFORM_SECRET_KEY`, so platform deployments work without manually copying the secret key into the environment. ([#21982](https://github.com/mastra-ai/mastra/pull/21982))

- Factory projects now have their own configurable observational-memory settings. Board runs and channel sessions hydrate from the factory project's shared settings row (falling back to built-in defaults) instead of any individual user's personal configuration, and the OM config routes accept a `factoryId` to read and update the factory-scoped row. In settings, a dedicated Memory page shows the factory-wide and personal observational-memory configuration side by side, so factory defaults and personal chat settings are edited separately. ([#21899](https://github.com/mastra-ai/mastra/pull/21899))

  To read or update the factory-scoped configuration, pass the factory project id:

  ```ts
  await fetch(`/web/config/om?factoryId=${factoryId}`);
  await fetch(`/web/config/om/observer/model`, {
    method: 'PUT',
    body: JSON.stringify({ modelId: 'anthropic/claude-haiku-4-5', factoryId }),
  });
  ```

  Requests without `factoryId` keep operating on the caller's personal settings.

- Provider OAuth sign-in can now be shared with the whole organization. Org admins get a "Just me" / "Everyone in org" toggle on the OAuth provider list; org-scoped sign-ins are stored as shared org credentials, reported with an "Org sign-in" badge, and can be removed at org scope (admin-gated). ([#21899](https://github.com/mastra-ai/mastra/pull/21899))

- Factory runs now resolve provider credentials with org > user precedence, so an org-wide "Everyone in org" key takes priority over a run's acting user's personal key. This means factory automation always bills against the org's shared credentials when they exist, regardless of who triggered the run. Interactive (non-factory) sessions keep the existing user > org precedence, so personal plan subscriptions and keys still take priority there. ([#21899](https://github.com/mastra-ai/mastra/pull/21899))

- Provider credentials can now be managed per scope after initial setup. The provider listing reports the caller's personal and org credentials independently (`userCredential`/`orgCredential` on `ProviderInfo`), so the settings UI shows separate sign-out actions for each scope and lets org admins add an org-wide OAuth sign-in while personally signed in (and vice versa) without signing out first. ([#21899](https://github.com/mastra-ai/mastra/pull/21899))

- Provider-aware observational-memory defaults for factories. The factory creation wizard now fills the factory-scoped OM row (POST /web/config/om/provider-defaults accepts factoryId), and factory session hydration derives the OM fallback model from the factory's default model provider (e.g. anthropic/claude-haiku-4-5 when the default model is anthropic) instead of always using google/gemini-3.5-flash. GET/PUT OM routes report the same derived fallback so the settings UI no longer shows "Model credentials required" for factories whose default model provider is credentialed. ([#21899](https://github.com/mastra-ai/mastra/pull/21899))

- Interactive messages and model switches on factory sessions now resolve provider credentials org-first (org > user), matching board-run kickoff. The credential resolver keys off the session's `factoryProjectId` in controller state, so any run on a factory-owned session rides the org's shared keys with the caller's personal credentials as fallback — switching to a personal-only model still works through that fallback. Repo-backed Slack channel sessions now stamp the owning factory project onto session state so they get the same behavior. ([#21899](https://github.com/mastra-ai/mastra/pull/21899))

- Fixed factory board runs and Slack channel sessions inheriting the GitHub connection owner's personal observational-memory model settings. Factory sessions now always use the project's default model and the built-in observational-memory defaults, so runs no longer fail when the connection owner has a model configured that the workspace has no API key for. Web chat sessions still use each user's own memory settings. ([#21899](https://github.com/mastra-ai/mastra/pull/21899))

  Note: sessions created before this change keep the settings they were hydrated with. Recreate existing factory sessions after deploying to pick up the corrected defaults.

- Fixed Factory steering messages so they no longer interrupt active work. Pending steering messages now show their delivery state and use the same neutral style as other user messages. ([#21983](https://github.com/mastra-ai/mastra/pull/21983))

- Fixed shared threads running with a stale model in multi-server deployments. The model selected for a mode is now re-read from the thread's persisted settings at the start of every run, so a model switch made in one browser session or server replica is picked up by all others instead of silently diverging until the next mode switch. ([#21899](https://github.com/mastra-ai/mastra/pull/21899))

- Split thinking defaults on the Models settings page: the factory defaults section now has a base thinking level widget, and per-mode thinking defaults moved into the personal "Your defaults" section. ([#21899](https://github.com/mastra-ai/mastra/pull/21899))

- Updated dependencies [[`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`acc3471`](https://github.com/mastra-ai/mastra/commit/acc3471de5f3fde8027ee4e355af292b2bc1bc30), [`b6a771e`](https://github.com/mastra-ai/mastra/commit/b6a771ef23d203ddb348efca8065eff65def8191), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`26d4016`](https://github.com/mastra-ai/mastra/commit/26d40160ff7f7d8bf95fee2039a52cbc83863533), [`57c5103`](https://github.com/mastra-ai/mastra/commit/57c51035a2a36e3df3c4f32f46bb789a66ed5946), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`9267e9b`](https://github.com/mastra-ai/mastra/commit/9267e9b3d9c2fcf16936050495a787054c2431ab), [`57c5103`](https://github.com/mastra-ai/mastra/commit/57c51035a2a36e3df3c4f32f46bb789a66ed5946), [`57c5103`](https://github.com/mastra-ai/mastra/commit/57c51035a2a36e3df3c4f32f46bb789a66ed5946)]:
  - @mastra/core@1.61.0-alpha.3
  - @mastra/code-sdk@1.4.0-alpha.3

## 0.9.0-alpha.2

### Patch Changes

- Improved loaded Factory conversations with a smooth staggered reveal. ([#21937](https://github.com/mastra-ai/mastra/pull/21937))

- Creating a new Factory no longer takes over the whole screen once you already have one. The flow now runs inline at `/factories/:factoryId/new-factory`, so the sidebar stays in place and you keep the context of the Factory you were in. The full-screen version is still what you get on first run, when no Factory exists yet. ([#21932](https://github.com/mastra-ai/mastra/pull/21932))

  Each step is now a searchable list you type into instead of a form: name the Factory, pick a repository, pick the Linear project that feeds its board (or skip Linear entirely), then choose the provider and model your runs start on. Picking a Linear project routes it to the new Factory and turns its issue sync on, so the board fills up without a detour through Settings. Repository search hits GitHub directly, so large accounts are usable, and keyboard navigation works throughout (arrows to move, Enter to select, Esc to leave).

  Nothing is written to the server until the last step: the name, the repository and the Linear choice stay in the draft, and the Factory is created with all of them at once when you pick its model. Quitting the wizard halfway leaves nothing behind. Back walks the steps in reverse and only leaves the wizard from the first one.

- Updated dependencies [[`480e491`](https://github.com/mastra-ai/mastra/commit/480e491588bd6a7a1c9ee4407590ad625dd33952), [`3bb88dd`](https://github.com/mastra-ai/mastra/commit/3bb88ddf07fb98f3cd16d3bff94e51cd3b45d011), [`d378d75`](https://github.com/mastra-ai/mastra/commit/d378d7511f71309ed61a8f6b93cd0361dc6cb70f), [`cad4208`](https://github.com/mastra-ai/mastra/commit/cad42082e6aa1776168a94914f523334be45d929), [`d378d75`](https://github.com/mastra-ai/mastra/commit/d378d7511f71309ed61a8f6b93cd0361dc6cb70f)]:
  - @mastra/core@1.61.0-alpha.2
  - @mastra/code-sdk@1.4.0-alpha.2

## 0.9.0-alpha.1

### Minor Changes

- Added a `/login` command to the web chat composer. Credential errors used to name a command the web UI did not have, leaving no way to act on them from the browser. Typing `/login` now opens Settings → Models, where providers are connected. ([#21860](https://github.com/mastra-ai/mastra/pull/21860))

### Patch Changes

- Improved model selection in Factory chats. The status line now shows one combined picker with the effective model for the current mode. ([#21871](https://github.com/mastra-ai/mastra/pull/21871))

  The picker offers:

  - Model packs as presets, with your personal default marked.
  - Models grouped by provider, to override the model for the current mode.
  - A reset action that returns the chat to your default pack.
  - A link to pack management in settings.
  - Search across packs and models.

  The picker works in draft chats and in active user chats. A pack chosen in a draft applies before the first prompt runs. Live user chats can now switch models directly from the status line.

- Trimmed what the Factory sidebar fetches while it polls. ([#21862](https://github.com/mastra-ai/mastra/pull/21862))

  The activity dots used to cost one request per user session every five seconds. They now share a single request whatever the sidebar holds, so ten sessions poll once instead of eleven times.

  Work item responses also stop carrying `factoryRuleMaterializationKey`, an internal field no client reads and the heaviest one on a large board.

- Fixed pull request cards that stayed marked as open after an approving review. A card that an approving review moved to `done` was dropped from the GitHub reconcile sweep, so a merge landing afterwards never reached it — the board card kept saying `open` and the merged marker never appeared on its review session in the sidebar. Cards now stay in the sweep until their pull request is actually closed. ([#21870](https://github.com/mastra-ai/mastra/pull/21870))

- Updated dependencies [[`d23e75d`](https://github.com/mastra-ai/mastra/commit/d23e75d57cc7cf5b9bfdbee896bf5a6a2484fed7), [`c8faa4e`](https://github.com/mastra-ai/mastra/commit/c8faa4e1cfebaec56b65e754e90b9fe46d153359), [`10de311`](https://github.com/mastra-ai/mastra/commit/10de311e93baea36468463d25bf0f97046239d5e), [`f2031a4`](https://github.com/mastra-ai/mastra/commit/f2031a47445e8f67a89ba1309036816f97ab7a65), [`4c2b973`](https://github.com/mastra-ai/mastra/commit/4c2b97396066e97c95c3d0429b2f63a92e6af127), [`8e529d4`](https://github.com/mastra-ai/mastra/commit/8e529d4ac754efef04b225841349e0da9edf89a6)]:
  - @mastra/core@1.61.0-alpha.1
  - @mastra/code-sdk@1.4.0-alpha.1

## 0.8.1-alpha.0

### Patch Changes

- Fixed the chat jumping every time a session's stream hiccuped. Losing the connection used to push a banner above the transcript and shove every message down; the reconnect state now lives only in the status line under the composer, where the model and token readouts already are. ([#21850](https://github.com/mastra-ai/mastra/pull/21850))

  The state is also honest during a run: a drop while the agent works used to stay hidden behind the working indicator, and now shows as `Reconnecting…`. A connection lost for good reads as `Disconnected` in the alert color.

- Fixed assistant turns showing up twice in the chat transcript, with the first copy stripped of the tool cards that belong to it. ([#21851](https://github.com/mastra-ai/mastra/pull/21851))

  Tool cards stay attached to the text they ran under. The double came from the same turn arriving under a second identity after a stream gap; the transcript now recognises that copy as the turn it is already drawing and updates it in place.

- Updated dependencies [[`88d14ca`](https://github.com/mastra-ai/mastra/commit/88d14cac008582a618fecc3d5c7fd3bdf4f6ddc3), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`84a5b69`](https://github.com/mastra-ai/mastra/commit/84a5b699f84d6bae0a34efe5a970d891090b9f41), [`038b7b4`](https://github.com/mastra-ai/mastra/commit/038b7b405cb4ac25ab3f3031334111b1f87ac112), [`4132d61`](https://github.com/mastra-ai/mastra/commit/4132d61f8367077120ee9e6420d3224dffd93c93)]:
  - @mastra/core@1.60.1-alpha.0
  - @mastra/code-sdk@1.3.1-alpha.0

## 0.8.0

### Minor Changes

- Add per-repository worktree teardown commands and run them during terminal, explicit, and destructive Factory session cleanup. ([#21564](https://github.com/mastra-ai/mastra/pull/21564))

- Made Factory session workspace resolution lazy. Resolving a session now returns the workspace immediately with a lazy sandbox handle; sandbox provisioning, repository materialization, branch checkout, and setup run in the background at session start (or on the first filesystem/sandbox operation) instead of blocking agent start. Storage reads during resolution are parallelized, failed background materializations are retried on the next use, and metadata-only resolutions such as thread-list polling never trigger sandbox work. ([#21803](https://github.com/mastra-ai/mastra/pull/21803))

- Added org-visible Factory sessions: sessions store a visibility property derived from origin, org members can open org-visible sessions, and factory-ui shows session owners and access errors. ([#21460](https://github.com/mastra-ai/mastra/pull/21460))

- Added foundational support for an upcoming experimental memory capability across storage, runtime, and developer tooling. ([#19538](https://github.com/mastra-ai/mastra/pull/19538))

- Added a configurable allowlist of reviewer bots that can trigger GitHub review and comment notifications. Set MASTRACODE_GITHUB_AUTHORIZED_BOTS (comma-separated logins) or pass authorizedBots to GithubIntegration to trust bots beyond the built-in defaults; previously only coderabbitai[bot] and devin-ai-integration[bot] were accepted and every other bot was dropped without a log line. Bot logins now match case-insensitively and rejected senders are logged. Fixes #21621 ([#21697](https://github.com/mastra-ai/mastra/pull/21697))

- Sped up new Factory agent sessions with warm repo base checkpoints. When a repository is connected, Factory now builds a base sandbox checkpoint (clone plus setup command) in the background, rebuilds it when pull requests merge to the default branch or pushes land there, and keeps it fresh via the periodic reconcile sweep. New sessions boot from the base checkpoint and skip the full clone and setup, falling back to the previous cold path when no checkpoint is available. ([#21803](https://github.com/mastra-ai/mastra/pull/21803))

### Patch Changes

- Speed up the local dev watch for the design system: `pnpm dev:ui` now rebuilds `@mastra/playground-ui` on save, so design-system edits show up in the Factory UI without a manual rebuild. `pnpm dev:playground` picks up the same watch. The watch starts from a full build and then skips type declaration emit on every rebuild, which brings each save from ~9s down to ~1.5s. ([#21646](https://github.com/mastra-ai/mastra/pull/21646))

  Declarations stay frozen at that starting build for the length of a dev session — run `pnpm --filter @mastra/playground-ui build` after changing a component's props. The published build is unchanged and still emits declarations.

- Factory sessions can start before their sandbox is ready: resolving a session returns its workspace immediately, and background checkpoint-build failures now show up in logs instead of disappearing. ([#21803](https://github.com/mastra-ai/mastra/pull/21803))

- Fixed session materialization timing being overwritten when sessions resume. The initial-materialize timestamp is now recorded once and preserved across idle-reap, checkpoint restore, and sandbox recreation, so time-to-first-materialize measurements reflect the true initial cost. Historical metrics captured before this fix are not backfilled. ([#21520](https://github.com/mastra-ai/mastra/pull/21520))

- Prevent Factory handoff files from colliding across work items ([#21763](https://github.com/mastra-ai/mastra/pull/21763))

- Added Factory session state to browser tabs and the sidebar, so a running session can be followed without switching to its window. ([#21426](https://github.com/mastra-ai/mastra/pull/21426))

  - Session tab favicons are color-coded: amber while initializing, green while the agent works, blue when it is your turn, red on failure.
  - Sidebar status dots now cover workspaces and user sessions alike, with Initializing / Working / Ready tooltips in the same three colors, so a tab and its sidebar row read the same.
  - Failures show on the favicon only; the sidebar has no error dot yet.
  - Tab titles show the session's identifier — `#1567` for GitHub pull requests and issues, `COR-210` for Linear — or the thread title for user sessions.
  - Board kickoff toasts gained a **New Tab** action, so a ready session opens without leaving the board.
  - Fixed a pinned session losing its sidebar slot when five other sessions were busy at once.

- Fixed Linear issue reconciliation for issues that are not assigned to a project. ([#21601](https://github.com/mastra-ai/mastra/pull/21601))

- Fixed workspace failures vanishing from the chat transcript. A workspace that failed to clone or start only flipped an internal flag that nothing rendered, so the session simply looked stuck with no reason given. The failure now appears as an error notice in the transcript — the same message the terminal already printed — for both the `workspace_error` and the failing `workspace_status_changed` event. ([#21746](https://github.com/mastra-ai/mastra/pull/21746))

- Fixed the Factory chat transcript drawing the same content twice after coming back to a tab. While a run streams, leaving the tab drops the event stream and the transcript refetches on return: an assistant reply the server had persisted as its own step, and a steer whose live event was missed, both landed on screen a second time. The refetched window is now paired against what is already drawn — by message id, by tool call, then by the text itself — so it only inserts what is genuinely missing. ([#21651](https://github.com/mastra-ai/mastra/pull/21651))

  Also fixed a tool call rendering as two half-filled cards when a steer interrupted it: live tool state followed the newest assistant message instead of staying with the call it belongs to.

- Resume a skill run that was aborted out from under it. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

  An aborted run was recorded as a terminal failure on the assumption that an
  abort is deliberate. In practice the dominant cause is the process going away
  underneath the run — an operator restarting the server — and the run stream does
  not say which happened. Cards were dead-ending at attempt 1 with nothing on the
  board to press, needing a human to nudge each one by hand after every restart.

  Aborted runs are now retried like any other interrupted work, still bounded by
  the existing attempt cap.

- Stop Factory from waking itself on its own GitHub comments. ([#21800](https://github.com/mastra-ai/mastra/pull/21800))

  Factory recognised its own writes by comparing the event sender against
  `GITHUB_APP_SLUG`. That variable names the deployment's own self-hosted GitHub
  App, which is a different App than the one a Platform deployment posts as — and
  on such a deployment it is legitimately unset, so the check compared against
  `undefined[bot]` and never matched. Every self-loop guard silently failed open.

  The visible result: triage published its handoff comment, that comment came back
  through ingress, re-invoked triage, and cancelled the run that had written it —
  leaving the public verdict stuck at "Pending" while both runs reported success.

  The Platform integration now names the App it actually posts as, overridable
  with `MASTRA_PLATFORM_GITHUB_APP_SLUG`, and identity resolution is centralised so
  an unresolved identity is reported as _unknown_ rather than collapsing into
  "not Factory".

- Let a Factory run finish its stage when the previous role handed off in the same ([#21802](https://github.com/mastra-ai/mastra/pull/21802))
  session.

  `factory_transition_work_item` re-checked its authority at execution time by
  comparing the live run binding against the binding row that existed when the
  tool was built, requiring the same row id. But handing the next role its turn in
  an existing session legitimately rotates that row: the previous role's binding is
  revoked and a new one is issued for the same session and the same work item.
  Tools built for the earlier role stay live across that rotation, so they were
  keyed to a row that the handoff itself had just replaced.

  The visible result: planning produced a complete plan, called its terminal
  transition to `execute`, and was refused with "Factory agent binding is
  unavailable, revoked, or no longer matches this session." The item stopped in
  Planning with the plan written but never advanced, and the decision that carried
  it reported success. Every leg that continues an item in an existing session —
  planning after triage, and the review-feedback wakes — failed the same way.

  Authority is now the work item the session is bound to rather than the
  individual binding row, so a rotation no longer strands the run it exists to
  start. Re-pointing a session at a _different_ work item is still refused.

- Start the implementation run when a work item enters Building. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

  Building was the one stage on the Work board with no entry rule, so an item
  arriving there stopped: the plan was approved and nothing picked it up until
  somebody pressed Build by hand. Every other stage advances itself, which made
  Building the single manual step in an otherwise continuous path from intake to
  review.

  The run it starts carries a prompt rather than activating a skill. Skills exist
  here to define a handoff — a terminal message later rules match on to decide
  what happens next — and Building already has one: it ends by opening a pull
  request, which arrives as its own event and raises the Review card. Rules could
  previously only express "invoke this skill", so the decision vocabulary now
  accepts a prompt as the alternative to a skill name.

- Credit the reporter as a co-author on work their issue caused ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

  When Factory builds a fix for a GitHub issue, the build prompt now asks for a
  `Co-Authored-By` trailer naming the person who reported it, so the reporter shows
  up as a contributor on the pull request rather than only in the issue thread.

  Only GitHub issues qualify. A Linear card stamps a display name and a manual card
  stamps nothing, and neither resolves to the GitHub account a trailer needs, so
  those are left uncredited rather than credited to nobody. Issues Factory filed
  itself are skipped.

  Intake already stamped the reporter's login but the stage rules could not see it;
  the intake-stamped metadata now reaches rules that run on a stage.

- Stop reporting a skill kickoff as successful when it was queued onto a run that was already ending. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

  Signals sent into an active session settle as `deliver`, which acknowledges routing but promises nothing about execution. If the in-flight run finished before draining its queue, the prompt was dropped: no turn started, no error surfaced, and the decision was marked succeeded while the work item sat in its new stage with nobody working on it. The dispatcher now confirms the signal actually landed in the thread and retries the decision when it did not, so the next attempt finds the session idle and takes the instrumented wake path.

- Dismiss runs still parked on a work item when it reaches a terminal stage. A merged or closed pull request cannot answer a suggested run, so the card no longer keeps asking. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

- Check who sent a GitHub comment or review before letting it wake an agent, and ingest default-branch `push` events. ([#21800](https://github.com/mastra-ai/mastra/pull/21800))

  The sender gate listed event kinds under names the webhook classifier never produces, so the identity check that keeps untrusted commenters from waking Factory agents was skipped for every comment and review event. The gate now names the kinds the classifier actually emits. Separately, `push` events were dropped by the event filter before ingestion; they are now ingested and forwarded to Factory's event pipeline so downstream consumers (such as the upcoming warm base-checkpoint refresh) can observe default-branch pushes.

- Ingest `pull_request.opened` from the Platform event poller so a newly opened pull request mints its Review card. The poller forwards an allow-list of events to the rules engine, and `opened` was missing from it — so on deployments without a direct webhook (the only path a local deployment has), a pull request the factory authored itself was never reviewed. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

- Keep kickoff skill resolution off the sandbox so clicking Review on a board card no longer blocks on full sandbox provisioning. Project skill roots (`.claude/skills`, `.agents/skills`, `<configDir>/skills`) are guarded while the session sandbox is unmaterialized — discovery reports them empty instead of forcing materialization — and a skills rescan fires automatically once materialization completes so repo-local skills become visible. Bundled Factory skills (e.g. factory-review) resolve from local disk in milliseconds. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

- Stop the GitHub event worker from crashing when it is constructed before source-control storage is initialized. ([#21801](https://github.com/mastra-ai/mastra/pull/21801))

  `workers()` dereferenced the integration's source-control storage eagerly while building the reconcile worker, but that storage is only attached later by `versionControl.initialize`. A deployment that constructs workers first crashed with "source-control storage has not been initialized". The worker now receives a lazy handle that resolves the storage slices at call time, once the worker is actually running.

- Deliver GitHub review feedback to the factory rules on the polling path. Submitted reviews and new pull request comments were dropped before the rules engine ran, so the agent that authored a branch was never woken when a reviewer asked for changes. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

- Route pull request comments to the agent that authored the pull request, and stop provenance from branding commenters as Factory. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

  Comments on a PR arrive as `issue_comment` with `issue.pull_request` set, and the ingress explicitly dropped them. That closed the most common feedback path of all: on a Factory-authored PR, GitHub refuses a formal `--approve`/`--request-changes` verdict from the account that opened it, so the review skill falls back to `gh pr comment` — which was discarded. External review bots leaving plain comments were dropped for the same reason.

  A new `pullRequestCommentCreated` rule event now carries those comments, reading the pull request from the `issue` payload so provenance binds the comment to the authoring Work item rather than mistaking the number for an issue's. The default rule sends a high-priority `sendMessage` to the `work` role, which wakes an idle session. Factory's own comments are ignored, because `factoryAuthored` cannot distinguish the Work role from the Review role and reacting to them would let an agent wake itself in a loop.

  Separately, `factoryAuthored` was derived from PR provenance for every event, which proves the _pull request_ came from Factory, not the sender of the event. Any human or review bot commenting on a Factory-authored PR was therefore marked as Factory. Provenance-based attribution is now skipped for events whose sender is responding to the PR — comments, submitted reviews, and re-requested reviews — where only the app login identifies Factory.

- Wait for the run that swallowed a kickoff, instead of racing it. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

  A signal queued onto an already-running turn can be dropped when that turn ends
  before draining its queue. That case was detected correctly and then handed to
  the generic exponential backoff, which spends all five attempts inside about
  thirty seconds — while the run it is waiting on takes minutes. Every attempt
  landed on the same busy session and the card gave up roughly ten times too early.

  The dispatcher now waits for the in-flight run to end and redelivers into the
  freed session, which is the event that actually resolves the condition. The
  decision settles within its original lease without spending the retry budget, and
  a redelivery that is dropped again still goes back on the queue.

- Only credit reporters who are real GitHub accounts ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

  The issue poller stamps a placeholder login when GitHub returns no author, which
  would have become a `Co-Authored-By` trailer crediting an account nobody owns.
  Reporter credit now requires a login that matches GitHub's grammar.

- Re-review a pull request when a push lands while its card is still in Reviewing. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

  A push to a card already sitting in Reviewing was dropped rather than deferred:
  the rule returned nothing, and once the in-flight pass finished it transitioned
  to Done having reviewed code that was no longer current, with no record that
  newer commits had arrived. That is the exact ordering the review loop produces —
  a review asks for changes, the authoring agent pushes a fix, and the fix lands
  before the card finishes leaving Reviewing.

  Only Intake now suppresses the re-review. A push during Reviewing re-enters the
  stage, which supersedes the stale pass: the stage rule already cancels the run
  in flight and selects the right skill for the entry it sees.

  Transition decisions carry a `reenter` flag for this, since a transition to the
  stage an item already holds is otherwise inert — the common case is a board
  being corrected into a state it already has, not work that needs restarting.

- Credit the author on review follow-up pull requests ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

  When a review pass ships mechanical fixes as a follow-up pull request, those
  commits now carry a `Co-Authored-By` trailer for the human whose work they build
  on — the reviewed pull request's author, or, when that author is a bot, the
  reporter of the issue the pull request closes.

- Carry pull request review feedback back to the agent that wrote the code. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

  A `changes_requested` review is meant to wake the authoring work session, but
  when the pull request carried no provenance the event resolved to the pull
  request's own Review card. `addressReviewFeedback` deliberately refuses to act
  on the review board — a Review card reacting to its own posted review would loop
  the reviewer against itself — so the wake was dropped and the author never heard
  about the feedback.

  Review and pull request comment events now follow the linked card's
  `parentWorkItemId` back to the item that authored the pull request, so the
  existing guard becomes true for the right item instead of never. A pull request
  card with no authoring item still emits nothing.

- Close the work/review loop: a review that requests changes now wakes the agent that authored the pull request. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

  `pull_request_review` webhooks were accepted and classified urgent, but no matching rule event existed, so the delivery was dropped after classification and the authoring agent was never told. PR subscriptions did not cover this — they sync PR activity into a thread's notification inbox for the agent to read on its _next_ turn, but nothing starts that turn.

  A new `pullRequestReviewSubmitted` rule event maps `pull_request_review`/`submitted`, and the default rule sends a high-priority `sendMessage` to the `work` role, which wakes an idle session. Only `changes_requested` fires; `approved` and `commented` stay quiet, and the Review card that posted the review never reacts to its own output.

- Send Factory's own pull requests straight to Review. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

  A pull request entered Review only when its author passed a repository-collaborator
  permission check. A GitHub App bot is never a collaborator, so every pull request
  Factory opened itself scored as untrusted and parked in Intake, waiting on a human
  click — the exact opposite of the intent, since those are the pull requests whose
  provenance Factory knows best.

  Factory authorship is now its own trust signal for pull requests: the branch came
  from a Work run this Factory dispatched. Issues are deliberately unchanged, because
  auto-triaging an issue Factory opened is a self-loop with no upside.

- Stop a running local Factory session from wedging when its checkout directory disappears. A tool spawned into a removed directory fails with `spawn /bin/sh ENOENT` — an error that names the shell rather than the sandbox — so it was never recognized as a dead sandbox, and every later filesystem or command tool (including GitHub token refresh) failed the same way for the rest of the run. A missing working directory is now treated as the local equivalent of a destroyed sandbox: if the session is still live, the revival ladder rebuilds the checkout and retries the command; if the session was retired (retirement deletes the checkout on purpose), the run fails fast with a clear retirement error instead of resurrecting the retired checkout — before provisioning anything, so a retired session never consumes a sandbox or fleet budget slot, and a sandbox already mid-build when retirement lands is torn down rather than left bound to a dead session. A missing _command_ reports the same ENOENT code, so the working directory is probed to tell the two apart and healthy sandboxes are never rebuilt for an unknown command. ([#21803](https://github.com/mastra-ai/mastra/pull/21803))

- Report what actually happened to a Factory run. A human dragging a card on the board now arms the item, so the run it asks for starts instead of parking for approval, and a run that dies mid-flight — a provider error, or a cancellation by the next decision — is recorded as failed on the decision instead of reported as a success. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

- Factory sessions now revive a sandbox that dies mid-session instead of erroring the turn. When a command fails with a destroyed-sandbox error (for example after idle garbage collection), or with an exec-transport error whose connection never opened (so the command provably never started), the session drops the dead handle, re-runs the provisioning pipeline (reattach, checkpoint-seeded provision, or fresh clone), and retries the command once. Transport errors where the command may have already run are surfaced instead of replayed, so side effects like `git commit` cannot execute twice. Concurrent failures coalesce onto a single revival. ([#21803](https://github.com/mastra-ai/mastra/pull/21803))

- Retire a parked proposal when the run it asked for starts anyway. Approving a ([#21802](https://github.com/mastra-ai/mastra/pull/21802))
  proposal mints a fresh decision rather than dispatching the parked one, so the
  original stayed `proposed` forever and the card kept asking to start a run that
  had already finished. The dispatcher now dismisses proposals for the same work
  item and role as any `invokeSkill` it dispatches, so the waiting badge only ever
  marks a loop that is genuinely stopped.

- Make the board honest about runs it is waiting on, and about clicks that fail. ([#21766](https://github.com/mastra-ai/mastra/pull/21766))

  Four gaps closed on the work board:

  - A card click that failed while refreshing workspaces before starting a run did
    nothing at all — no run, no error. It now surfaces the failure instead of
    swallowing it, so an expired session reads as an expired session.
  - A run a rule proposed could not be approved from the card. The card menu now
    offers it.
  - After a plan was approved, the Building run became unreachable from the card,
    leaving the item stranded mid-loop.
  - A card with a proposed run looked idle. It now says it is waiting on someone,
    with the approval inline.

- Stop showing "Linked card could not be filed" when nothing failed. ([#21766](https://github.com/mastra-ai/mastra/pull/21766))

  A linked-card decision that already succeeded is deliberately reset to `retry`
  when its card is rematerialized, so the card gets re-filed. The board read any
  `retry` as "already failed at least once" and put an error on the card, so a
  routine replay looked like a broken automation — 16 cards were showing a failure
  nobody caused.

  A card now reports an error only when the effect has actually been attempted or
  left an error behind. A replay reads as what it is: the work it is doing.

- Fixed Factory completion so moving a GitHub issue to Done marks it as pending close and removes its remaining triage status labels. ([#21515](https://github.com/mastra-ai/mastra/pull/21515))

- Deliver GitHub pull request signals to the session that actually owns the subscribed thread, and skip subscriptions whose thread this deployment does not hold. ([#21800](https://github.com/mastra-ai/mastra/pull/21800))

  A subscription records the Factory project as its resource, but an unscoped session registers under its own id, so delivery looked for the thread under a resource that did not own it and failed with "Thread not found" on every matching event. Delivery now reads the thread from storage to find its owning resource. A subscription naming a thread that is absent is skipped rather than failed, so a pull request's events reaching a deployment that never owned the thread no longer fabricate a session or retry in a loop.

- Fixed observational memory in Factory web user sessions ignoring the stored memory settings. Sessions created from the web UI now start with the observer and reflector models, thresholds, and attachment preferences saved in your memory settings, instead of falling back to the built-in default model — which failed with a missing API key error when that provider was not configured. ([#21423](https://github.com/mastra-ai/mastra/pull/21423))

- Fixed restarting a review after deleting its thread. It no longer fails with "git clone failed: a branch named ... already exists". Reused Platform sandboxes now delete the previous session's local branches when they are recycled. A new session for the same branch starts fresh from the base branch. Branch checkout also recovers from leftover or broken branch refs instead of failing the workspace. ([#21268](https://github.com/mastra-ai/mastra/pull/21268))

- The Review board now has a Canceled column. A pull request closed without merging used to reappear in Intake — the queue of pull requests still waiting for review — carrying a "Canceled" chip to explain why it looked out of place. It now sits in its own column. ([#21323](https://github.com/mastra-ai/mastra/pull/21323))

- Fixed the Factory session favicons being nearly invisible in light-themed browsers: the Mastra mark now switches to black on light and white on dark, matching the default favicon, and the state dots use the design system's light-theme accents so amber, green, blue, and red stay legible on a white tab strip. ([#21510](https://github.com/mastra-ai/mastra/pull/21510))

- Improved Factory stage handling so run routes and board columns stay aligned with the rule stage vocabulary. ([#21516](https://github.com/mastra-ai/mastra/pull/21516))

- Smoothed out the chat transcript. A streamed reply now reveals at a steady pace instead of arriving in clumps, and a tool card that turns up while the agent is working fades in rather than popping onto the page. Both stop for readers who ask for reduced motion. ([#21499](https://github.com/mastra-ai/mastra/pull/21499))

- Improved chat scrolling in the factory. Sending a message now scrolls once and parks it near the top with room under it, and the view stays on the agent's newest output — tool progress, subagents, the streamed reply — instead of standing still or jumping back up to what you just sent. ([#21523](https://github.com/mastra-ai/mastra/pull/21523))

  Scroll up to read back and the chat stops following. Return to the bottom and it picks the stream up again. The jump-to-latest button no longer flickers when you send a message.

  The room under the live turn is released when the run ends, so a finished conversation settles against the composer instead of leaving most of the window blank.

- Board cards now show one status line instead of stacking several. A card reports what you just triggered, then what a rule is doing on its own, then what a click will do — one thing at a time, in that order. ([#21323](https://github.com/mastra-ai/mastra/pull/21323))

  Automatic actions say what they do rather than where they sit in a queue. A card reads "Starting an automated run…" while a rule works, and "Automated run could not start" when it gives up, with the raw error one hover away next to Retry. An action the server is still re-attempting says "— retrying…", so a card looping through retries no longer looks like one starting for the first time.

  Unfiled GitHub and Linear items now use the same card as filed work. Clicking anywhere on the card starts its default run and reports "Starting run…" while that resolves, instead of looking inert. A link to the issue or pull request sits beside the title, and the remaining actions are in the card's actions menu.

  A resting card also shows less. The click hint and the actions menu fade in when you point at the card or reach it with the keyboard, the hint shares the author's line instead of taking a row of its own, and labels are shorter. Touch screens have no hover, so they keep both visible.

- The turn-end filesystem capture no longer blocks agent turn completion. Readers of the persisted workspace file listing wait up to 10 seconds for the in-flight capture to observe the just-ended turn's files; if a capture takes longer, a reader can temporarily receive the previous listing. ([#21679](https://github.com/mastra-ai/mastra/pull/21679))

- Platform GitHub event polling is now scoped to the repositories linked to a Factory project. Previously the worker polled every repository the underlying GitHub App installation exposed, which for customers who grant broad org access meant hundreds of unnecessary requests per polling cycle. With this change, no polling happens for repositories that are not linked to a project, and repositories added or removed from a project are picked up automatically on the next polling cycle — no worker restart or additional configuration required. ([#21772](https://github.com/mastra-ai/mastra/pull/21772))

- Fixed how the Factory chat transcript reads agent controller events. It branched on an `om_activation.enabled` flag the controller never sends, and cast token usage and memory progress into hand-written shapes that had drifted from the streamed payloads. Both now read the shapes the controller actually emits, so the status line and memory rings stay correct as those payloads evolve. ([#21739](https://github.com/mastra-ai/mastra/pull/21739))

- Fixed model packs so each user can set a default for new interactive Factory chats while preserving thread-specific pack and model choices, refreshing edited packs, and leaving Factory work runs unaffected. ([#21762](https://github.com/mastra-ai/mastra/pull/21762))

- Fixed Linear intake so issues only land in the Factory project their Linear project is routed to. Previously, opening any board pulled in every selected Linear project's open issues and auto-triaged them there, repeating for each Factory project you viewed. ([#21698](https://github.com/mastra-ai/mastra/pull/21698))

  **Routing Linear projects**

  In Settings › Intake, each selected Linear project now picks the Factory it feeds. A project left unrouted no longer feeds any board, and boards only show the Linear intake feed for projects routed to them. Organizations with a single Factory keep working with no configuration.

  **Deleted cards stay deleted**

  Removing an intake card now also clears the stored routing decision behind it, so it no longer reappears on the next intake poll.

  Fixes #21614

- Updated dependencies [[`587f6ef`](https://github.com/mastra-ai/mastra/commit/587f6efcfc25880b93760a8607d1cd381ec612fe), [`7e096f0`](https://github.com/mastra-ai/mastra/commit/7e096f02f0dddbf09b85d306458351245ed2f886), [`d7e6745`](https://github.com/mastra-ai/mastra/commit/d7e67456954863c55440ea9c49bc6ceb9949972d), [`6223446`](https://github.com/mastra-ai/mastra/commit/6223446ddce6166e96e0ba5e00d628b615dee8ca), [`15101bb`](https://github.com/mastra-ai/mastra/commit/15101bb53c0d934f31af6b8813b88191e382a5e5), [`4e7a421`](https://github.com/mastra-ai/mastra/commit/4e7a421dce8a48742f785d1e93ad2f43a572b282), [`c2c3deb`](https://github.com/mastra-ai/mastra/commit/c2c3debcf670c7082d0a5e553aa99818a864698c), [`d8308a2`](https://github.com/mastra-ai/mastra/commit/d8308a2be3c07e777393d1017a381dcae3890d30), [`b0a2a07`](https://github.com/mastra-ai/mastra/commit/b0a2a07800d42bd9823292e7db832374ed084c9c), [`74e5bd3`](https://github.com/mastra-ai/mastra/commit/74e5bd315b8b3a1e04cb6cf480bb0f5fc4951dc8), [`242e324`](https://github.com/mastra-ai/mastra/commit/242e3241e73cbd5c9bb86a31ebb49ca0256488d4), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`d774e89`](https://github.com/mastra-ai/mastra/commit/d774e8930c781df8c9effe3763e6b501c099b6cc), [`9c27a53`](https://github.com/mastra-ai/mastra/commit/9c27a53cd9d3de4f3f025bc387d94ce371c33f95), [`3a634e9`](https://github.com/mastra-ai/mastra/commit/3a634e9b32e3c47db3f287292ce37e862a02e005), [`8f0a332`](https://github.com/mastra-ai/mastra/commit/8f0a3321bf180368d76fe7b36aa1a8f60f00b6de), [`0b4f108`](https://github.com/mastra-ai/mastra/commit/0b4f1089aa8d92e67c2a8e99726822c5ee410784), [`8a4a4af`](https://github.com/mastra-ai/mastra/commit/8a4a4af31358fa3af79b962f87cf9a89f2c07aa9), [`9acb50f`](https://github.com/mastra-ai/mastra/commit/9acb50f71cec9c362f06820033f90ae6b1f8282f), [`46e9e3f`](https://github.com/mastra-ai/mastra/commit/46e9e3f73babe1bc70080a596cf2ac0b9da48519), [`3f9a190`](https://github.com/mastra-ai/mastra/commit/3f9a19057c027155867b9317294ee4ca7bd0581a), [`dff25a1`](https://github.com/mastra-ai/mastra/commit/dff25a1103fa72ee082a9b6f805ebeb5ce400753), [`6db7a5d`](https://github.com/mastra-ai/mastra/commit/6db7a5dd3dd2b6f7ef75dcd804fcffef5fa83963), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`583e235`](https://github.com/mastra-ai/mastra/commit/583e23519c13af16c1746f9c49722d011216611b), [`b098de9`](https://github.com/mastra-ai/mastra/commit/b098de9d7cb9f672e0883a5c716465a3a689693d), [`e8808e3`](https://github.com/mastra-ai/mastra/commit/e8808e3d8eb585a2565be53e56a7e0e1477352a4), [`a77f8d4`](https://github.com/mastra-ai/mastra/commit/a77f8d4740d2178a74c41e4bf678b4fcd8fa0bb2), [`7f78585`](https://github.com/mastra-ai/mastra/commit/7f785857e401570e2ffb316911f126ed363aa537), [`33374ba`](https://github.com/mastra-ai/mastra/commit/33374ba359e4fb13eaa918ae925fe167a3c55414), [`940bf5c`](https://github.com/mastra-ai/mastra/commit/940bf5ccf04f2c9ebd8a1390431733222a03b1cd), [`566e080`](https://github.com/mastra-ai/mastra/commit/566e080ac4296ef2ba84a99c496a1c19706fa2df), [`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`58c43d3`](https://github.com/mastra-ai/mastra/commit/58c43d3f7cb2eeaeb8ac733ae71dde822348e588), [`ef6e295`](https://github.com/mastra-ai/mastra/commit/ef6e295b59bc25a5b61b633a89c97bcfce9fb465), [`208e1b3`](https://github.com/mastra-ai/mastra/commit/208e1b39f30f4b386e494394e9d71d96f0f90241), [`c938d34`](https://github.com/mastra-ai/mastra/commit/c938d34739936c8ecbabd67ad6a4a4396f41c4c6), [`88ddc7c`](https://github.com/mastra-ai/mastra/commit/88ddc7ce01d40175f13a3228b789a906779680bd), [`f2a4afd`](https://github.com/mastra-ai/mastra/commit/f2a4afd7e37e809669001ed17724b341a5c1f45e), [`d438148`](https://github.com/mastra-ai/mastra/commit/d438148e222c1e2fb3c652725ce75680962ebec4), [`ba05fe0`](https://github.com/mastra-ai/mastra/commit/ba05fe0738f70cb686777546e968237d09269142), [`40d358e`](https://github.com/mastra-ai/mastra/commit/40d358e29d55543803e64b49241122f598ffabc7), [`d26a8d4`](https://github.com/mastra-ai/mastra/commit/d26a8d4281f28414715b333c85bedaf70d0b2890), [`e80cd7e`](https://github.com/mastra-ai/mastra/commit/e80cd7e7683e7d732e1cc6784bcac1d2640d2ce3), [`ccbbcd9`](https://github.com/mastra-ai/mastra/commit/ccbbcd974eedff4367a54ed0e24c9ee742ab2f61), [`1d9a0ea`](https://github.com/mastra-ai/mastra/commit/1d9a0ea4a9901baee6cd56737243bd6d1f631ac0), [`677cdc6`](https://github.com/mastra-ai/mastra/commit/677cdc6af564dec29a13464d12b7ab2a4efc22e9), [`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`a7dd322`](https://github.com/mastra-ai/mastra/commit/a7dd32247d95afc539f483ca37f4594af0387f59), [`3f5c6f7`](https://github.com/mastra-ai/mastra/commit/3f5c6f728ea35da344248de9aa070f12849f3aa0), [`a318490`](https://github.com/mastra-ai/mastra/commit/a318490e17da32f338d50929c770d901a9b3dd72), [`b860493`](https://github.com/mastra-ai/mastra/commit/b86049391100e665d579f700c8a2034c036defc3), [`d4be8c1`](https://github.com/mastra-ai/mastra/commit/d4be8c1739d22d621e3f78790e1dd5eb5ecc3589), [`a5d2eb1`](https://github.com/mastra-ai/mastra/commit/a5d2eb10347eade1ae2816d88f466c25186c54a5), [`3667679`](https://github.com/mastra-ai/mastra/commit/3667679db057edfb086846d13369fdda4902ad65), [`49696e8`](https://github.com/mastra-ai/mastra/commit/49696e8e42f870674a0a58f5abcd22cc54dd2864), [`2ef2f23`](https://github.com/mastra-ai/mastra/commit/2ef2f230a7aed342e7dc3b2000cd42e4c43e08a7), [`763e0c6`](https://github.com/mastra-ai/mastra/commit/763e0c61e04d76ad9a9efd301aa57525ca0cbea9), [`298aafd`](https://github.com/mastra-ai/mastra/commit/298aafd70d7fea6517b6e2a4b55f3ef9e824d96b), [`20504b2`](https://github.com/mastra-ai/mastra/commit/20504b2ecebd0e077acda3d457ab57480a98ed3e), [`77e6b1b`](https://github.com/mastra-ai/mastra/commit/77e6b1bc4c46ce94fe501023fb4393c812ec6be3), [`c5f964d`](https://github.com/mastra-ai/mastra/commit/c5f964d3f77064e978f8066ec506eed77ba5c63c), [`23e0be2`](https://github.com/mastra-ai/mastra/commit/23e0be261381e49534b4ff3101c60ee64a946cbf), [`7fc8806`](https://github.com/mastra-ai/mastra/commit/7fc880627d3cbf995d31ea0e8b807bf15417e651), [`0e02eac`](https://github.com/mastra-ai/mastra/commit/0e02eacdb2e30e1697a41910b41163742a181dc1), [`4df174c`](https://github.com/mastra-ai/mastra/commit/4df174c32bddf093a82f273070b8380aef7c9e90), [`f7c25b5`](https://github.com/mastra-ai/mastra/commit/f7c25b5106ddfb48e591f98df7a51e0f2dd01dba), [`7aad631`](https://github.com/mastra-ai/mastra/commit/7aad631b43bc10db77d5b8c66b200d7a49d18bf2), [`512100a`](https://github.com/mastra-ai/mastra/commit/512100a7d8b7e9c920f2590c6b3612f5de0d3cff), [`e81744c`](https://github.com/mastra-ai/mastra/commit/e81744cd13c46619c142dc521dc0baac47607a84), [`f8f653f`](https://github.com/mastra-ai/mastra/commit/f8f653f10980d01a73706cc3c8689ca5e40ce808), [`dc09cc1`](https://github.com/mastra-ai/mastra/commit/dc09cc1083d861cde192c1cd235324dc75b8c731), [`9ef432b`](https://github.com/mastra-ai/mastra/commit/9ef432b6faa534b57b0d182a610e13dd9a7123ff), [`36b4649`](https://github.com/mastra-ai/mastra/commit/36b4649045a3a380cbab8ceca866db4086223aff), [`b9cf308`](https://github.com/mastra-ai/mastra/commit/b9cf30846f97f99ac1906ee8a68f4f2d117b0378), [`2e1d098`](https://github.com/mastra-ai/mastra/commit/2e1d0984e325fd319d32ea182f596b3170be3847), [`377eb81`](https://github.com/mastra-ai/mastra/commit/377eb81ce43b964e3a6b541df172da74a8ff3716), [`1794a79`](https://github.com/mastra-ai/mastra/commit/1794a79178c418004a7261b1ad9114066f7ef01d), [`0cdc5dc`](https://github.com/mastra-ai/mastra/commit/0cdc5dc69024957815da4f51acc4119eb4f447d7), [`5740ec6`](https://github.com/mastra-ai/mastra/commit/5740ec60c760ffdfbfaa59d603d03b847c864e05)]:
  - @mastra/core@1.60.0
  - @mastra/code-sdk@1.3.0
  - @mastra/auth-studio@1.3.4

## 0.8.0-alpha.16

### Minor Changes

- Made Factory session workspace resolution lazy. Resolving a session now returns the workspace immediately with a lazy sandbox handle; sandbox provisioning, repository materialization, branch checkout, and setup run in the background at session start (or on the first filesystem/sandbox operation) instead of blocking agent start. Storage reads during resolution are parallelized, failed background materializations are retried on the next use, and metadata-only resolutions such as thread-list polling never trigger sandbox work. ([#21803](https://github.com/mastra-ai/mastra/pull/21803))

- Sped up new Factory agent sessions with warm repo base checkpoints. When a repository is connected, Factory now builds a base sandbox checkpoint (clone plus setup command) in the background, rebuilds it when pull requests merge to the default branch or pushes land there, and keeps it fresh via the periodic reconcile sweep. New sessions boot from the base checkpoint and skip the full clone and setup, falling back to the previous cold path when no checkpoint is available. ([#21803](https://github.com/mastra-ai/mastra/pull/21803))

### Patch Changes

- Factory sessions can start before their sandbox is ready: resolving a session returns its workspace immediately, and background checkpoint-build failures now show up in logs instead of disappearing. ([#21803](https://github.com/mastra-ai/mastra/pull/21803))

- Stop a running local Factory session from wedging when its checkout directory disappears. A tool spawned into a removed directory fails with `spawn /bin/sh ENOENT` — an error that names the shell rather than the sandbox — so it was never recognized as a dead sandbox, and every later filesystem or command tool (including GitHub token refresh) failed the same way for the rest of the run. A missing working directory is now treated as the local equivalent of a destroyed sandbox: if the session is still live, the revival ladder rebuilds the checkout and retries the command; if the session was retired (retirement deletes the checkout on purpose), the run fails fast with a clear retirement error instead of resurrecting the retired checkout — before provisioning anything, so a retired session never consumes a sandbox or fleet budget slot, and a sandbox already mid-build when retirement lands is torn down rather than left bound to a dead session. A missing _command_ reports the same ENOENT code, so the working directory is probed to tell the two apart and healthy sandboxes are never rebuilt for an unknown command. ([#21803](https://github.com/mastra-ai/mastra/pull/21803))

- Factory sessions now revive a sandbox that dies mid-session instead of erroring the turn. When a command fails with a destroyed-sandbox error (for example after idle garbage collection), or with an exec-transport error whose connection never opened (so the command provably never started), the session drops the dead handle, re-runs the provisioning pipeline (reattach, checkpoint-seeded provision, or fresh clone), and retries the command once. Transport errors where the command may have already run are surfaced instead of replayed, so side effects like `git commit` cannot execute twice. Concurrent failures coalesce onto a single revival. ([#21803](https://github.com/mastra-ai/mastra/pull/21803))

- Updated dependencies [[`58c43d3`](https://github.com/mastra-ai/mastra/commit/58c43d3f7cb2eeaeb8ac733ae71dde822348e588)]:
  - @mastra/core@1.60.0-alpha.14
  - @mastra/code-sdk@1.3.0-alpha.14

## 0.8.0-alpha.15

### Patch Changes

- Fixed model packs so each user can set a default for new interactive Factory chats while preserving thread-specific pack and model choices, refreshing edited packs, and leaving Factory work runs unaffected. ([#21762](https://github.com/mastra-ai/mastra/pull/21762))

## 0.8.0-alpha.14

### Minor Changes

- Added foundational support for an upcoming experimental memory capability across storage, runtime, and developer tooling. ([#19538](https://github.com/mastra-ai/mastra/pull/19538))

### Patch Changes

- Resume a skill run that was aborted out from under it. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

  An aborted run was recorded as a terminal failure on the assumption that an
  abort is deliberate. In practice the dominant cause is the process going away
  underneath the run — an operator restarting the server — and the run stream does
  not say which happened. Cards were dead-ending at attempt 1 with nothing on the
  board to press, needing a human to nudge each one by hand after every restart.

  Aborted runs are now retried like any other interrupted work, still bounded by
  the existing attempt cap.

- Stop Factory from waking itself on its own GitHub comments. ([#21800](https://github.com/mastra-ai/mastra/pull/21800))

  Factory recognised its own writes by comparing the event sender against
  `GITHUB_APP_SLUG`. That variable names the deployment's own self-hosted GitHub
  App, which is a different App than the one a Platform deployment posts as — and
  on such a deployment it is legitimately unset, so the check compared against
  `undefined[bot]` and never matched. Every self-loop guard silently failed open.

  The visible result: triage published its handoff comment, that comment came back
  through ingress, re-invoked triage, and cancelled the run that had written it —
  leaving the public verdict stuck at "Pending" while both runs reported success.

  The Platform integration now names the App it actually posts as, overridable
  with `MASTRA_PLATFORM_GITHUB_APP_SLUG`, and identity resolution is centralised so
  an unresolved identity is reported as _unknown_ rather than collapsing into
  "not Factory".

- Let a Factory run finish its stage when the previous role handed off in the same ([#21802](https://github.com/mastra-ai/mastra/pull/21802))
  session.

  `factory_transition_work_item` re-checked its authority at execution time by
  comparing the live run binding against the binding row that existed when the
  tool was built, requiring the same row id. But handing the next role its turn in
  an existing session legitimately rotates that row: the previous role's binding is
  revoked and a new one is issued for the same session and the same work item.
  Tools built for the earlier role stay live across that rotation, so they were
  keyed to a row that the handoff itself had just replaced.

  The visible result: planning produced a complete plan, called its terminal
  transition to `execute`, and was refused with "Factory agent binding is
  unavailable, revoked, or no longer matches this session." The item stopped in
  Planning with the plan written but never advanced, and the decision that carried
  it reported success. Every leg that continues an item in an existing session —
  planning after triage, and the review-feedback wakes — failed the same way.

  Authority is now the work item the session is bound to rather than the
  individual binding row, so a rotation no longer strands the run it exists to
  start. Re-pointing a session at a _different_ work item is still refused.

- Start the implementation run when a work item enters Building. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

  Building was the one stage on the Work board with no entry rule, so an item
  arriving there stopped: the plan was approved and nothing picked it up until
  somebody pressed Build by hand. Every other stage advances itself, which made
  Building the single manual step in an otherwise continuous path from intake to
  review.

  The run it starts carries a prompt rather than activating a skill. Skills exist
  here to define a handoff — a terminal message later rules match on to decide
  what happens next — and Building already has one: it ends by opening a pull
  request, which arrives as its own event and raises the Review card. Rules could
  previously only express "invoke this skill", so the decision vocabulary now
  accepts a prompt as the alternative to a skill name.

- Credit the reporter as a co-author on work their issue caused ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

  When Factory builds a fix for a GitHub issue, the build prompt now asks for a
  `Co-Authored-By` trailer naming the person who reported it, so the reporter shows
  up as a contributor on the pull request rather than only in the issue thread.

  Only GitHub issues qualify. A Linear card stamps a display name and a manual card
  stamps nothing, and neither resolves to the GitHub account a trailer needs, so
  those are left uncredited rather than credited to nobody. Issues Factory filed
  itself are skipped.

  Intake already stamped the reporter's login but the stage rules could not see it;
  the intake-stamped metadata now reaches rules that run on a stage.

- Stop reporting a skill kickoff as successful when it was queued onto a run that was already ending. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

  Signals sent into an active session settle as `deliver`, which acknowledges routing but promises nothing about execution. If the in-flight run finished before draining its queue, the prompt was dropped: no turn started, no error surfaced, and the decision was marked succeeded while the work item sat in its new stage with nobody working on it. The dispatcher now confirms the signal actually landed in the thread and retries the decision when it did not, so the next attempt finds the session idle and takes the instrumented wake path.

- Dismiss runs still parked on a work item when it reaches a terminal stage. A merged or closed pull request cannot answer a suggested run, so the card no longer keeps asking. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

- Check who sent a GitHub comment or review before letting it wake an agent, and ingest default-branch `push` events. ([#21800](https://github.com/mastra-ai/mastra/pull/21800))

  The sender gate listed event kinds under names the webhook classifier never produces, so the identity check that keeps untrusted commenters from waking Factory agents was skipped for every comment and review event. The gate now names the kinds the classifier actually emits. Separately, `push` events were dropped by the event filter before ingestion; they are now ingested and forwarded to Factory's event pipeline so downstream consumers (such as the upcoming warm base-checkpoint refresh) can observe default-branch pushes.

- Ingest `pull_request.opened` from the Platform event poller so a newly opened pull request mints its Review card. The poller forwards an allow-list of events to the rules engine, and `opened` was missing from it — so on deployments without a direct webhook (the only path a local deployment has), a pull request the factory authored itself was never reviewed. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

- Keep kickoff skill resolution off the sandbox so clicking Review on a board card no longer blocks on full sandbox provisioning. Project skill roots (`.claude/skills`, `.agents/skills`, `<configDir>/skills`) are guarded while the session sandbox is unmaterialized — discovery reports them empty instead of forcing materialization — and a skills rescan fires automatically once materialization completes so repo-local skills become visible. Bundled Factory skills (e.g. factory-review) resolve from local disk in milliseconds. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

- Stop the GitHub event worker from crashing when it is constructed before source-control storage is initialized. ([#21801](https://github.com/mastra-ai/mastra/pull/21801))

  `workers()` dereferenced the integration's source-control storage eagerly while building the reconcile worker, but that storage is only attached later by `versionControl.initialize`. A deployment that constructs workers first crashed with "source-control storage has not been initialized". The worker now receives a lazy handle that resolves the storage slices at call time, once the worker is actually running.

- Deliver GitHub review feedback to the factory rules on the polling path. Submitted reviews and new pull request comments were dropped before the rules engine ran, so the agent that authored a branch was never woken when a reviewer asked for changes. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

- Route pull request comments to the agent that authored the pull request, and stop provenance from branding commenters as Factory. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

  Comments on a PR arrive as `issue_comment` with `issue.pull_request` set, and the ingress explicitly dropped them. That closed the most common feedback path of all: on a Factory-authored PR, GitHub refuses a formal `--approve`/`--request-changes` verdict from the account that opened it, so the review skill falls back to `gh pr comment` — which was discarded. External review bots leaving plain comments were dropped for the same reason.

  A new `pullRequestCommentCreated` rule event now carries those comments, reading the pull request from the `issue` payload so provenance binds the comment to the authoring Work item rather than mistaking the number for an issue's. The default rule sends a high-priority `sendMessage` to the `work` role, which wakes an idle session. Factory's own comments are ignored, because `factoryAuthored` cannot distinguish the Work role from the Review role and reacting to them would let an agent wake itself in a loop.

  Separately, `factoryAuthored` was derived from PR provenance for every event, which proves the _pull request_ came from Factory, not the sender of the event. Any human or review bot commenting on a Factory-authored PR was therefore marked as Factory. Provenance-based attribution is now skipped for events whose sender is responding to the PR — comments, submitted reviews, and re-requested reviews — where only the app login identifies Factory.

- Wait for the run that swallowed a kickoff, instead of racing it. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

  A signal queued onto an already-running turn can be dropped when that turn ends
  before draining its queue. That case was detected correctly and then handed to
  the generic exponential backoff, which spends all five attempts inside about
  thirty seconds — while the run it is waiting on takes minutes. Every attempt
  landed on the same busy session and the card gave up roughly ten times too early.

  The dispatcher now waits for the in-flight run to end and redelivers into the
  freed session, which is the event that actually resolves the condition. The
  decision settles within its original lease without spending the retry budget, and
  a redelivery that is dropped again still goes back on the queue.

- Only credit reporters who are real GitHub accounts ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

  The issue poller stamps a placeholder login when GitHub returns no author, which
  would have become a `Co-Authored-By` trailer crediting an account nobody owns.
  Reporter credit now requires a login that matches GitHub's grammar.

- Re-review a pull request when a push lands while its card is still in Reviewing. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

  A push to a card already sitting in Reviewing was dropped rather than deferred:
  the rule returned nothing, and once the in-flight pass finished it transitioned
  to Done having reviewed code that was no longer current, with no record that
  newer commits had arrived. That is the exact ordering the review loop produces —
  a review asks for changes, the authoring agent pushes a fix, and the fix lands
  before the card finishes leaving Reviewing.

  Only Intake now suppresses the re-review. A push during Reviewing re-enters the
  stage, which supersedes the stale pass: the stage rule already cancels the run
  in flight and selects the right skill for the entry it sees.

  Transition decisions carry a `reenter` flag for this, since a transition to the
  stage an item already holds is otherwise inert — the common case is a board
  being corrected into a state it already has, not work that needs restarting.

- Credit the author on review follow-up pull requests ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

  When a review pass ships mechanical fixes as a follow-up pull request, those
  commits now carry a `Co-Authored-By` trailer for the human whose work they build
  on — the reviewed pull request's author, or, when that author is a bot, the
  reporter of the issue the pull request closes.

- Carry pull request review feedback back to the agent that wrote the code. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

  A `changes_requested` review is meant to wake the authoring work session, but
  when the pull request carried no provenance the event resolved to the pull
  request's own Review card. `addressReviewFeedback` deliberately refuses to act
  on the review board — a Review card reacting to its own posted review would loop
  the reviewer against itself — so the wake was dropped and the author never heard
  about the feedback.

  Review and pull request comment events now follow the linked card's
  `parentWorkItemId` back to the item that authored the pull request, so the
  existing guard becomes true for the right item instead of never. A pull request
  card with no authoring item still emits nothing.

- Close the work/review loop: a review that requests changes now wakes the agent that authored the pull request. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

  `pull_request_review` webhooks were accepted and classified urgent, but no matching rule event existed, so the delivery was dropped after classification and the authoring agent was never told. PR subscriptions did not cover this — they sync PR activity into a thread's notification inbox for the agent to read on its _next_ turn, but nothing starts that turn.

  A new `pullRequestReviewSubmitted` rule event maps `pull_request_review`/`submitted`, and the default rule sends a high-priority `sendMessage` to the `work` role, which wakes an idle session. Only `changes_requested` fires; `approved` and `commented` stay quiet, and the Review card that posted the review never reacts to its own output.

- Send Factory's own pull requests straight to Review. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

  A pull request entered Review only when its author passed a repository-collaborator
  permission check. A GitHub App bot is never a collaborator, so every pull request
  Factory opened itself scored as untrusted and parked in Intake, waiting on a human
  click — the exact opposite of the intent, since those are the pull requests whose
  provenance Factory knows best.

  Factory authorship is now its own trust signal for pull requests: the branch came
  from a Work run this Factory dispatched. Issues are deliberately unchanged, because
  auto-triaging an issue Factory opened is a self-loop with no upside.

- Report what actually happened to a Factory run. A human dragging a card on the board now arms the item, so the run it asks for starts instead of parking for approval, and a run that dies mid-flight — a provider error, or a cancellation by the next decision — is recorded as failed on the decision instead of reported as a success. ([#21802](https://github.com/mastra-ai/mastra/pull/21802))

- Retire a parked proposal when the run it asked for starts anyway. Approving a ([#21802](https://github.com/mastra-ai/mastra/pull/21802))
  proposal mints a fresh decision rather than dispatching the parked one, so the
  original stayed `proposed` forever and the card kept asking to start a run that
  had already finished. The dispatcher now dismisses proposals for the same work
  item and role as any `invokeSkill` it dispatches, so the waiting badge only ever
  marks a loop that is genuinely stopped.

- Deliver GitHub pull request signals to the session that actually owns the subscribed thread, and skip subscriptions whose thread this deployment does not hold. ([#21800](https://github.com/mastra-ai/mastra/pull/21800))

  A subscription records the Factory project as its resource, but an unscoped session registers under its own id, so delivery looked for the thread under a resource that did not own it and failed with "Thread not found" on every matching event. Delivery now reads the thread from storage to find its owning resource. A subscription naming a thread that is absent is skipped rather than failed, so a pull request's events reaching a deployment that never owned the thread no longer fabricate a session or retry in a loop.

- Fixed restarting a review after deleting its thread. It no longer fails with "git clone failed: a branch named ... already exists". Reused Platform sandboxes now delete the previous session's local branches when they are recycled. A new session for the same branch starts fresh from the base branch. Branch checkout also recovers from leftover or broken branch refs instead of failing the workspace. ([#21268](https://github.com/mastra-ai/mastra/pull/21268))

- Updated dependencies [[`566e080`](https://github.com/mastra-ai/mastra/commit/566e080ac4296ef2ba84a99c496a1c19706fa2df), [`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`c549e2f`](https://github.com/mastra-ai/mastra/commit/c549e2f40edc1cac5d9e74e82f90da22b48df084), [`2ef2f23`](https://github.com/mastra-ai/mastra/commit/2ef2f230a7aed342e7dc3b2000cd42e4c43e08a7), [`5740ec6`](https://github.com/mastra-ai/mastra/commit/5740ec60c760ffdfbfaa59d603d03b847c864e05)]:
  - @mastra/code-sdk@1.3.0-alpha.13
  - @mastra/core@1.60.0-alpha.13

## 0.8.0-alpha.13

### Minor Changes

- Added org-visible Factory sessions: sessions store a visibility property derived from origin, org members can open org-visible sessions, and factory-ui shows session owners and access errors. ([#21460](https://github.com/mastra-ai/mastra/pull/21460))

### Patch Changes

- Prevent Factory handoff files from colliding across work items ([#21763](https://github.com/mastra-ai/mastra/pull/21763))

- Fixed workspace failures vanishing from the chat transcript. A workspace that failed to clone or start only flipped an internal flag that nothing rendered, so the session simply looked stuck with no reason given. The failure now appears as an error notice in the transcript — the same message the terminal already printed — for both the `workspace_error` and the failing `workspace_status_changed` event. ([#21746](https://github.com/mastra-ai/mastra/pull/21746))

- Make the board honest about runs it is waiting on, and about clicks that fail. ([#21766](https://github.com/mastra-ai/mastra/pull/21766))

  Four gaps closed on the work board:

  - A card click that failed while refreshing workspaces before starting a run did
    nothing at all — no run, no error. It now surfaces the failure instead of
    swallowing it, so an expired session reads as an expired session.
  - A run a rule proposed could not be approved from the card. The card menu now
    offers it.
  - After a plan was approved, the Building run became unreachable from the card,
    leaving the item stranded mid-loop.
  - A card with a proposed run looked idle. It now says it is waiting on someone,
    with the approval inline.

- Stop showing "Linked card could not be filed" when nothing failed. ([#21766](https://github.com/mastra-ai/mastra/pull/21766))

  A linked-card decision that already succeeded is deliberately reset to `retry`
  when its card is rematerialized, so the card gets re-filed. The board read any
  `retry` as "already failed at least once" and put an error on the card, so a
  routine replay looked like a broken automation — 16 cards were showing a failure
  nobody caused.

  A card now reports an error only when the effect has actually been attempted or
  left an error behind. A replay reads as what it is: the work it is doing.

- Platform GitHub event polling is now scoped to the repositories linked to a Factory project. Previously the worker polled every repository the underlying GitHub App installation exposed, which for customers who grant broad org access meant hundreds of unnecessary requests per polling cycle. With this change, no polling happens for repositories that are not linked to a project, and repositories added or removed from a project are picked up automatically on the next polling cycle — no worker restart or additional configuration required. ([#21772](https://github.com/mastra-ai/mastra/pull/21772))

- Updated dependencies [[`6db7a5d`](https://github.com/mastra-ai/mastra/commit/6db7a5dd3dd2b6f7ef75dcd804fcffef5fa83963), [`0cdc5dc`](https://github.com/mastra-ai/mastra/commit/0cdc5dc69024957815da4f51acc4119eb4f447d7)]:
  - @mastra/core@1.60.0-alpha.12
  - @mastra/code-sdk@1.3.0-alpha.12

## 0.8.0-alpha.12

### Patch Changes

- Speed up the local dev watch for the design system: `pnpm dev:ui` now rebuilds `@mastra/playground-ui` on save, so design-system edits show up in the Factory UI without a manual rebuild. `pnpm dev:playground` picks up the same watch. The watch starts from a full build and then skips type declaration emit on every rebuild, which brings each save from ~9s down to ~1.5s. ([#21646](https://github.com/mastra-ai/mastra/pull/21646))

  Declarations stay frozen at that starting build for the length of a dev session — run `pnpm --filter @mastra/playground-ui build` after changing a component's props. The published build is unchanged and still emits declarations.

- Fixed how the Factory chat transcript reads agent controller events. It branched on an `om_activation.enabled` flag the controller never sends, and cast token usage and memory progress into hand-written shapes that had drifted from the streamed payloads. Both now read the shapes the controller actually emits, so the status line and memory rings stay correct as those payloads evolve. ([#21739](https://github.com/mastra-ai/mastra/pull/21739))

- Updated dependencies [[`6223446`](https://github.com/mastra-ai/mastra/commit/6223446ddce6166e96e0ba5e00d628b615dee8ca), [`583e235`](https://github.com/mastra-ai/mastra/commit/583e23519c13af16c1746f9c49722d011216611b), [`a77f8d4`](https://github.com/mastra-ai/mastra/commit/a77f8d4740d2178a74c41e4bf678b4fcd8fa0bb2), [`40d358e`](https://github.com/mastra-ai/mastra/commit/40d358e29d55543803e64b49241122f598ffabc7), [`e80cd7e`](https://github.com/mastra-ai/mastra/commit/e80cd7e7683e7d732e1cc6784bcac1d2640d2ce3), [`20504b2`](https://github.com/mastra-ai/mastra/commit/20504b2ecebd0e077acda3d457ab57480a98ed3e)]:
  - @mastra/core@1.60.0-alpha.11
  - @mastra/code-sdk@1.3.0-alpha.11

## 0.8.0-alpha.11

### Patch Changes

- Updated dependencies [[`b860493`](https://github.com/mastra-ai/mastra/commit/b86049391100e665d579f700c8a2034c036defc3)]:
  - @mastra/core@1.60.0-alpha.10
  - @mastra/code-sdk@1.3.0-alpha.10

## 0.8.0-alpha.10

### Patch Changes

- Updated dependencies [[`b0a2a07`](https://github.com/mastra-ai/mastra/commit/b0a2a07800d42bd9823292e7db832374ed084c9c), [`ccbbcd9`](https://github.com/mastra-ai/mastra/commit/ccbbcd974eedff4367a54ed0e24c9ee742ab2f61), [`3f5c6f7`](https://github.com/mastra-ai/mastra/commit/3f5c6f728ea35da344248de9aa070f12849f3aa0), [`77e6b1b`](https://github.com/mastra-ai/mastra/commit/77e6b1bc4c46ce94fe501023fb4393c812ec6be3), [`2e1d098`](https://github.com/mastra-ai/mastra/commit/2e1d0984e325fd319d32ea182f596b3170be3847)]:
  - @mastra/core@1.60.0-alpha.9
  - @mastra/code-sdk@1.3.0-alpha.9

## 0.8.0-alpha.9

### Minor Changes

- Added a configurable allowlist of reviewer bots that can trigger GitHub review and comment notifications. Set MASTRACODE_GITHUB_AUTHORIZED_BOTS (comma-separated logins) or pass authorizedBots to GithubIntegration to trust bots beyond the built-in defaults; previously only coderabbitai[bot] and devin-ai-integration[bot] were accepted and every other bot was dropped without a log line. Bot logins now match case-insensitively and rejected senders are logged. Fixes #21621 ([#21697](https://github.com/mastra-ai/mastra/pull/21697))

### Patch Changes

- Fixed the Factory chat transcript drawing the same content twice after coming back to a tab. While a run streams, leaving the tab drops the event stream and the transcript refetches on return: an assistant reply the server had persisted as its own step, and a steer whose live event was missed, both landed on screen a second time. The refetched window is now paired against what is already drawn — by message id, by tool call, then by the text itself — so it only inserts what is genuinely missing. ([#21651](https://github.com/mastra-ai/mastra/pull/21651))

  Also fixed a tool call rendering as two half-filled cards when a steer interrupted it: live tool state followed the newest assistant message instead of staying with the call it belongs to.

- The turn-end filesystem capture no longer blocks agent turn completion. Readers of the persisted workspace file listing wait up to 10 seconds for the in-flight capture to observe the just-ended turn's files; if a capture takes longer, a reader can temporarily receive the previous listing. ([#21679](https://github.com/mastra-ai/mastra/pull/21679))

- Fixed Linear intake so issues only land in the Factory project their Linear project is routed to. Previously, opening any board pulled in every selected Linear project's open issues and auto-triaged them there, repeating for each Factory project you viewed. ([#21698](https://github.com/mastra-ai/mastra/pull/21698))

  **Routing Linear projects**

  In Settings › Intake, each selected Linear project now picks the Factory it feeds. A project left unrouted no longer feeds any board, and boards only show the Linear intake feed for projects routed to them. Organizations with a single Factory keep working with no configuration.

  **Deleted cards stay deleted**

  Removing an intake card now also clears the stored routing decision behind it, so it no longer reappears on the next intake poll.

  Fixes #21614

- Updated dependencies [[`4e7a421`](https://github.com/mastra-ai/mastra/commit/4e7a421dce8a48742f785d1e93ad2f43a572b282), [`242e324`](https://github.com/mastra-ai/mastra/commit/242e3241e73cbd5c9bb86a31ebb49ca0256488d4), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`d774e89`](https://github.com/mastra-ai/mastra/commit/d774e8930c781df8c9effe3763e6b501c099b6cc), [`9c27a53`](https://github.com/mastra-ai/mastra/commit/9c27a53cd9d3de4f3f025bc387d94ce371c33f95), [`3a634e9`](https://github.com/mastra-ai/mastra/commit/3a634e9b32e3c47db3f287292ce37e862a02e005), [`dff25a1`](https://github.com/mastra-ai/mastra/commit/dff25a1103fa72ee082a9b6f805ebeb5ce400753), [`217e967`](https://github.com/mastra-ai/mastra/commit/217e9672d8b3160eb729d8e9f0044949e88da239), [`7f78585`](https://github.com/mastra-ai/mastra/commit/7f785857e401570e2ffb316911f126ed363aa537), [`f2a4afd`](https://github.com/mastra-ai/mastra/commit/f2a4afd7e37e809669001ed17724b341a5c1f45e), [`d438148`](https://github.com/mastra-ai/mastra/commit/d438148e222c1e2fb3c652725ce75680962ebec4), [`ba05fe0`](https://github.com/mastra-ai/mastra/commit/ba05fe0738f70cb686777546e968237d09269142), [`d26a8d4`](https://github.com/mastra-ai/mastra/commit/d26a8d4281f28414715b333c85bedaf70d0b2890), [`677cdc6`](https://github.com/mastra-ai/mastra/commit/677cdc6af564dec29a13464d12b7ab2a4efc22e9), [`a318490`](https://github.com/mastra-ai/mastra/commit/a318490e17da32f338d50929c770d901a9b3dd72), [`763e0c6`](https://github.com/mastra-ai/mastra/commit/763e0c61e04d76ad9a9efd301aa57525ca0cbea9), [`298aafd`](https://github.com/mastra-ai/mastra/commit/298aafd70d7fea6517b6e2a4b55f3ef9e824d96b), [`23e0be2`](https://github.com/mastra-ai/mastra/commit/23e0be261381e49534b4ff3101c60ee64a946cbf), [`7fc8806`](https://github.com/mastra-ai/mastra/commit/7fc880627d3cbf995d31ea0e8b807bf15417e651), [`0e02eac`](https://github.com/mastra-ai/mastra/commit/0e02eacdb2e30e1697a41910b41163742a181dc1), [`4df174c`](https://github.com/mastra-ai/mastra/commit/4df174c32bddf093a82f273070b8380aef7c9e90), [`f7c25b5`](https://github.com/mastra-ai/mastra/commit/f7c25b5106ddfb48e591f98df7a51e0f2dd01dba), [`dc09cc1`](https://github.com/mastra-ai/mastra/commit/dc09cc1083d861cde192c1cd235324dc75b8c731), [`36b4649`](https://github.com/mastra-ai/mastra/commit/36b4649045a3a380cbab8ceca866db4086223aff), [`377eb81`](https://github.com/mastra-ai/mastra/commit/377eb81ce43b964e3a6b541df172da74a8ff3716)]:
  - @mastra/core@1.60.0-alpha.8
  - @mastra/code-sdk@1.3.0-alpha.8

## 0.8.0-alpha.8

### Patch Changes

- Updated dependencies [[`940bf5c`](https://github.com/mastra-ai/mastra/commit/940bf5ccf04f2c9ebd8a1390431733222a03b1cd)]:
  - @mastra/core@1.60.0-alpha.7
  - @mastra/code-sdk@1.2.2-alpha.7

## 0.8.0-alpha.7

### Patch Changes

- Fixed Linear issue reconciliation for issues that are not assigned to a project. ([#21601](https://github.com/mastra-ai/mastra/pull/21601))

- Updated dependencies [[`0b4f108`](https://github.com/mastra-ai/mastra/commit/0b4f1089aa8d92e67c2a8e99726822c5ee410784), [`88ddc7c`](https://github.com/mastra-ai/mastra/commit/88ddc7ce01d40175f13a3228b789a906779680bd), [`a7dd322`](https://github.com/mastra-ai/mastra/commit/a7dd32247d95afc539f483ca37f4594af0387f59)]:
  - @mastra/core@1.60.0-alpha.6
  - @mastra/code-sdk@1.2.2-alpha.6

## 0.8.0-alpha.6

### Minor Changes

- Add per-repository worktree teardown commands and run them during terminal, explicit, and destructive Factory session cleanup. ([#21564](https://github.com/mastra-ai/mastra/pull/21564))

## 0.7.1-alpha.5

### Patch Changes

- Updated dependencies [[`74e5bd3`](https://github.com/mastra-ai/mastra/commit/74e5bd315b8b3a1e04cb6cf480bb0f5fc4951dc8)]:
  - @mastra/core@1.60.0-alpha.5
  - @mastra/code-sdk@1.2.2-alpha.5

## 0.7.1-alpha.4

### Patch Changes

- Updated dependencies [[`d7e6745`](https://github.com/mastra-ai/mastra/commit/d7e67456954863c55440ea9c49bc6ceb9949972d), [`9acb50f`](https://github.com/mastra-ai/mastra/commit/9acb50f71cec9c362f06820033f90ae6b1f8282f), [`46e9e3f`](https://github.com/mastra-ai/mastra/commit/46e9e3f73babe1bc70080a596cf2ac0b9da48519), [`3f9a190`](https://github.com/mastra-ai/mastra/commit/3f9a19057c027155867b9317294ee4ca7bd0581a), [`e8808e3`](https://github.com/mastra-ai/mastra/commit/e8808e3d8eb585a2565be53e56a7e0e1477352a4), [`d4be8c1`](https://github.com/mastra-ai/mastra/commit/d4be8c1739d22d621e3f78790e1dd5eb5ecc3589), [`a5d2eb1`](https://github.com/mastra-ai/mastra/commit/a5d2eb10347eade1ae2816d88f466c25186c54a5), [`e81744c`](https://github.com/mastra-ai/mastra/commit/e81744cd13c46619c142dc521dc0baac47607a84)]:
  - @mastra/core@1.60.0-alpha.4
  - @mastra/code-sdk@1.2.2-alpha.4

## 0.7.1-alpha.3

### Patch Changes

- Updated dependencies [[`d8308a2`](https://github.com/mastra-ai/mastra/commit/d8308a2be3c07e777393d1017a381dcae3890d30), [`7aad631`](https://github.com/mastra-ai/mastra/commit/7aad631b43bc10db77d5b8c66b200d7a49d18bf2), [`1794a79`](https://github.com/mastra-ai/mastra/commit/1794a79178c418004a7261b1ad9114066f7ef01d)]:
  - @mastra/core@1.60.0-alpha.3
  - @mastra/code-sdk@1.2.2-alpha.3

## 0.7.1-alpha.2

### Patch Changes

- Fixed session materialization timing being overwritten when sessions resume. The initial-materialize timestamp is now recorded once and preserved across idle-reap, checkpoint restore, and sandbox recreation, so time-to-first-materialize measurements reflect the true initial cost. Historical metrics captured before this fix are not backfilled. ([#21520](https://github.com/mastra-ai/mastra/pull/21520))

- Fixed Factory completion so moving a GitHub issue to Done marks it as pending close and removes its remaining triage status labels. ([#21515](https://github.com/mastra-ai/mastra/pull/21515))

- Improved chat scrolling in the factory. Sending a message now scrolls once and parks it near the top with room under it, and the view stays on the agent's newest output — tool progress, subagents, the streamed reply — instead of standing still or jumping back up to what you just sent. ([#21523](https://github.com/mastra-ai/mastra/pull/21523))

  Scroll up to read back and the chat stops following. Return to the bottom and it picks the stream up again. The jump-to-latest button no longer flickers when you send a message.

  The room under the live turn is released when the run ends, so a finished conversation settles against the composer instead of leaving most of the window blank.

- Updated dependencies [[`7e096f0`](https://github.com/mastra-ai/mastra/commit/7e096f02f0dddbf09b85d306458351245ed2f886), [`8f0a332`](https://github.com/mastra-ai/mastra/commit/8f0a3321bf180368d76fe7b36aa1a8f60f00b6de), [`b098de9`](https://github.com/mastra-ai/mastra/commit/b098de9d7cb9f672e0883a5c716465a3a689693d), [`ef6e295`](https://github.com/mastra-ai/mastra/commit/ef6e295b59bc25a5b61b633a89c97bcfce9fb465), [`208e1b3`](https://github.com/mastra-ai/mastra/commit/208e1b39f30f4b386e494394e9d71d96f0f90241), [`c938d34`](https://github.com/mastra-ai/mastra/commit/c938d34739936c8ecbabd67ad6a4a4396f41c4c6), [`1d9a0ea`](https://github.com/mastra-ai/mastra/commit/1d9a0ea4a9901baee6cd56737243bd6d1f631ac0), [`3667679`](https://github.com/mastra-ai/mastra/commit/3667679db057edfb086846d13369fdda4902ad65), [`49696e8`](https://github.com/mastra-ai/mastra/commit/49696e8e42f870674a0a58f5abcd22cc54dd2864), [`512100a`](https://github.com/mastra-ai/mastra/commit/512100a7d8b7e9c920f2590c6b3612f5de0d3cff), [`9ef432b`](https://github.com/mastra-ai/mastra/commit/9ef432b6faa534b57b0d182a610e13dd9a7123ff), [`b9cf308`](https://github.com/mastra-ai/mastra/commit/b9cf30846f97f99ac1906ee8a68f4f2d117b0378)]:
  - @mastra/core@1.60.0-alpha.2
  - @mastra/code-sdk@1.2.2-alpha.2

## 0.7.1-alpha.1

### Patch Changes

- Added Factory session state to browser tabs and the sidebar, so a running session can be followed without switching to its window. ([#21426](https://github.com/mastra-ai/mastra/pull/21426))

  - Session tab favicons are color-coded: amber while initializing, green while the agent works, blue when it is your turn, red on failure.
  - Sidebar status dots now cover workspaces and user sessions alike, with Initializing / Working / Ready tooltips in the same three colors, so a tab and its sidebar row read the same.
  - Failures show on the favicon only; the sidebar has no error dot yet.
  - Tab titles show the session's identifier — `#1567` for GitHub pull requests and issues, `COR-210` for Linear — or the thread title for user sessions.
  - Board kickoff toasts gained a **New Tab** action, so a ready session opens without leaving the board.
  - Fixed a pinned session losing its sidebar slot when five other sessions were busy at once.

- Fixed observational memory in Factory web user sessions ignoring the stored memory settings. Sessions created from the web UI now start with the observer and reflector models, thresholds, and attachment preferences saved in your memory settings, instead of falling back to the built-in default model — which failed with a missing API key error when that provider was not configured. ([#21423](https://github.com/mastra-ai/mastra/pull/21423))

- The Review board now has a Canceled column. A pull request closed without merging used to reappear in Intake — the queue of pull requests still waiting for review — carrying a "Canceled" chip to explain why it looked out of place. It now sits in its own column. ([#21323](https://github.com/mastra-ai/mastra/pull/21323))

- Fixed the Factory session favicons being nearly invisible in light-themed browsers: the Mastra mark now switches to black on light and white on dark, matching the default favicon, and the state dots use the design system's light-theme accents so amber, green, blue, and red stay legible on a white tab strip. ([#21510](https://github.com/mastra-ai/mastra/pull/21510))

- Improved Factory stage handling so run routes and board columns stay aligned with the rule stage vocabulary. ([#21516](https://github.com/mastra-ai/mastra/pull/21516))

- Smoothed out the chat transcript. A streamed reply now reveals at a steady pace instead of arriving in clumps, and a tool card that turns up while the agent is working fades in rather than popping onto the page. Both stop for readers who ask for reduced motion. ([#21499](https://github.com/mastra-ai/mastra/pull/21499))

- Board cards now show one status line instead of stacking several. A card reports what you just triggered, then what a rule is doing on its own, then what a click will do — one thing at a time, in that order. ([#21323](https://github.com/mastra-ai/mastra/pull/21323))

  Automatic actions say what they do rather than where they sit in a queue. A card reads "Starting an automated run…" while a rule works, and "Automated run could not start" when it gives up, with the raw error one hover away next to Retry. An action the server is still re-attempting says "— retrying…", so a card looping through retries no longer looks like one starting for the first time.

  Unfiled GitHub and Linear items now use the same card as filed work. Clicking anywhere on the card starts its default run and reports "Starting run…" while that resolves, instead of looking inert. A link to the issue or pull request sits beside the title, and the remaining actions are in the card's actions menu.

  A resting card also shows less. The click hint and the actions menu fade in when you point at the card or reach it with the keyboard, the hint shares the author's line instead of taking a row of its own, and labels are shorter. Touch screens have no hover, so they keep both visible.

- Updated dependencies [[`15101bb`](https://github.com/mastra-ai/mastra/commit/15101bb53c0d934f31af6b8813b88191e382a5e5), [`c2c3deb`](https://github.com/mastra-ai/mastra/commit/c2c3debcf670c7082d0a5e553aa99818a864698c), [`8a4a4af`](https://github.com/mastra-ai/mastra/commit/8a4a4af31358fa3af79b962f87cf9a89f2c07aa9), [`33374ba`](https://github.com/mastra-ai/mastra/commit/33374ba359e4fb13eaa918ae925fe167a3c55414), [`c5f964d`](https://github.com/mastra-ai/mastra/commit/c5f964d3f77064e978f8066ec506eed77ba5c63c), [`f8f653f`](https://github.com/mastra-ai/mastra/commit/f8f653f10980d01a73706cc3c8689ca5e40ce808)]:
  - @mastra/core@1.60.0-alpha.1
  - @mastra/auth-studio@1.3.4-alpha.0
  - @mastra/code-sdk@1.2.2-alpha.1

## 0.7.1-alpha.0

### Patch Changes

- Updated dependencies [[`587f6ef`](https://github.com/mastra-ai/mastra/commit/587f6efcfc25880b93760a8607d1cd381ec612fe)]:
  - @mastra/core@1.59.1-alpha.0
  - @mastra/code-sdk@1.2.2-alpha.0

## 0.7.0

### Minor Changes

- **Automatic agent runs are now opt-in per Factory** ([#21326](https://github.com/mastra-ai/mastra/pull/21326))

  Factory rules no longer start agent runs on their own. When a rule wants to start one — reviewing a new pull request, triaging an issue, planning work — it is parked as a `proposed` decision, and clicking the card starts it. Rules that only mirror external facts are untouched: a merged pull request still moves its card to Done, a closed issue still lands in Done or Canceled.

  Automatic runs are switched on and off from the top of the Work and Review boards, and they start off — including for Factories that exist today, so rules stop starting runs on upgrade until someone turns them back on.

  A proposal that nobody wants can be turned down from the card menu or the Rules page, and both actions are recorded in the audit log. Through the API:

  ```ts
  // Turn automatic runs back on for a Factory.
  await fetch(`/web/factory/projects/${factoryProjectId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ autoRunEnabled: true }),
  });

  // Release a parked run, or drop it for good.
  await fetch(`/web/factory/projects/${factoryProjectId}/decisions/${decisionId}/approve`, { method: 'POST' });
  await fetch(`/web/factory/projects/${factoryProjectId}/decisions/${decisionId}/dismiss`, { method: 'POST' });
  ```

  **Why:** opening a pull request used to start an agent that checks out and runs its code, with no way to say no. That consent now belongs to the Factory owner, while the board keeps reflecting what happens in GitHub and Linear either way.

- Added independent GitHub issue and pull request reconciliation controls for Factory, with legacy reconciliation settings preserved as fallbacks. Added Linear issue reconciliation aliases and automatically move linked work cards to Done or Canceled when upstream issues close. ([#21342](https://github.com/mastra-ai/mastra/pull/21342))

  For example, run GitHub issue reconciliation every minute while leaving pull-request reconciliation at its existing cadence:

  ```sh
  MASTRACODE_GITHUB_ISSUE_RECONCILE_INTERVAL_MS=60000
  ```

- Added Slack channel adapter options to `SlackIntegration` and made concise thinking, typing, and working statuses the default. ([#21381](https://github.com/mastra-ai/mastra/pull/21381))

  ```ts
  new SlackIntegration({
    signingSecret,
    adapterOptions: {
      streaming: true,
      toolDisplay: 'grouped',
    },
  });
  ```

### Patch Changes

- Cleaned up the agent transcript in the Factory web UI. Tool calls, tool groups and skill activations now share one row shape: a leading glyph for the kind of call, the label, the live command, and a disclosure chevron that only shows on hover. A collapsed group keeps its `5 steps` label and stands for what it holds with one glyph per kind of call, instead of a generic `Find files · Read · Run` list. ([#21321](https://github.com/mastra-ai/mastra/pull/21321))

  A skill now looks the same whether you activated it or the agent called the `skill` tool itself: both render the instructions as Markdown rather than a raw arguments-and-output dump, and a skill call no longer disappears inside a group of steps.

  Also fixed two artefacts: a message carrying only internal step markers drew an empty chat bubble, and invisible parts split runs of tool calls into unrelated groups.

- Factory triage now uses `status:` labels so triaged and approval-pending issues remain visible to the Factory workflow. ([#21318](https://github.com/mastra-ai/mastra/pull/21318))

- Route GitHub issue investigation through Factory rules and the bundled `factory-triage` skill instead of the legacy triage runner. ([#21413](https://github.com/mastra-ai/mastra/pull/21413))

- Replaced the raw `buffering`/`observing`/`reflecting` phase label in the Factory status line with two rings, one per memory budget: the message window and the accumulated observations. Each ring shows how full its budget is, and a highlight travels around the ring while memory works through it — background work reads as work instead of leaking an internal phase name. A memory pass that actually holds the turn still says so ("saving memory", "consolidating memory"). Both rings sit in one control, and clicking it opens both budgets in full: an icon each in the budget's own colour, the figures, and a line saying what reaching the threshold sets off. The control speaks both readings to assistive tech, which a button otherwise hides. ([#21366](https://github.com/mastra-ai/mastra/pull/21366))

  A background pass now shows on the budget it actually acts on, rather than as one word shared by both.

- Fixed the Mastra client being recreated on every render of MastraClientProvider, which silently reset per-client caches such as endpoint support and capability probes. ([#21326](https://github.com/mastra-ai/mastra/pull/21326))

- Fixed the Factory error screen rendering its message as a single column of letters down the page when the factories list fails to load. The notice now shows as a centered card with a readable line length. ([#21322](https://github.com/mastra-ai/mastra/pull/21322))

- Fixed a failed branch push being reported as a token cleanup error. When the push failed and the token cleanup failed too, the cleanup error replaced the push error, so a push blocked by the network was reported with an unrelated error code. The push error is now reported as-is with its own code, and the cleanup error is added to the end of its message. ([#21407](https://github.com/mastra-ai/mastra/pull/21407))

- Fixed workspace opening failures reporting a confusing `ENOENT` / `The "cwd" option is invalid` error instead of the real cause. When a repository clone failed and left no working directory behind, the token cleanup that always runs afterwards crashed on the missing directory and replaced the original error. Blocked egress, bad credentials, or a missing repository now surface as the actual failure. ([#21338](https://github.com/mastra-ai/mastra/pull/21338))

  Token cleanup is also stricter where it matters: once the access token has been written into the checkout's git settings, a failed cleanup is now always reported — even when the update itself failed, and even when a failed clone left a partial checkout behind — instead of being silently ignored.

- Factory Overview now measures the Factory, not the connected repo. ([#21333](https://github.com/mastra-ai/mastra/pull/21333))

  The integrations sync every issue and pull request of a connected repository onto the board, and those cards vastly outnumber the work the Factory actually runs. The Overview counted all of them, so a busy repo reported hundreds of completions, a lead time measured from the moment the poller filed the card, and an automation rate pinned near 100% because the poller stamps itself on every move it makes.

  **What changed**

  - Throughput, lead time, in-flight, work intake and stage coverage now cover only cards a Factory run was started on.
  - **In flight** no longer counts the intake inbox, so it covers the same work as the queue-health chart below it, which already excluded it.
  - **Automation coverage** is now **Agent coverage**: the share of each stage's first passes an agent finished, instead of any move no human made. The near-constant automation ratio card is gone.
  - **Agents running** previously read threads under the wrong resource and always showed 0. The work-item listing now reports which of the cards it returns have a run in flight, so the count and the 'agent running' marker in the queue-health drill-down come from one read and can't disagree.
  - Deleting a card whose agent is running clears its running marker with the card, instead of leaving it counted until the next poll.

  `GET /web/factory/projects/:id/work-items` gains `runningSessionIds` alongside `workItems`. `FactoryMetrics` drops `transitions` and renames `stageAutomation` to `agentCoverage` (`exits` → `passes`, `automated` → `byAgent`).

- Fixed MASTRACODE_ENV_DIR being resolved against the UI source directory instead of the working directory, which made the dev server silently load no environment variables when a relative path was given. ([#21326](https://github.com/mastra-ai/mastra/pull/21326))

- Send opaque acting-user subjects with Platform sandbox requests, including Factory creation and reattachment flows. ([#20754](https://github.com/mastra-ai/mastra/pull/20754))

  ```typescript
  import { PlatformSandbox } from '@mastra/platform-workspace';

  const sandbox = new PlatformSandbox({
    environmentId: 'env_abc',
    actingUserId: auth.user.id,
  });
  ```

- Improved Factory issue investigations with effort and impact labels. ([#21401](https://github.com/mastra-ai/mastra/pull/21401))

- Chat messages now carry the time they were sent and a button that copies their text. Both sit under the message and only appear when you hover (or keyboard-focus) it, so the transcript stays clean. ([#21350](https://github.com/mastra-ai/mastra/pull/21350))

- - Trigger a fresh review when a push arrives after a pull request review finishes. ([#21356](https://github.com/mastra-ai/mastra/pull/21356))
  - Cancel an in-flight review when a push or Factory bot re-review request supersedes it.
  - Route platform-polled `synchronize` and `review_requested` events through the same review rules as direct webhooks.
  - Revive subscribed sessions with the persisted owner identified by the subscription session ID.
  - Isolate failed subscription deliveries so stale bindings do not replay events or block newer repository activity.

  A push or bot request that returns a card from `done` to `review` now runs `factory-rereview`. The skill reconciles the previous review against the pushed commits, checks for newly introduced defects, and reviews the whole pull request again before publishing its verdict. A canceled first-time review still restarts with `factory-review` because it has no completed pass to reconcile.

- Agent replies now fade in word by word as they stream, instead of snapping whole chunks of text into place. Each word appears whole, so the visible text trails the stream by at most one word. A block that changes shape while it grows — a paragraph turning into a list item — fades again. Text that has finished streaming renders as before. ([#21417](https://github.com/mastra-ai/mastra/pull/21417))

- Fixed workspace completion sounds and activity indicators to remain synchronized when switching threads. Running indicators no longer require an open workspace session, so they stay live on the board and overview pages too. ([#21353](https://github.com/mastra-ai/mastra/pull/21353))

- Fixed markdown rendering in the Factory chat. Bullet and numbered lists show their markers again instead of collapsing into blankly indented lines, and task lists, tables and blockquotes now render properly. Fenced code blocks go through the design-system code block, so they get syntax highlighting, a copy button and a readable surface, and inline code is legible on every background. ([#21355](https://github.com/mastra-ai/mastra/pull/21355))

  The chat now uses the same markdown renderer as the Studio rather than its own copy, so both stay in sync from here on.

- Added a Skills page under the Agent section in Factory settings that shows the pipeline stage skills (Triage, Planning, Review, Re-review) with their playbook content, backed by a new GET /web/factory/skills endpoint. Also fixed a noisy checkpoint warning when the sandbox does not support snapshots. ([#21369](https://github.com/mastra-ai/mastra/pull/21369))

- Improved Factory issue triage to label confirmed direct @mastra/core bugs. ([#21179](https://github.com/mastra-ai/mastra/pull/21179))

- Improved work session preparation feedback across light and dark themes. ([#21382](https://github.com/mastra-ai/mastra/pull/21382))

- Updated dependencies [[`088e41e`](https://github.com/mastra-ai/mastra/commit/088e41e434ed05f2c674b254f1034ec46a57a7be), [`aa3e7be`](https://github.com/mastra-ai/mastra/commit/aa3e7be30f8addb0278ea74429f4df054517a287), [`d118873`](https://github.com/mastra-ai/mastra/commit/d118873cfd5074b1f814a1c169a97ca7a3a29174), [`b2f0013`](https://github.com/mastra-ai/mastra/commit/b2f0013375588d40c03c13e843b99c0ff8872ca5), [`3b541ae`](https://github.com/mastra-ai/mastra/commit/3b541ae5d410c52b80a7e381d84d021cddb9a449), [`79dd7c2`](https://github.com/mastra-ai/mastra/commit/79dd7c261ee6be1fafedd4651959394db21d2cba), [`90822db`](https://github.com/mastra-ai/mastra/commit/90822dba08fb2169c518e4a6d7f127c098eb46b8), [`898bba4`](https://github.com/mastra-ai/mastra/commit/898bba46d4806dd255a44e5dc3a3d5827eaefdfe), [`b9a28ec`](https://github.com/mastra-ai/mastra/commit/b9a28ecf7acdc0cb7a543d5b660f9fbee301df9a), [`f9aab1c`](https://github.com/mastra-ai/mastra/commit/f9aab1cfc3fda03238a7fd7bd8b794e07497878c), [`3700208`](https://github.com/mastra-ai/mastra/commit/37002080c7838267803a7e579a7d58b908d62f36), [`e31421b`](https://github.com/mastra-ai/mastra/commit/e31421bc9c11c03c6e74f447ecb5820000e2b9d7), [`8b7131e`](https://github.com/mastra-ai/mastra/commit/8b7131eb0407f58f5205e68fb27b81f026488f28), [`161258b`](https://github.com/mastra-ai/mastra/commit/161258b3473a6d0fce00a43cab59d119a49a232f), [`aece0e7`](https://github.com/mastra-ai/mastra/commit/aece0e7cb124ae1eb1230689b887f5554b9a0bf0), [`ae79e34`](https://github.com/mastra-ai/mastra/commit/ae79e34c0bd8674fc24c7524217bfc4a051c6136), [`59d8898`](https://github.com/mastra-ai/mastra/commit/59d8898c8cb48b342fe5bcb5eee803cc8cc95060), [`a6c4399`](https://github.com/mastra-ai/mastra/commit/a6c4399763590b3dae21a2c81826e89a3b1deee4), [`a40f915`](https://github.com/mastra-ai/mastra/commit/a40f9157690d89ef13ce825cc88e30be581de5d4), [`8ea8038`](https://github.com/mastra-ai/mastra/commit/8ea80386fde53d26e2c0b2060c53bc9bd9be10f3), [`be31796`](https://github.com/mastra-ai/mastra/commit/be3179624ad5f77cff5fa342cd08046bf7605283), [`79c4f82`](https://github.com/mastra-ai/mastra/commit/79c4f8295f568752eeadf8a9b50010a7d9ec06ae), [`90822db`](https://github.com/mastra-ai/mastra/commit/90822dba08fb2169c518e4a6d7f127c098eb46b8), [`7dafa4f`](https://github.com/mastra-ai/mastra/commit/7dafa4f670fb16ec8ff07349645a00ca12bc5794)]:
  - @mastra/core@1.59.0
  - @mastra/code-sdk@1.2.1

## 0.7.0-alpha.5

### Patch Changes

- Agent replies now fade in word by word as they stream, instead of snapping whole chunks of text into place. Each word appears whole, so the visible text trails the stream by at most one word. A block that changes shape while it grows — a paragraph turning into a list item — fades again. Text that has finished streaming renders as before. ([#21417](https://github.com/mastra-ai/mastra/pull/21417))

- Updated dependencies [[`59d8898`](https://github.com/mastra-ai/mastra/commit/59d8898c8cb48b342fe5bcb5eee803cc8cc95060), [`a40f915`](https://github.com/mastra-ai/mastra/commit/a40f9157690d89ef13ce825cc88e30be581de5d4)]:
  - @mastra/core@1.59.0-alpha.5
  - @mastra/code-sdk@1.2.1-alpha.5

## 0.7.0-alpha.4

### Minor Changes

- Added Slack channel adapter options to `SlackIntegration` and made concise thinking, typing, and working statuses the default. ([#21381](https://github.com/mastra-ai/mastra/pull/21381))

  ```ts
  new SlackIntegration({
    signingSecret,
    adapterOptions: {
      streaming: true,
      toolDisplay: 'grouped',
    },
  });
  ```

### Patch Changes

- Fixed a failed branch push being reported as a token cleanup error. When the push failed and the token cleanup failed too, the cleanup error replaced the push error, so a push blocked by the network was reported with an unrelated error code. The push error is now reported as-is with its own code, and the cleanup error is added to the end of its message. ([#21407](https://github.com/mastra-ai/mastra/pull/21407))

- Send opaque acting-user subjects with Platform sandbox requests, including Factory creation and reattachment flows. ([#20754](https://github.com/mastra-ai/mastra/pull/20754))

  ```typescript
  import { PlatformSandbox } from '@mastra/platform-workspace';

  const sandbox = new PlatformSandbox({
    environmentId: 'env_abc',
    actingUserId: auth.user.id,
  });
  ```

- Fixed workspace completion sounds and activity indicators to remain synchronized when switching threads. Running indicators no longer require an open workspace session, so they stay live on the board and overview pages too. ([#21353](https://github.com/mastra-ai/mastra/pull/21353))

- Updated dependencies [[`79dd7c2`](https://github.com/mastra-ai/mastra/commit/79dd7c261ee6be1fafedd4651959394db21d2cba), [`b9a28ec`](https://github.com/mastra-ai/mastra/commit/b9a28ecf7acdc0cb7a543d5b660f9fbee301df9a), [`be31796`](https://github.com/mastra-ai/mastra/commit/be3179624ad5f77cff5fa342cd08046bf7605283)]:
  - @mastra/core@1.59.0-alpha.4
  - @mastra/code-sdk@1.2.1-alpha.4

## 0.7.0-alpha.3

### Patch Changes

- Fixed workspace opening failures reporting a confusing `ENOENT` / `The "cwd" option is invalid` error instead of the real cause. When a repository clone failed and left no working directory behind, the token cleanup that always runs afterwards crashed on the missing directory and replaced the original error. Blocked egress, bad credentials, or a missing repository now surface as the actual failure. ([#21338](https://github.com/mastra-ai/mastra/pull/21338))

  Token cleanup is also stricter where it matters: once the access token has been written into the checkout's git settings, a failed cleanup is now always reported — even when the update itself failed, and even when a failed clone left a partial checkout behind — instead of being silently ignored.

- Updated dependencies [[`d118873`](https://github.com/mastra-ai/mastra/commit/d118873cfd5074b1f814a1c169a97ca7a3a29174), [`161258b`](https://github.com/mastra-ai/mastra/commit/161258b3473a6d0fce00a43cab59d119a49a232f), [`8ea8038`](https://github.com/mastra-ai/mastra/commit/8ea80386fde53d26e2c0b2060c53bc9bd9be10f3)]:
  - @mastra/core@1.59.0-alpha.3
  - @mastra/code-sdk@1.2.1-alpha.3

## 0.7.0-alpha.2

### Minor Changes

- Added independent GitHub issue and pull request reconciliation controls for Factory, with legacy reconciliation settings preserved as fallbacks. Added Linear issue reconciliation aliases and automatically move linked work cards to Done or Canceled when upstream issues close. ([#21342](https://github.com/mastra-ai/mastra/pull/21342))

  For example, run GitHub issue reconciliation every minute while leaving pull-request reconciliation at its existing cadence:

  ```sh
  MASTRACODE_GITHUB_ISSUE_RECONCILE_INTERVAL_MS=60000
  ```

### Patch Changes

- Route GitHub issue investigation through Factory rules and the bundled `factory-triage` skill instead of the legacy triage runner. ([#21413](https://github.com/mastra-ai/mastra/pull/21413))

- Replaced the raw `buffering`/`observing`/`reflecting` phase label in the Factory status line with two rings, one per memory budget: the message window and the accumulated observations. Each ring shows how full its budget is, and a highlight travels around the ring while memory works through it — background work reads as work instead of leaking an internal phase name. A memory pass that actually holds the turn still says so ("saving memory", "consolidating memory"). Both rings sit in one control, and clicking it opens both budgets in full: an icon each in the budget's own colour, the figures, and a line saying what reaching the threshold sets off. The control speaks both readings to assistive tech, which a button otherwise hides. ([#21366](https://github.com/mastra-ai/mastra/pull/21366))

  A background pass now shows on the budget it actually acts on, rather than as one word shared by both.

- Improved Factory issue investigations with effort and impact labels. ([#21401](https://github.com/mastra-ai/mastra/pull/21401))

- Improved Factory issue triage to label confirmed direct @mastra/core bugs. ([#21179](https://github.com/mastra-ai/mastra/pull/21179))

- Improved work session preparation feedback across light and dark themes. ([#21382](https://github.com/mastra-ai/mastra/pull/21382))

- Updated dependencies [[`898bba4`](https://github.com/mastra-ai/mastra/commit/898bba46d4806dd255a44e5dc3a3d5827eaefdfe), [`f9aab1c`](https://github.com/mastra-ai/mastra/commit/f9aab1cfc3fda03238a7fd7bd8b794e07497878c), [`e31421b`](https://github.com/mastra-ai/mastra/commit/e31421bc9c11c03c6e74f447ecb5820000e2b9d7), [`aece0e7`](https://github.com/mastra-ai/mastra/commit/aece0e7cb124ae1eb1230689b887f5554b9a0bf0)]:
  - @mastra/core@1.59.0-alpha.2
  - @mastra/code-sdk@1.2.1-alpha.2

## 0.7.0-alpha.1

### Minor Changes

- **Automatic agent runs are now opt-in per Factory** ([#21326](https://github.com/mastra-ai/mastra/pull/21326))

  Factory rules no longer start agent runs on their own. When a rule wants to start one — reviewing a new pull request, triaging an issue, planning work — it is parked as a `proposed` decision, and clicking the card starts it. Rules that only mirror external facts are untouched: a merged pull request still moves its card to Done, a closed issue still lands in Done or Canceled.

  Automatic runs are switched on and off from the top of the Work and Review boards, and they start off — including for Factories that exist today, so rules stop starting runs on upgrade until someone turns them back on.

  A proposal that nobody wants can be turned down from the card menu or the Rules page, and both actions are recorded in the audit log. Through the API:

  ```ts
  // Turn automatic runs back on for a Factory.
  await fetch(`/web/factory/projects/${factoryProjectId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ autoRunEnabled: true }),
  });

  // Release a parked run, or drop it for good.
  await fetch(`/web/factory/projects/${factoryProjectId}/decisions/${decisionId}/approve`, { method: 'POST' });
  await fetch(`/web/factory/projects/${factoryProjectId}/decisions/${decisionId}/dismiss`, { method: 'POST' });
  ```

  **Why:** opening a pull request used to start an agent that checks out and runs its code, with no way to say no. That consent now belongs to the Factory owner, while the board keeps reflecting what happens in GitHub and Linear either way.

### Patch Changes

- Fixed the Mastra client being recreated on every render of MastraClientProvider, which silently reset per-client caches such as endpoint support and capability probes. ([#21326](https://github.com/mastra-ai/mastra/pull/21326))

- Factory Overview now measures the Factory, not the connected repo. ([#21333](https://github.com/mastra-ai/mastra/pull/21333))

  The integrations sync every issue and pull request of a connected repository onto the board, and those cards vastly outnumber the work the Factory actually runs. The Overview counted all of them, so a busy repo reported hundreds of completions, a lead time measured from the moment the poller filed the card, and an automation rate pinned near 100% because the poller stamps itself on every move it makes.

  **What changed**

  - Throughput, lead time, in-flight, work intake and stage coverage now cover only cards a Factory run was started on.
  - **In flight** no longer counts the intake inbox, so it covers the same work as the queue-health chart below it, which already excluded it.
  - **Automation coverage** is now **Agent coverage**: the share of each stage's first passes an agent finished, instead of any move no human made. The near-constant automation ratio card is gone.
  - **Agents running** previously read threads under the wrong resource and always showed 0. The work-item listing now reports which of the cards it returns have a run in flight, so the count and the 'agent running' marker in the queue-health drill-down come from one read and can't disagree.
  - Deleting a card whose agent is running clears its running marker with the card, instead of leaving it counted until the next poll.

  `GET /web/factory/projects/:id/work-items` gains `runningSessionIds` alongside `workItems`. `FactoryMetrics` drops `transitions` and renames `stageAutomation` to `agentCoverage` (`exits` → `passes`, `automated` → `byAgent`).

- Fixed MASTRACODE_ENV_DIR being resolved against the UI source directory instead of the working directory, which made the dev server silently load no environment variables when a relative path was given. ([#21326](https://github.com/mastra-ai/mastra/pull/21326))

- Chat messages now carry the time they were sent and a button that copies their text. Both sit under the message and only appear when you hover (or keyboard-focus) it, so the transcript stays clean. ([#21350](https://github.com/mastra-ai/mastra/pull/21350))

- - Trigger a fresh review when a push arrives after a pull request review finishes. ([#21356](https://github.com/mastra-ai/mastra/pull/21356))
  - Cancel an in-flight review when a push or Factory bot re-review request supersedes it.
  - Route platform-polled `synchronize` and `review_requested` events through the same review rules as direct webhooks.
  - Revive subscribed sessions with the persisted owner identified by the subscription session ID.
  - Isolate failed subscription deliveries so stale bindings do not replay events or block newer repository activity.

  A push or bot request that returns a card from `done` to `review` now runs `factory-rereview`. The skill reconciles the previous review against the pushed commits, checks for newly introduced defects, and reviews the whole pull request again before publishing its verdict. A canceled first-time review still restarts with `factory-review` because it has no completed pass to reconcile.

- Fixed markdown rendering in the Factory chat. Bullet and numbered lists show their markers again instead of collapsing into blankly indented lines, and task lists, tables and blockquotes now render properly. Fenced code blocks go through the design-system code block, so they get syntax highlighting, a copy button and a readable surface, and inline code is legible on every background. ([#21355](https://github.com/mastra-ai/mastra/pull/21355))

  The chat now uses the same markdown renderer as the Studio rather than its own copy, so both stay in sync from here on.

- Added a Skills page under the Agent section in Factory settings that shows the pipeline stage skills (Triage, Planning, Review, Re-review) with their playbook content, backed by a new GET /web/factory/skills endpoint. Also fixed a noisy checkpoint warning when the sandbox does not support snapshots. ([#21369](https://github.com/mastra-ai/mastra/pull/21369))

- Updated dependencies [[`aa3e7be`](https://github.com/mastra-ai/mastra/commit/aa3e7be30f8addb0278ea74429f4df054517a287), [`90822db`](https://github.com/mastra-ai/mastra/commit/90822dba08fb2169c518e4a6d7f127c098eb46b8), [`3700208`](https://github.com/mastra-ai/mastra/commit/37002080c7838267803a7e579a7d58b908d62f36), [`8b7131e`](https://github.com/mastra-ai/mastra/commit/8b7131eb0407f58f5205e68fb27b81f026488f28), [`79c4f82`](https://github.com/mastra-ai/mastra/commit/79c4f8295f568752eeadf8a9b50010a7d9ec06ae), [`90822db`](https://github.com/mastra-ai/mastra/commit/90822dba08fb2169c518e4a6d7f127c098eb46b8)]:
  - @mastra/core@1.59.0-alpha.1
  - @mastra/code-sdk@1.2.1-alpha.1

## 0.6.1-alpha.0

### Patch Changes

- Cleaned up the agent transcript in the Factory web UI. Tool calls, tool groups and skill activations now share one row shape: a leading glyph for the kind of call, the label, the live command, and a disclosure chevron that only shows on hover. A collapsed group keeps its `5 steps` label and stands for what it holds with one glyph per kind of call, instead of a generic `Find files · Read · Run` list. ([#21321](https://github.com/mastra-ai/mastra/pull/21321))

  A skill now looks the same whether you activated it or the agent called the `skill` tool itself: both render the instructions as Markdown rather than a raw arguments-and-output dump, and a skill call no longer disappears inside a group of steps.

  Also fixed two artefacts: a message carrying only internal step markers drew an empty chat bubble, and invisible parts split runs of tool calls into unrelated groups.

- Factory triage now uses `status:` labels so triaged and approval-pending issues remain visible to the Factory workflow. ([#21318](https://github.com/mastra-ai/mastra/pull/21318))

- Fixed the Factory error screen rendering its message as a single column of letters down the page when the factories list fails to load. The notice now shows as a centered card with a readable line length. ([#21322](https://github.com/mastra-ai/mastra/pull/21322))

- Updated dependencies [[`088e41e`](https://github.com/mastra-ai/mastra/commit/088e41e434ed05f2c674b254f1034ec46a57a7be), [`b2f0013`](https://github.com/mastra-ai/mastra/commit/b2f0013375588d40c03c13e843b99c0ff8872ca5), [`3b541ae`](https://github.com/mastra-ai/mastra/commit/3b541ae5d410c52b80a7e381d84d021cddb9a449), [`ae79e34`](https://github.com/mastra-ai/mastra/commit/ae79e34c0bd8674fc24c7524217bfc4a051c6136), [`a6c4399`](https://github.com/mastra-ai/mastra/commit/a6c4399763590b3dae21a2c81826e89a3b1deee4)]:
  - @mastra/core@1.59.0-alpha.0
  - @mastra/code-sdk@1.2.1-alpha.0

## 0.6.0

### Minor Changes

- Added creator and recent worker attribution to Factory board cards, with names and profile images from GitHub and Linear. GitHub pull request cards now show the author and draft, open, closed, or merged status. ([#20822](https://github.com/mastra-ai/mastra/pull/20822))

- Added a `firstMeaningfulExecAt` timestamp to source-control sessions, recording when the session's agent completed its first successful sandbox command. Together with `firstMessageAt` this measures time-to-first-meaningful-exec: how long a user waits between sending their first message and the agent actually doing work in a live sandbox. The value is written once per session and is available on all session read APIs; setup commands run by the platform itself (skill loading, repo checkout) do not count. ([#21211](https://github.com/mastra-ai/mastra/pull/21211))

- Fixed the Factory metrics so the same date range always reports the same numbers, and dropped the response fields that nothing displayed. ([#21256](https://github.com/mastra-ai/mastra/pull/21256))

  **Completions are events, not the board's current state.** Throughput and lead time now count entries into `done` in the stage history, so reopening a card no longer erases the day it shipped and a card that shipped twice counts twice. The per-day rate divides by the days the board actually existed, so a 12-month range on a two-week-old board no longer reads as ~0 per day.

  **Automation numbers stop counting the wrong things.** A card landing on the board when it is created is no longer counted as an automated stage move, which used to credit every webhook-synced card. Automation coverage measures the first pass through each stage only — a redo used to add a second entry to the denominator alone, capping a fully automated stage at 50% — and each pass's outcome is now frozen at the end of the window instead of reflecting where the card sits today.

  **Response shape.** `stageDurations`, `wip`, `agingWip` and `earliestItemAt` are gone: nothing rendered them, and live in-flight work is already covered by the queue-health chart. `windowDays` is now `daysCovered` (the window clipped to the board's life) and `cycleTime` is `leadTime`, which is what it always measured — card creation through to `done`.

  The metrics endpoint (`GET /web/factory/projects/:id/metrics`) renames two fields:

  ```jsonc
  // before
  { "metrics": { "windowDays": 30, "cycleTime": { "medianMs": 7200000 } } }
  // after
  { "metrics": { "daysCovered": 30, "leadTime": { "medianMs": 7200000 } } }
  ```

  A corrupt stage-history timestamp now throws instead of being read as 1970.

- Added stable identities and display titles for Factory user sessions. ([#20781](https://github.com/mastra-ai/mastra/pull/20781))

  `POST /web/github/projects/:id/sessions` now accepts optional `sessionId` and `title` fields. When `branch` is omitted, the session uses `user/session-<sessionId>`. Callers can create a client-side draft, safely retry the first server request with the same UUID, and show the first prompt as a human-readable title. If `sessionId` is omitted, the server generates one. Explicit branches still work unchanged.

  ```ts
  const sessionId = crypto.randomUUID();
  const response = await fetch(`/web/github/projects/${projectRepositoryId}/sessions`, {
    method: 'POST',
    body: JSON.stringify({ sessionId, title: 'Fix the login flow' }),
  });
  ```

  Titles collapse whitespace, trim surrounding space, and are limited to 80 characters. Blank titles are stored as `null`.

- Add a reasoning-effort configuration surface across mastracode and Factory (fixes #20766): ([#20884](https://github.com/mastra-ai/mastra/pull/20884))

  - New `max` thinking level (mapped to `reasoning effort: max` for OpenAI Codex and Anthropic `effort`).
  - Anthropic extended-thinking wiring: the session thinking level now applies to anthropic/claude-opus-4-7 and other Anthropic models via provider thinking/effort options (previously OpenAI-only).
  - New `models.modeThinkingDefaults` setting: per-mode (build/plan/fast) default thinking levels, resolved at request time with precedence session override → mode default → global `preferences.thinkingLevel`. Configuration changes now apply to the next request of every session, including automated Factory runs.
  - Factory: new Settings → Defaults controls for editing global and per-mode thinking defaults in local deployments.
  - TUI: `/think` now sets a session-only override, supports `/think default` to clear it, and `/think status` reports the effective level with provenance (session override / mode default / global default).

  Example `settings.json` configuration:

  ```json
  {
    "preferences": { "thinkingLevel": "medium" },
    "models": {
      "modeThinkingDefaults": {
        "build": "high",
        "plan": "max",
        "fast": "off"
      }
    }
  }
  ```

- Added persisted workspace file lists for Factory threads. The Files view now keeps a thread's captured file list available after an agent run while file contents continue to load from its live sandbox. ([#20937](https://github.com/mastra-ai/mastra/pull/20937))

- Added label reconciliation and label filtering to Factory work and review boards. GitHub pull requests, GitHub issues, and Linear issues now keep their labels in sync with the provider, and boards expose a searchable multi-select label filter that shares state through the URL. ([#20845](https://github.com/mastra-ai/mastra/pull/20845))

  Selected labels round-trip through the `label` query parameter (repeated per label to preserve values containing commas):

  ```
  /factory/project/<id>/work?label=bug&label=needs%20triage
  /factory/project/<id>/review?teammate=<userId>&label=priority%3Ap0
  ```

- Added automatic GitHub and Linear issue reconciliation so Factory work items stay current when provider metadata changes outside Factory. Platform Linear now tails the Platform event stream and folds a periodic reconcile sweep in on its own cadence, so Issue updates flow into Factory through the normal rules pipeline without waiting for the next board poll. ([#20845](https://github.com/mastra-ai/mastra/pull/20845))

  GitHub issue reconciliation runs inside the same worker as the pull-request reconciler (both self-hosted and Platform), sharing the same lease, cadence, and configured-repository target set. That means one sweep per repository per interval covers both writers of card state.

  Reconciliation is on by default. Disable or tune it with environment variables on the Factory server:

  ```bash
  # Turn Linear reconciliation off entirely.
  MASTRACODE_LINEAR_RECONCILE_ENABLED=false

  # Slow the Linear reconcile sweep down (default: 5 minutes).
  MASTRACODE_LINEAR_RECONCILE_INTERVAL_MS=600000

  # Stop Platform Linear from tailing the event stream; the reconcile sweep still runs.
  MASTRACODE_PLATFORM_LINEAR_POLLING_ENABLED=false

  # GitHub reconciliation uses the same shape.
  MASTRACODE_GITHUB_RECONCILE_ENABLED=false
  MASTRACODE_GITHUB_RECONCILE_INTERVAL_MS=600000
  ```

- Added a `firstMessageAt` timestamp to Factory source-control sessions. The session's first agent run now records when the first message reached the agent, so session listings and latency reporting can measure time-to-first-response from the real conversation start instead of the session's creation time (which can be long before the user sends anything). The value is returned on session objects from the source-control sessions API and is write-once: later messages never move it. ([#21206](https://github.com/mastra-ai/mastra/pull/21206))

- Added searchable, resettable teammate and relevance filters to Factory work and review boards. Filter state can be shared by URL, and matching covers GitHub and Linear authors, assignees, activity, and requested reviewers. ([#20841](https://github.com/mastra-ai/mastra/pull/20841))

  Example shareable URL: `/factory/projects/<id>/board?teammate=github:octocat&relevance=authored,assigned`.

- The Factory now re-reviews a pull request when review is re-requested from its GitHub bot. After any Factory verdict (approve or request changes), clicking GitHub's re-request review button on the Factory reviewer moves the Review card back into Reviewing and starts a fresh review pass. Only trusted collaborators (write or admin) can trigger it, and re-requests aimed at human reviewers or on closed, merged, or already-in-review pull requests are ignored. ([#20830](https://github.com/mastra-ai/mastra/pull/20830))

### Patch Changes

- Fixed workspace re-open hard-failing when a session branch was auto-deleted after merge. `git pull` messages like "no such ref was fetched" and "couldn't find remote ref" are now treated as benign, so materialization keeps the checkout as-is instead of leaving permanent rule-effect alerts on Done items. ([#20910](https://github.com/mastra-ai/mastra/pull/20910))

- Fixed sandbox checkpoints only being captured at session teardown. Factory sessions now snapshot the workspace sandbox at the end of every agent turn, so sandboxes that are reclaimed while idle can be restored from a checkpoint that includes the last completed turn's changes. ([#21227](https://github.com/mastra-ai/mastra/pull/21227))

- Fixed Slack threads on cloud factory deployments falling back to chat-only sessions or erroring instead of getting a repo-backed workspace. ([#21217](https://github.com/mastra-ai/mastra/pull/21217))

  - Fixed repository resolution failing when a factory project carries a stale source-control connection (for example after a GitHub App reinstall deleted the old installation but left its connection behind). Resolution now tries every connection and skips the ones that no longer resolve.
  - Fixed chat-only sessions on deployments configured with a remote sandbox replying with "A Factory session ID is required to create a remote sandbox workspace" on every message. These sessions now run without a workspace, so workspace tools are simply not registered and the server host never executes commands for them.
  - Fixed top-level DM and channel conversations (threads with no thread timestamp) failing their clone with the invalid git ref `slack/`. Their session branch now derives from the channel id.

- Improved Factory workspace deletion by terminating matching live controller sessions before sandbox reclamation. ([#21174](https://github.com/mastra-ai/mastra/pull/21174))

- Added `dispatcher.maxInFlight` to `MastraFactoryConfig` and the `MASTRACODE_DISPATCH_MAX_IN_FLIGHT` deployment setting to configure the maximum number of concurrent Factory background dispatches per replica. ([#20903](https://github.com/mastra-ai/mastra/pull/20903))

  ```sh
  export MASTRACODE_DISPATCH_MAX_IN_FLIGHT=10
  ```

- Fixed Factory sessions rejecting signed-in users when session-based authentication providers store the user and active organization in a wrapped session shape. Workspace ownership checks and GitHub session tools now recognize both flat and session-wrapped authenticated users. ([#21008](https://github.com/mastra-ai/mastra/pull/21008))

- Make factory review sessions survive server restarts, dropped connections, and strict git configs. ([#20899](https://github.com/mastra-ai/mastra/pull/20899))

  - Crash-resumed sessions recover their run binding and untrusted-checkout posture from the binding table instead of silently losing the transition tool.
  - Overly long transition rationales are clamped instead of failing the run.
  - Clones and pulls retry when the transfer to github.com drops partway through.
  - Checkouts with `pull.rebase` set no longer fail workspace materialization.

- Fixed the sign-in callback redirecting straight back to the identity provider in a loop when it denies access (for example access_denied for an account that is not part of the organization). The denial now lands on the sign-in page with the error shown. ([#21166](https://github.com/mastra-ai/mastra/pull/21166))

- Fixed the Factory review handoff turning finding references into GitHub links. A re-review that pointed back at "Blocking `#1`" published a link to issue 1 of the repository; findings are now named by subject and `file:line`. ([#21263](https://github.com/mastra-ai/mastra/pull/21263))

- Improved Factory issue investigations with structured summaries and GitHub triage-label updates. ([#20988](https://github.com/mastra-ai/mastra/pull/20988))

- Fixed Factory intake saves when generated clients include disabled defaults for integrations that are not configured. ([#21019](https://github.com/mastra-ai/mastra/pull/21019))

- Fixed Factory review sessions losing caller identity when an existing request context is empty. ([#21055](https://github.com/mastra-ai/mastra/pull/21055))

- Fixed Linear issue investigations using inconsistent metadata, failing to start, or resolving a stale work item binding after the same session was rebound. ([#20810](https://github.com/mastra-ai/mastra/pull/20810))

- Slow workspace opens can now be diagnosed directly from server logs. Added `[factory:timing]` log lines for each phase of the sandbox session-open path — `sandbox.reattach`, `sandbox.provision`, `workspace.materialize`, and `workspace.checkout` — so you can see exactly which phase is slow instead of reconstructing timings by hand. ([#21194](https://github.com/mastra-ai/mastra/pull/21194))

- Fixed autonomous GitHub factory-rule runs ignoring the factory's configured default model. ([#20827](https://github.com/mastra-ai/mastra/pull/20827))

  A run triggered by a factory rule started on the built-in default model rather than the model configured on the factory project, so a factory set up for a provider other than the built-in default failed the run outright with a missing-credentials error. Runs started from the board were unaffected, which is why this only appeared on autonomous runs. Rule-triggered runs now start on the project's configured model, matching runs started from the board.

- Added a `command_exit` session event to the agent controller. Subscribers now receive the exit code and success flag of each foreground `execute_command` tool call, alongside the existing `shell_output` stream: ([#21211](https://github.com/mastra-ai/mastra/pull/21211))

  ```typescript
  session.subscribe(event => {
    if (event.type === 'command_exit') {
      console.log(event.toolCallId, event.exitCode, event.success);
    }
  });
  ```

  Previously the exit outcome was only visible inside the tool result text, so observers could stream a command's output but never tell whether it succeeded.

- Return from deleting a workspace as soon as its session is gone instead of holding the request open while the sandbox is reclaimed. Waking the VM and scrubbing its checkout took minutes on a large repository, so the UI appeared to hang long after the workspace had been removed. The scrub and pool release now run in the background; because a sandbox only becomes claimable once it is published to the reuse pool, the next session still gets a clean checkout. ([#20785](https://github.com/mastra-ai/mastra/pull/20785))

- Hardened the GitHub reconcile worker, the Platform Linear event worker, and the shared issue reconciler: ([#20845](https://github.com/mastra-ai/mastra/pull/20845))

  - Platform Linear Issue events now only dispatch to `(orgId, factoryProjectId)` pairs that already have a persisted work item for the incoming Linear issue. Previously the worker fanned an event out to every Factory project regardless of tenant, which could materialize a triage card in an unrelated org via the default `linearIssueObserved` rule.
  - Reconciler metadata patches no longer spread `undefined` values over stored fields, so a live issue that omits (for example) an author does not clobber the previously recorded value.
  - Documented the event worker's at-most-once delivery contract explicitly: the cursor advances past a failing ingest and drift is caught by the folded reconciler sweep on its own cadence.
  - `GithubReconcileWorker` now renews its lease while a sweep is in flight, so folding the issue sweep into the same tick can no longer let the lease expire and hand off to a replica mid-sweep. A `renewLease` result of `false` or a renewal error is treated as lease loss: the worker aborts before running the folded issue sweep and skips `releaseLease` so the new owner's TTL is not disturbed.
  - The Platform Linear event worker no longer calls `listWorkspaces` in reconcile-only mode, so a workspace-listing outage cannot block the reconcile sweep.
  - The Platform Linear event worker now resolves the project list once per event page rather than once per event, avoiding up to `EVENT_PAGE_SIZE` × N project scans per poll cycle.

- Fixed new Factory sessions stalling for minutes when the background decision queue was deep. The dispatcher now claims pending session starts before deferred decisions, so a new session always starts on the next tick. ([#21265](https://github.com/mastra-ai/mastra/pull/21265))

- Fixed reused Factory workspaces retaining GitHub credentials from an outdated work or review assignment. ([#21035](https://github.com/mastra-ai/mastra/pull/21035))

- Fixed Slack sessions ignoring the factory's configured default model and memory settings. ([#20832](https://github.com/mastra-ai/mastra/pull/20832))

  Sessions started from Slack ran on the built-in default model rather than the model configured on the factory project, so a factory set up for a provider other than the built-in default failed every Slack message with a missing-credentials error. Repo-backed Slack threads now start on the project's configured model and observational-memory settings, matching runs started from the web.

  A thread keeps a model chosen inside it. Once a model is set on the thread, restarting the server no longer resets it to the project default.

- Work board cards now follow their GitHub issue when it closes: closing an issue moves its card to Done (or to Canceled when the issue was closed as `not_planned` or `duplicate`), and a card whose issue closed while the deployment was unreachable is caught up automatically by the periodic reconcile sweep. Previously these cards stayed on the board until moved by hand. ([#20895](https://github.com/mastra-ai/mastra/pull/20895))

- Preserved every GitHub issue assignee end-to-end so Factory boards no longer drop co-assignees, and backfilled missing assignee and reviewer metadata so the pull request reconciler stops re-fetching cards on every sweep. ([#20841](https://github.com/mastra-ai/mastra/pull/20841))

- Updated dependencies [[`e7109ee`](https://github.com/mastra-ai/mastra/commit/e7109ee6f731bacc79c885906f3c7dca8d8f013a), [`ae0e985`](https://github.com/mastra-ai/mastra/commit/ae0e985e8f1186a8ecfcf0de6dd36ac12ef85324), [`e7109ee`](https://github.com/mastra-ai/mastra/commit/e7109ee6f731bacc79c885906f3c7dca8d8f013a), [`b8ce7ec`](https://github.com/mastra-ai/mastra/commit/b8ce7ec96e39343c6c2f36d12d68a9ad816c09f7), [`2e4624e`](https://github.com/mastra-ai/mastra/commit/2e4624edb6917e61249cb60ee377735e7af7e4a9), [`45a9147`](https://github.com/mastra-ai/mastra/commit/45a914741f578754d79d8b7de7b4e4f304d8e14a), [`a3a3624`](https://github.com/mastra-ai/mastra/commit/a3a3624f646b98e409424d8defccbd334da9e8b8), [`6246914`](https://github.com/mastra-ai/mastra/commit/62469146636911f3cbbe0880bd011c6a897a59a7), [`6445eba`](https://github.com/mastra-ai/mastra/commit/6445eba6020abac681aba1cc9289f446cb400cbe), [`86b7b77`](https://github.com/mastra-ai/mastra/commit/86b7b777980d30f66e1fd134a37d2af4c22e54cc), [`1c75e32`](https://github.com/mastra-ai/mastra/commit/1c75e32f7fc0b9fb6f548b4407feaec8a1440212), [`296dc9a`](https://github.com/mastra-ai/mastra/commit/296dc9af29f3616e786c7825ec32e0df92d754c5), [`f59032a`](https://github.com/mastra-ai/mastra/commit/f59032a73699443555a08a479e7ac578975784f2), [`f59032a`](https://github.com/mastra-ai/mastra/commit/f59032a73699443555a08a479e7ac578975784f2), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`1670533`](https://github.com/mastra-ai/mastra/commit/1670533986f6bacf567746245348125e3a106448), [`3f73c07`](https://github.com/mastra-ai/mastra/commit/3f73c076727e8c36b4fff7a1b40290fb68957fa8), [`772c0c8`](https://github.com/mastra-ai/mastra/commit/772c0c897cec383258de2e6178147f8014767c7b), [`d7cf7fa`](https://github.com/mastra-ai/mastra/commit/d7cf7fafc1ae1b50bd8462dd0e6c671a8606db93), [`7c1ebb1`](https://github.com/mastra-ai/mastra/commit/7c1ebb15690c4b3f0eabb19077cf8af573311e57), [`0f9a448`](https://github.com/mastra-ai/mastra/commit/0f9a448502157e59f7b76f24360ad497168f5ef8), [`578bf2e`](https://github.com/mastra-ai/mastra/commit/578bf2e6a88e9d5b8bf502204e15a95dfbb679ae), [`3e50f63`](https://github.com/mastra-ai/mastra/commit/3e50f63db85e9fe365b4ce5daecb0ac0dc464d93), [`25956fc`](https://github.com/mastra-ai/mastra/commit/25956fc8841780d506acb22b618fdb4dcf6c4e21), [`2e4624e`](https://github.com/mastra-ai/mastra/commit/2e4624edb6917e61249cb60ee377735e7af7e4a9), [`c47165c`](https://github.com/mastra-ai/mastra/commit/c47165c983c87594c6952f1fd2fa51a90205034c), [`289f4ce`](https://github.com/mastra-ai/mastra/commit/289f4ce16e3293370440172132c52ee787cbc09f), [`df31eb0`](https://github.com/mastra-ai/mastra/commit/df31eb0c7087d782a0d9346e467f9a4af4b0eef6), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`4f16ff8`](https://github.com/mastra-ai/mastra/commit/4f16ff824bf2f9b0ddc93f210477c10c8a4fb1ab), [`b4c89b4`](https://github.com/mastra-ai/mastra/commit/b4c89b4371b0c86da57403ad1a3b3ef0681f3128), [`e6534fa`](https://github.com/mastra-ai/mastra/commit/e6534fab031216f6cb48c4c9907cbfdce9d60bc6), [`210cb7a`](https://github.com/mastra-ai/mastra/commit/210cb7a167998c7bbf72cb3b93e6eb0563330239), [`06b2d87`](https://github.com/mastra-ai/mastra/commit/06b2d87e63bcdd0ed59215c6789692b9b12de376), [`1c67d85`](https://github.com/mastra-ai/mastra/commit/1c67d85e9da8285662f4dbbf47e0378c3fee0747), [`ac01d63`](https://github.com/mastra-ai/mastra/commit/ac01d6355974aec73fdb8781449ed12bac582094), [`80a3324`](https://github.com/mastra-ai/mastra/commit/80a33245d3110204de6f56d61211523ffe338692), [`e44e8f3`](https://github.com/mastra-ai/mastra/commit/e44e8f370b66c339ddcaba946d33da6d3c3f06cd), [`d9d2881`](https://github.com/mastra-ai/mastra/commit/d9d2881ede6dd6c023d144215fc812062aed0890), [`a810a05`](https://github.com/mastra-ai/mastra/commit/a810a058f62ad407cfc1701e0be36ae91145d7cf), [`ba24be6`](https://github.com/mastra-ai/mastra/commit/ba24be662439c331ab23a600041f93803c89eca8), [`842b5fe`](https://github.com/mastra-ai/mastra/commit/842b5fe22b6a7fa811bd14e48eb9af523ac989f2), [`990611b`](https://github.com/mastra-ai/mastra/commit/990611ba76eb876d86c9c594371ae5f02f94b432), [`80bdf3a`](https://github.com/mastra-ai/mastra/commit/80bdf3ae16ade6ff63bde0cb16fa2df8ab7dd4dd), [`c967a5e`](https://github.com/mastra-ai/mastra/commit/c967a5eec150c5dc5418c4a4388982d1fb7ad27c), [`1315d8f`](https://github.com/mastra-ai/mastra/commit/1315d8f17e8e7acb61cca46b72a1d42f6d00d289), [`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b), [`9ba1247`](https://github.com/mastra-ai/mastra/commit/9ba12470c77f1c03642d720ce67e517e878f666e), [`fd96298`](https://github.com/mastra-ai/mastra/commit/fd96298a8367622f4ebfcaa97b5b6c1fbbd14564), [`66bbfb5`](https://github.com/mastra-ai/mastra/commit/66bbfb5f05b473d39f88c0e4a481ccac41634f3a), [`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b), [`f8da216`](https://github.com/mastra-ai/mastra/commit/f8da21633e7eb0e31c9ce0fc30567870d19416d3), [`4a09a9c`](https://github.com/mastra-ai/mastra/commit/4a09a9c0474ef643558fcb5f0edc542b82f1cab0), [`5f798b3`](https://github.com/mastra-ai/mastra/commit/5f798b3362e9bdf4d690f85245606e146eef60b9), [`6a84954`](https://github.com/mastra-ai/mastra/commit/6a84954a2667f85b6d59da652dab1bbff007ccb0), [`1e83a47`](https://github.com/mastra-ai/mastra/commit/1e83a4734ab61ba5926af6793e3569a78b72ed37), [`52d8ef0`](https://github.com/mastra-ai/mastra/commit/52d8ef03801f1deb7ee48532fc4190dd4a33916c), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`7fdcaa6`](https://github.com/mastra-ai/mastra/commit/7fdcaa66105d64290f9b14432a12ec99f39c4d3a), [`d6c56f9`](https://github.com/mastra-ai/mastra/commit/d6c56f951db3213330b98b0abafa9778c8770e58), [`e08e789`](https://github.com/mastra-ai/mastra/commit/e08e789c1bf4cd2fe46363f7a4728536ceccc9bd), [`bf936e2`](https://github.com/mastra-ai/mastra/commit/bf936e2c89b2ff0dad5695b873ddc009ba96d41e), [`7fb580a`](https://github.com/mastra-ai/mastra/commit/7fb580ac73fbcacf2ff00872a3395f73ae1b9fa5), [`ed5d606`](https://github.com/mastra-ai/mastra/commit/ed5d606739c5e3fbdfa9f272df7809aa5ab43b1d), [`f53d5bd`](https://github.com/mastra-ai/mastra/commit/f53d5bd4885b29e4ac29a428a6044088ea8d6aa3), [`87db0e4`](https://github.com/mastra-ai/mastra/commit/87db0e49a8c04030eb74fff7f051fac330678839), [`32980a3`](https://github.com/mastra-ai/mastra/commit/32980a3e2413d0274ac244d32c37d910edc13f00), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`82e3365`](https://github.com/mastra-ai/mastra/commit/82e3365ef7c9bf7bee2e7a7029035ea262d68895), [`6104347`](https://github.com/mastra-ai/mastra/commit/61043473ba6bfd0a25156824e853e13165562e6c), [`35cc901`](https://github.com/mastra-ai/mastra/commit/35cc90102cf834a84827acaf9eee0b6d6d1e2a3b), [`a8b4cf0`](https://github.com/mastra-ai/mastra/commit/a8b4cf02823cffebc4751a53337dfacf097c1ae1), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`0ce1d05`](https://github.com/mastra-ai/mastra/commit/0ce1d054586c5d348543d2749067b40adbc9b783), [`6698e16`](https://github.com/mastra-ai/mastra/commit/6698e168d74e054fc3efa97b19025fb2d1dafc45), [`333785c`](https://github.com/mastra-ai/mastra/commit/333785c93cbb01e42c60167e995457c28897ddbf), [`bda2235`](https://github.com/mastra-ai/mastra/commit/bda22353ee28f2df0eaea555f7cae1549f979c0b), [`efd5c81`](https://github.com/mastra-ai/mastra/commit/efd5c81cc25fde3c2ddd86fc1178deb4ec176e19), [`a04d1a6`](https://github.com/mastra-ai/mastra/commit/a04d1a642ccae3ea3b28be37067480d49bcb1b7d), [`1b482c2`](https://github.com/mastra-ai/mastra/commit/1b482c2d89244dd758c41e5f927a2b44041388d2), [`45bfb88`](https://github.com/mastra-ai/mastra/commit/45bfb88fd52f1dd3be20e2a38905777c96499c90), [`ff28284`](https://github.com/mastra-ai/mastra/commit/ff2828416f14daff9d956e6a352fdaa23c950979), [`4bcdfaf`](https://github.com/mastra-ai/mastra/commit/4bcdfaf0eac3199d7cb171b0a19a92c9c341eea4), [`e3b9307`](https://github.com/mastra-ai/mastra/commit/e3b9307098daefbfae2a52ae2ef51bc9fc701190), [`d6834c5`](https://github.com/mastra-ai/mastra/commit/d6834c5a7866b16734d23900163c2414ed70d791), [`f33264f`](https://github.com/mastra-ai/mastra/commit/f33264f517ae603279afd5c4251e2b40f6dd3618), [`689f2c4`](https://github.com/mastra-ai/mastra/commit/689f2c4b6c0835fe455702b01d21daa8abcd9331), [`fcd0667`](https://github.com/mastra-ai/mastra/commit/fcd0667a4e378be35c9a1b1eb19cce78fbfd7282), [`cfd0d9e`](https://github.com/mastra-ai/mastra/commit/cfd0d9ec77ec3c69dd96f79cdb579e03d79f22ce), [`acc3513`](https://github.com/mastra-ai/mastra/commit/acc3513b19f79bf0a7ec2998694580edca54086c), [`1670533`](https://github.com/mastra-ai/mastra/commit/1670533986f6bacf567746245348125e3a106448), [`a7eb4a1`](https://github.com/mastra-ai/mastra/commit/a7eb4a11450f6170274ed5141bffe821d4fdd5a6), [`0976933`](https://github.com/mastra-ai/mastra/commit/0976933142333ec78451feef265b68bcb45aa5e7), [`242b945`](https://github.com/mastra-ai/mastra/commit/242b94558777bfbdeb42cbfea84afff0b6ad0633), [`c52d346`](https://github.com/mastra-ai/mastra/commit/c52d3462ec831a5d95926ecd3d3373f5928ad2e5), [`af4636a`](https://github.com/mastra-ai/mastra/commit/af4636a74463275d71c1d13a38f7d2b738f128bf), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`2eabc09`](https://github.com/mastra-ai/mastra/commit/2eabc097d86d52fbd0123da36a7c874154cc384f), [`0023e79`](https://github.com/mastra-ai/mastra/commit/0023e7919431078280abd11c89d1edeae35fcc69), [`c2ad51e`](https://github.com/mastra-ai/mastra/commit/c2ad51e2467f901eecba8c9f4a45e22a50bd7c18), [`25ca73d`](https://github.com/mastra-ai/mastra/commit/25ca73d25dee7ce9f0ca72939e3a505c4db7257e), [`2f9ef3f`](https://github.com/mastra-ai/mastra/commit/2f9ef3f4ca06fc2dcdd5088c26b7f4da6a016791), [`e7eefcb`](https://github.com/mastra-ai/mastra/commit/e7eefcb162cda7c493e8c3bf43050ead0efbcb2c), [`fea5cae`](https://github.com/mastra-ai/mastra/commit/fea5caedc7e2cfea51784a15e015952692027abf), [`72ce266`](https://github.com/mastra-ai/mastra/commit/72ce2669506e755c0bbe73baf3a7e8ea5208bdad), [`4d7aca2`](https://github.com/mastra-ai/mastra/commit/4d7aca2fe75f225c83d1502d63079568e6ec163f), [`e1cead1`](https://github.com/mastra-ai/mastra/commit/e1cead17b5f3653cf00d2f90cc19b113119c02ba), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`d9d93b2`](https://github.com/mastra-ai/mastra/commit/d9d93b25e4a65ad5fa153fa35be7ed149c8d587f), [`c4ec889`](https://github.com/mastra-ai/mastra/commit/c4ec889561c0264c43f66d04d587bee4ce35e792), [`4b59f78`](https://github.com/mastra-ai/mastra/commit/4b59f786cbc9a7d1ef07a07517dbd4b96865e99d), [`eeae63e`](https://github.com/mastra-ai/mastra/commit/eeae63e7fbe8e1f237adc69bca6e2ac13c5ca907), [`3dc97ea`](https://github.com/mastra-ai/mastra/commit/3dc97ea415fad353b48a13095fad1835933cc12a), [`94e7ae9`](https://github.com/mastra-ai/mastra/commit/94e7ae970b37c888cd1244ef013292639a2fe6d1), [`e6a2860`](https://github.com/mastra-ai/mastra/commit/e6a2860649cc51f87d32d78b766ae2126446ba07), [`7010c5d`](https://github.com/mastra-ai/mastra/commit/7010c5d15728bf9c5dfe4fb6b1bf80ce23bf143a), [`bab06b1`](https://github.com/mastra-ai/mastra/commit/bab06b18923873a584bdfc71a6b4ec7fb4727fb7), [`3d01cd3`](https://github.com/mastra-ai/mastra/commit/3d01cd387321b6f9c5cac31d487c84bf51b19c78), [`7bf3086`](https://github.com/mastra-ai/mastra/commit/7bf308663f0115ca74ad20554ade740f06640859), [`4c186a0`](https://github.com/mastra-ai/mastra/commit/4c186a017275f45e6ed4c09de0f89550e2d09e8c), [`b0fa077`](https://github.com/mastra-ai/mastra/commit/b0fa077bcbc9b08551846fe372a0d3d15b71ed72), [`0282e16`](https://github.com/mastra-ai/mastra/commit/0282e16115538c8e9b248b90f0748eb01cb5dc98), [`a8dd139`](https://github.com/mastra-ai/mastra/commit/a8dd1391a9fe9a6632c25809ef236980afa9a020), [`6a667b4`](https://github.com/mastra-ai/mastra/commit/6a667b4b7cd6a93fe41fcdd357b08c5a8c09b9ab), [`9be8878`](https://github.com/mastra-ai/mastra/commit/9be8878dcf0388e84fc4873e0eec27bd49b881a4), [`e5786be`](https://github.com/mastra-ai/mastra/commit/e5786be02bb903073082bd9d6da880ebaacc343f), [`2440e09`](https://github.com/mastra-ai/mastra/commit/2440e096ea6c2def1ccc1eb2d0f3f5b88c4af940), [`2093fbd`](https://github.com/mastra-ai/mastra/commit/2093fbd53bb744bae19ec89f6d73db9a66fbe8a7), [`a59049b`](https://github.com/mastra-ai/mastra/commit/a59049b1652a13efff66ac826326b5ed9a550342), [`7bd85ea`](https://github.com/mastra-ai/mastra/commit/7bd85ea7588b71c25ce9f4019c88f8539be5dcbc), [`83fa004`](https://github.com/mastra-ai/mastra/commit/83fa0044bfda8b703a83883dbd8bef204844d13f), [`833432b`](https://github.com/mastra-ai/mastra/commit/833432b92612b7f122aa7342132ea37f2ad96e77), [`a463cdf`](https://github.com/mastra-ai/mastra/commit/a463cdf1c95c3059e70f0bff27959e8558bb899d), [`e7a5da4`](https://github.com/mastra-ai/mastra/commit/e7a5da4ef8e4dd452d2f232961b4e682a85ffe43), [`0282e16`](https://github.com/mastra-ai/mastra/commit/0282e16115538c8e9b248b90f0748eb01cb5dc98), [`7b4393d`](https://github.com/mastra-ai/mastra/commit/7b4393d557411fdcf07b0e30e5acaf7cc85154ae), [`0ea6b80`](https://github.com/mastra-ai/mastra/commit/0ea6b8001408ce02b56e8be0536b0fd8cbaf8ad2)]:
  - @mastra/code-sdk@1.2.0
  - @mastra/core@1.58.0
  - @mastra/slack@1.6.1

## 0.6.0-alpha.19

### Patch Changes

- Fixed the Factory review handoff turning finding references into GitHub links. A re-review that pointed back at "Blocking `#1`" published a link to issue 1 of the repository; findings are now named by subject and `file:line`. ([#21263](https://github.com/mastra-ai/mastra/pull/21263))

- Updated dependencies [[`296dc9a`](https://github.com/mastra-ai/mastra/commit/296dc9af29f3616e786c7825ec32e0df92d754c5), [`1670533`](https://github.com/mastra-ai/mastra/commit/1670533986f6bacf567746245348125e3a106448), [`4a09a9c`](https://github.com/mastra-ai/mastra/commit/4a09a9c0474ef643558fcb5f0edc542b82f1cab0), [`1e83a47`](https://github.com/mastra-ai/mastra/commit/1e83a4734ab61ba5926af6793e3569a78b72ed37), [`ff28284`](https://github.com/mastra-ai/mastra/commit/ff2828416f14daff9d956e6a352fdaa23c950979), [`1670533`](https://github.com/mastra-ai/mastra/commit/1670533986f6bacf567746245348125e3a106448)]:
  - @mastra/core@1.58.0-alpha.16
  - @mastra/code-sdk@1.2.0-alpha.18

## 0.6.0-alpha.18

### Minor Changes

- Fixed the Factory metrics so the same date range always reports the same numbers, and dropped the response fields that nothing displayed. ([#21256](https://github.com/mastra-ai/mastra/pull/21256))

  **Completions are events, not the board's current state.** Throughput and lead time now count entries into `done` in the stage history, so reopening a card no longer erases the day it shipped and a card that shipped twice counts twice. The per-day rate divides by the days the board actually existed, so a 12-month range on a two-week-old board no longer reads as ~0 per day.

  **Automation numbers stop counting the wrong things.** A card landing on the board when it is created is no longer counted as an automated stage move, which used to credit every webhook-synced card. Automation coverage measures the first pass through each stage only — a redo used to add a second entry to the denominator alone, capping a fully automated stage at 50% — and each pass's outcome is now frozen at the end of the window instead of reflecting where the card sits today.

  **Response shape.** `stageDurations`, `wip`, `agingWip` and `earliestItemAt` are gone: nothing rendered them, and live in-flight work is already covered by the queue-health chart. `windowDays` is now `daysCovered` (the window clipped to the board's life) and `cycleTime` is `leadTime`, which is what it always measured — card creation through to `done`.

  The metrics endpoint (`GET /web/factory/projects/:id/metrics`) renames two fields:

  ```jsonc
  // before
  { "metrics": { "windowDays": 30, "cycleTime": { "medianMs": 7200000 } } }
  // after
  { "metrics": { "daysCovered": 30, "leadTime": { "medianMs": 7200000 } } }
  ```

  A corrupt stage-history timestamp now throws instead of being read as 1970.

### Patch Changes

- Updated dependencies [[`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b), [`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b)]:
  - @mastra/core@1.58.0-alpha.15
  - @mastra/code-sdk@1.2.0-alpha.17

## 0.6.0-alpha.17

### Patch Changes

- Fixed sandbox checkpoints only being captured at session teardown. Factory sessions now snapshot the workspace sandbox at the end of every agent turn, so sandboxes that are reclaimed while idle can be restored from a checkpoint that includes the last completed turn's changes. ([#21227](https://github.com/mastra-ai/mastra/pull/21227))

- Improved Factory workspace deletion by terminating matching live controller sessions before sandbox reclamation. ([#21174](https://github.com/mastra-ai/mastra/pull/21174))

- Fixed new Factory sessions stalling for minutes when the background decision queue was deep. The dispatcher now claims pending session starts before deferred decisions, so a new session always starts on the next tick. ([#21265](https://github.com/mastra-ai/mastra/pull/21265))

- Updated dependencies [[`210cb7a`](https://github.com/mastra-ai/mastra/commit/210cb7a167998c7bbf72cb3b93e6eb0563330239), [`5f798b3`](https://github.com/mastra-ai/mastra/commit/5f798b3362e9bdf4d690f85245606e146eef60b9), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`25ca73d`](https://github.com/mastra-ai/mastra/commit/25ca73d25dee7ce9f0ca72939e3a505c4db7257e), [`e1cead1`](https://github.com/mastra-ai/mastra/commit/e1cead17b5f3653cf00d2f90cc19b113119c02ba), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437)]:
  - @mastra/core@1.58.0-alpha.14
  - @mastra/code-sdk@1.2.0-alpha.16

## 0.6.0-alpha.16

### Minor Changes

- Added a `firstMeaningfulExecAt` timestamp to source-control sessions, recording when the session's agent completed its first successful sandbox command. Together with `firstMessageAt` this measures time-to-first-meaningful-exec: how long a user waits between sending their first message and the agent actually doing work in a live sandbox. The value is written once per session and is available on all session read APIs; setup commands run by the platform itself (skill loading, repo checkout) do not count. ([#21211](https://github.com/mastra-ai/mastra/pull/21211))

- Added a `firstMessageAt` timestamp to Factory source-control sessions. The session's first agent run now records when the first message reached the agent, so session listings and latency reporting can measure time-to-first-response from the real conversation start instead of the session's creation time (which can be long before the user sends anything). The value is returned on session objects from the source-control sessions API and is write-once: later messages never move it. ([#21206](https://github.com/mastra-ai/mastra/pull/21206))

### Patch Changes

- Fixed Slack threads on cloud factory deployments falling back to chat-only sessions or erroring instead of getting a repo-backed workspace. ([#21217](https://github.com/mastra-ai/mastra/pull/21217))

  - Fixed repository resolution failing when a factory project carries a stale source-control connection (for example after a GitHub App reinstall deleted the old installation but left its connection behind). Resolution now tries every connection and skips the ones that no longer resolve.
  - Fixed chat-only sessions on deployments configured with a remote sandbox replying with "A Factory session ID is required to create a remote sandbox workspace" on every message. These sessions now run without a workspace, so workspace tools are simply not registered and the server host never executes commands for them.
  - Fixed top-level DM and channel conversations (threads with no thread timestamp) failing their clone with the invalid git ref `slack/`. Their session branch now derives from the channel id.

- Fixed the sign-in callback redirecting straight back to the identity provider in a loop when it denies access (for example access_denied for an account that is not part of the organization). The denial now lands on the sign-in page with the error shown. ([#21166](https://github.com/mastra-ai/mastra/pull/21166))

- Slow workspace opens can now be diagnosed directly from server logs. Added `[factory:timing]` log lines for each phase of the sandbox session-open path — `sandbox.reattach`, `sandbox.provision`, `workspace.materialize`, and `workspace.checkout` — so you can see exactly which phase is slow instead of reconstructing timings by hand. ([#21194](https://github.com/mastra-ai/mastra/pull/21194))

- Added a `command_exit` session event to the agent controller. Subscribers now receive the exit code and success flag of each foreground `execute_command` tool call, alongside the existing `shell_output` stream: ([#21211](https://github.com/mastra-ai/mastra/pull/21211))

  ```typescript
  session.subscribe(event => {
    if (event.type === 'command_exit') {
      console.log(event.toolCallId, event.exitCode, event.success);
    }
  });
  ```

  Previously the exit outcome was only visible inside the tool result text, so observers could stream a command's output but never tell whether it succeeded.

- Updated dependencies [[`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`d6c56f9`](https://github.com/mastra-ai/mastra/commit/d6c56f951db3213330b98b0abafa9778c8770e58), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`a04d1a6`](https://github.com/mastra-ai/mastra/commit/a04d1a642ccae3ea3b28be37067480d49bcb1b7d), [`acc3513`](https://github.com/mastra-ai/mastra/commit/acc3513b19f79bf0a7ec2998694580edca54086c), [`94e7ae9`](https://github.com/mastra-ai/mastra/commit/94e7ae970b37c888cd1244ef013292639a2fe6d1), [`6a667b4`](https://github.com/mastra-ai/mastra/commit/6a667b4b7cd6a93fe41fcdd357b08c5a8c09b9ab), [`2440e09`](https://github.com/mastra-ai/mastra/commit/2440e096ea6c2def1ccc1eb2d0f3f5b88c4af940), [`a59049b`](https://github.com/mastra-ai/mastra/commit/a59049b1652a13efff66ac826326b5ed9a550342)]:
  - @mastra/core@1.58.0-alpha.13
  - @mastra/code-sdk@1.2.0-alpha.15

## 0.6.0-alpha.15

### Patch Changes

- Updated dependencies [[`72ce266`](https://github.com/mastra-ai/mastra/commit/72ce2669506e755c0bbe73baf3a7e8ea5208bdad)]:
  - @mastra/code-sdk@1.2.0-alpha.14

## 0.6.0-alpha.14

### Patch Changes

- Updated dependencies [[`2e4624e`](https://github.com/mastra-ai/mastra/commit/2e4624edb6917e61249cb60ee377735e7af7e4a9), [`2e4624e`](https://github.com/mastra-ai/mastra/commit/2e4624edb6917e61249cb60ee377735e7af7e4a9), [`e6534fa`](https://github.com/mastra-ai/mastra/commit/e6534fab031216f6cb48c4c9907cbfdce9d60bc6), [`7fdcaa6`](https://github.com/mastra-ai/mastra/commit/7fdcaa66105d64290f9b14432a12ec99f39c4d3a), [`cfd0d9e`](https://github.com/mastra-ai/mastra/commit/cfd0d9ec77ec3c69dd96f79cdb579e03d79f22ce), [`d9d93b2`](https://github.com/mastra-ai/mastra/commit/d9d93b25e4a65ad5fa153fa35be7ed149c8d587f)]:
  - @mastra/core@1.58.0-alpha.12
  - @mastra/code-sdk@1.2.0-alpha.13

## 0.6.0-alpha.13

### Patch Changes

- Updated dependencies [[`b8ce7ec`](https://github.com/mastra-ai/mastra/commit/b8ce7ec96e39343c6c2f36d12d68a9ad816c09f7), [`a3a3624`](https://github.com/mastra-ai/mastra/commit/a3a3624f646b98e409424d8defccbd334da9e8b8), [`6246914`](https://github.com/mastra-ai/mastra/commit/62469146636911f3cbbe0880bd011c6a897a59a7), [`3f73c07`](https://github.com/mastra-ai/mastra/commit/3f73c076727e8c36b4fff7a1b40290fb68957fa8), [`7c1ebb1`](https://github.com/mastra-ai/mastra/commit/7c1ebb15690c4b3f0eabb19077cf8af573311e57), [`1315d8f`](https://github.com/mastra-ai/mastra/commit/1315d8f17e8e7acb61cca46b72a1d42f6d00d289), [`32980a3`](https://github.com/mastra-ai/mastra/commit/32980a3e2413d0274ac244d32c37d910edc13f00), [`4bcdfaf`](https://github.com/mastra-ai/mastra/commit/4bcdfaf0eac3199d7cb171b0a19a92c9c341eea4), [`af4636a`](https://github.com/mastra-ai/mastra/commit/af4636a74463275d71c1d13a38f7d2b738f128bf), [`a463cdf`](https://github.com/mastra-ai/mastra/commit/a463cdf1c95c3059e70f0bff27959e8558bb899d), [`0ea6b80`](https://github.com/mastra-ai/mastra/commit/0ea6b8001408ce02b56e8be0536b0fd8cbaf8ad2)]:
  - @mastra/core@1.58.0-alpha.11
  - @mastra/code-sdk@1.2.0-alpha.12

## 0.6.0-alpha.12

### Patch Changes

- Updated dependencies [[`66bbfb5`](https://github.com/mastra-ai/mastra/commit/66bbfb5f05b473d39f88c0e4a481ccac41634f3a)]:
  - @mastra/core@1.58.0-alpha.10
  - @mastra/code-sdk@1.2.0-alpha.11

## 0.6.0-alpha.11

### Patch Changes

- Updated dependencies [[`86b7b77`](https://github.com/mastra-ai/mastra/commit/86b7b777980d30f66e1fd134a37d2af4c22e54cc), [`80a3324`](https://github.com/mastra-ai/mastra/commit/80a33245d3110204de6f56d61211523ffe338692), [`d9d2881`](https://github.com/mastra-ai/mastra/commit/d9d2881ede6dd6c023d144215fc812062aed0890), [`82e3365`](https://github.com/mastra-ai/mastra/commit/82e3365ef7c9bf7bee2e7a7029035ea262d68895), [`1b482c2`](https://github.com/mastra-ai/mastra/commit/1b482c2d89244dd758c41e5f927a2b44041388d2), [`e6a2860`](https://github.com/mastra-ai/mastra/commit/e6a2860649cc51f87d32d78b766ae2126446ba07), [`7bd85ea`](https://github.com/mastra-ai/mastra/commit/7bd85ea7588b71c25ce9f4019c88f8539be5dcbc), [`833432b`](https://github.com/mastra-ai/mastra/commit/833432b92612b7f122aa7342132ea37f2ad96e77)]:
  - @mastra/core@1.58.0-alpha.9
  - @mastra/code-sdk@1.2.0-alpha.10

## 0.6.0-alpha.10

### Patch Changes

- Updated dependencies [[`1c75e32`](https://github.com/mastra-ai/mastra/commit/1c75e32f7fc0b9fb6f548b4407feaec8a1440212), [`c47165c`](https://github.com/mastra-ai/mastra/commit/c47165c983c87594c6952f1fd2fa51a90205034c), [`e08e789`](https://github.com/mastra-ai/mastra/commit/e08e789c1bf4cd2fe46363f7a4728536ceccc9bd), [`35cc901`](https://github.com/mastra-ai/mastra/commit/35cc90102cf834a84827acaf9eee0b6d6d1e2a3b), [`a8b4cf0`](https://github.com/mastra-ai/mastra/commit/a8b4cf02823cffebc4751a53337dfacf097c1ae1), [`f33264f`](https://github.com/mastra-ai/mastra/commit/f33264f517ae603279afd5c4251e2b40f6dd3618), [`689f2c4`](https://github.com/mastra-ai/mastra/commit/689f2c4b6c0835fe455702b01d21daa8abcd9331), [`eeae63e`](https://github.com/mastra-ai/mastra/commit/eeae63e7fbe8e1f237adc69bca6e2ac13c5ca907), [`4c186a0`](https://github.com/mastra-ai/mastra/commit/4c186a017275f45e6ed4c09de0f89550e2d09e8c), [`b0fa077`](https://github.com/mastra-ai/mastra/commit/b0fa077bcbc9b08551846fe372a0d3d15b71ed72)]:
  - @mastra/core@1.58.0-alpha.8
  - @mastra/code-sdk@1.2.0-alpha.9

## 0.6.0-alpha.9

### Patch Changes

- Fixed Factory review sessions losing caller identity when an existing request context is empty. ([#21055](https://github.com/mastra-ai/mastra/pull/21055))

- Updated dependencies [[`7fb580a`](https://github.com/mastra-ai/mastra/commit/7fb580ac73fbcacf2ff00872a3395f73ae1b9fa5), [`333785c`](https://github.com/mastra-ai/mastra/commit/333785c93cbb01e42c60167e995457c28897ddbf), [`2eabc09`](https://github.com/mastra-ai/mastra/commit/2eabc097d86d52fbd0123da36a7c874154cc384f), [`83fa004`](https://github.com/mastra-ai/mastra/commit/83fa0044bfda8b703a83883dbd8bef204844d13f)]:
  - @mastra/core@1.58.0-alpha.7
  - @mastra/code-sdk@1.2.0-alpha.8

## 0.6.0-alpha.8

### Patch Changes

- Fixed Factory intake saves when generated clients include disabled defaults for integrations that are not configured. ([#21019](https://github.com/mastra-ai/mastra/pull/21019))

- Fixed reused Factory workspaces retaining GitHub credentials from an outdated work or review assignment. ([#21035](https://github.com/mastra-ai/mastra/pull/21035))

## 0.6.0-alpha.7

### Patch Changes

- Fixed Factory sessions rejecting signed-in users when session-based authentication providers store the user and active organization in a wrapped session shape. Workspace ownership checks and GitHub session tools now recognize both flat and session-wrapped authenticated users. ([#21008](https://github.com/mastra-ai/mastra/pull/21008))

- Updated dependencies [[`f59032a`](https://github.com/mastra-ai/mastra/commit/f59032a73699443555a08a479e7ac578975784f2), [`f59032a`](https://github.com/mastra-ai/mastra/commit/f59032a73699443555a08a479e7ac578975784f2), [`3e50f63`](https://github.com/mastra-ai/mastra/commit/3e50f63db85e9fe365b4ce5daecb0ac0dc464d93), [`bf936e2`](https://github.com/mastra-ai/mastra/commit/bf936e2c89b2ff0dad5695b873ddc009ba96d41e)]:
  - @mastra/code-sdk@1.2.0-alpha.7
  - @mastra/core@1.58.0-alpha.6

## 0.6.0-alpha.6

### Patch Changes

- Updated dependencies [[`25956fc`](https://github.com/mastra-ai/mastra/commit/25956fc8841780d506acb22b618fdb4dcf6c4e21)]:
  - @mastra/code-sdk@1.2.0-alpha.6

## 0.6.0-alpha.5

### Patch Changes

- Updated dependencies [[`6445eba`](https://github.com/mastra-ai/mastra/commit/6445eba6020abac681aba1cc9289f446cb400cbe), [`df31eb0`](https://github.com/mastra-ai/mastra/commit/df31eb0c7087d782a0d9346e467f9a4af4b0eef6), [`fcd0667`](https://github.com/mastra-ai/mastra/commit/fcd0667a4e378be35c9a1b1eb19cce78fbfd7282), [`bab06b1`](https://github.com/mastra-ai/mastra/commit/bab06b18923873a584bdfc71a6b4ec7fb4727fb7)]:
  - @mastra/core@1.58.0-alpha.5
  - @mastra/code-sdk@1.2.0-alpha.5

## 0.6.0-alpha.4

### Patch Changes

- Updated dependencies [[`76e5132`](https://github.com/mastra-ai/mastra/commit/76e51328dbc0749c8304e6b3f21e4401f451b081), [`0282e16`](https://github.com/mastra-ai/mastra/commit/0282e16115538c8e9b248b90f0748eb01cb5dc98), [`0282e16`](https://github.com/mastra-ai/mastra/commit/0282e16115538c8e9b248b90f0748eb01cb5dc98)]:
  - @mastra/core@1.58.0-alpha.4
  - @mastra/slack@1.6.1-alpha.0
  - @mastra/code-sdk@1.2.0-alpha.4

## 0.6.0-alpha.3

### Minor Changes

- Add a reasoning-effort configuration surface across mastracode and Factory (fixes #20766): ([#20884](https://github.com/mastra-ai/mastra/pull/20884))

  - New `max` thinking level (mapped to `reasoning effort: max` for OpenAI Codex and Anthropic `effort`).
  - Anthropic extended-thinking wiring: the session thinking level now applies to anthropic/claude-opus-4-7 and other Anthropic models via provider thinking/effort options (previously OpenAI-only).
  - New `models.modeThinkingDefaults` setting: per-mode (build/plan/fast) default thinking levels, resolved at request time with precedence session override → mode default → global `preferences.thinkingLevel`. Configuration changes now apply to the next request of every session, including automated Factory runs.
  - Factory: new Settings → Defaults controls for editing global and per-mode thinking defaults in local deployments.
  - TUI: `/think` now sets a session-only override, supports `/think default` to clear it, and `/think status` reports the effective level with provenance (session override / mode default / global default).

  Example `settings.json` configuration:

  ```json
  {
    "preferences": { "thinkingLevel": "medium" },
    "models": {
      "modeThinkingDefaults": {
        "build": "high",
        "plan": "max",
        "fast": "off"
      }
    }
  }
  ```

- Added persisted workspace file lists for Factory threads. The Files view now keeps a thread's captured file list available after an agent run while file contents continue to load from its live sandbox. ([#20937](https://github.com/mastra-ai/mastra/pull/20937))

- Added label reconciliation and label filtering to Factory work and review boards. GitHub pull requests, GitHub issues, and Linear issues now keep their labels in sync with the provider, and boards expose a searchable multi-select label filter that shares state through the URL. ([#20845](https://github.com/mastra-ai/mastra/pull/20845))

  Selected labels round-trip through the `label` query parameter (repeated per label to preserve values containing commas):

  ```
  /factory/project/<id>/work?label=bug&label=needs%20triage
  /factory/project/<id>/review?teammate=<userId>&label=priority%3Ap0
  ```

- Added automatic GitHub and Linear issue reconciliation so Factory work items stay current when provider metadata changes outside Factory. Platform Linear now tails the Platform event stream and folds a periodic reconcile sweep in on its own cadence, so Issue updates flow into Factory through the normal rules pipeline without waiting for the next board poll. ([#20845](https://github.com/mastra-ai/mastra/pull/20845))

  GitHub issue reconciliation runs inside the same worker as the pull-request reconciler (both self-hosted and Platform), sharing the same lease, cadence, and configured-repository target set. That means one sweep per repository per interval covers both writers of card state.

  Reconciliation is on by default. Disable or tune it with environment variables on the Factory server:

  ```bash
  # Turn Linear reconciliation off entirely.
  MASTRACODE_LINEAR_RECONCILE_ENABLED=false

  # Slow the Linear reconcile sweep down (default: 5 minutes).
  MASTRACODE_LINEAR_RECONCILE_INTERVAL_MS=600000

  # Stop Platform Linear from tailing the event stream; the reconcile sweep still runs.
  MASTRACODE_PLATFORM_LINEAR_POLLING_ENABLED=false

  # GitHub reconciliation uses the same shape.
  MASTRACODE_GITHUB_RECONCILE_ENABLED=false
  MASTRACODE_GITHUB_RECONCILE_INTERVAL_MS=600000
  ```

### Patch Changes

- Fixed workspace re-open hard-failing when a session branch was auto-deleted after merge. `git pull` messages like "no such ref was fetched" and "couldn't find remote ref" are now treated as benign, so materialization keeps the checkout as-is instead of leaving permanent rule-effect alerts on Done items. ([#20910](https://github.com/mastra-ai/mastra/pull/20910))

- Added `dispatcher.maxInFlight` to `MastraFactoryConfig` and the `MASTRACODE_DISPATCH_MAX_IN_FLIGHT` deployment setting to configure the maximum number of concurrent Factory background dispatches per replica. ([#20903](https://github.com/mastra-ai/mastra/pull/20903))

  ```sh
  export MASTRACODE_DISPATCH_MAX_IN_FLIGHT=10
  ```

- Make factory review sessions survive server restarts, dropped connections, and strict git configs. ([#20899](https://github.com/mastra-ai/mastra/pull/20899))

  - Crash-resumed sessions recover their run binding and untrusted-checkout posture from the binding table instead of silently losing the transition tool.
  - Overly long transition rationales are clamped instead of failing the run.
  - Clones and pulls retry when the transfer to github.com drops partway through.
  - Checkouts with `pull.rebase` set no longer fail workspace materialization.

- Improved Factory issue investigations with structured summaries and GitHub triage-label updates. ([#20988](https://github.com/mastra-ai/mastra/pull/20988))

- Hardened the GitHub reconcile worker, the Platform Linear event worker, and the shared issue reconciler: ([#20845](https://github.com/mastra-ai/mastra/pull/20845))

  - Platform Linear Issue events now only dispatch to `(orgId, factoryProjectId)` pairs that already have a persisted work item for the incoming Linear issue. Previously the worker fanned an event out to every Factory project regardless of tenant, which could materialize a triage card in an unrelated org via the default `linearIssueObserved` rule.
  - Reconciler metadata patches no longer spread `undefined` values over stored fields, so a live issue that omits (for example) an author does not clobber the previously recorded value.
  - Documented the event worker's at-most-once delivery contract explicitly: the cursor advances past a failing ingest and drift is caught by the folded reconciler sweep on its own cadence.
  - `GithubReconcileWorker` now renews its lease while a sweep is in flight, so folding the issue sweep into the same tick can no longer let the lease expire and hand off to a replica mid-sweep. A `renewLease` result of `false` or a renewal error is treated as lease loss: the worker aborts before running the folded issue sweep and skips `releaseLease` so the new owner's TTL is not disturbed.
  - The Platform Linear event worker no longer calls `listWorkspaces` in reconcile-only mode, so a workspace-listing outage cannot block the reconcile sweep.
  - The Platform Linear event worker now resolves the project list once per event page rather than once per event, avoiding up to `EVENT_PAGE_SIZE` × N project scans per poll cycle.

- Updated dependencies [[`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`d7cf7fa`](https://github.com/mastra-ai/mastra/commit/d7cf7fafc1ae1b50bd8462dd0e6c671a8606db93), [`0f9a448`](https://github.com/mastra-ai/mastra/commit/0f9a448502157e59f7b76f24360ad497168f5ef8), [`289f4ce`](https://github.com/mastra-ai/mastra/commit/289f4ce16e3293370440172132c52ee787cbc09f), [`4f16ff8`](https://github.com/mastra-ai/mastra/commit/4f16ff824bf2f9b0ddc93f210477c10c8a4fb1ab), [`1c67d85`](https://github.com/mastra-ai/mastra/commit/1c67d85e9da8285662f4dbbf47e0378c3fee0747), [`ba24be6`](https://github.com/mastra-ai/mastra/commit/ba24be662439c331ab23a600041f93803c89eca8), [`842b5fe`](https://github.com/mastra-ai/mastra/commit/842b5fe22b6a7fa811bd14e48eb9af523ac989f2), [`80bdf3a`](https://github.com/mastra-ai/mastra/commit/80bdf3ae16ade6ff63bde0cb16fa2df8ab7dd4dd), [`9ba1247`](https://github.com/mastra-ai/mastra/commit/9ba12470c77f1c03642d720ce67e517e878f666e), [`fd96298`](https://github.com/mastra-ai/mastra/commit/fd96298a8367622f4ebfcaa97b5b6c1fbbd14564), [`6a84954`](https://github.com/mastra-ai/mastra/commit/6a84954a2667f85b6d59da652dab1bbff007ccb0), [`52d8ef0`](https://github.com/mastra-ai/mastra/commit/52d8ef03801f1deb7ee48532fc4190dd4a33916c), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`87db0e4`](https://github.com/mastra-ai/mastra/commit/87db0e49a8c04030eb74fff7f051fac330678839), [`efd5c81`](https://github.com/mastra-ai/mastra/commit/efd5c81cc25fde3c2ddd86fc1178deb4ec176e19), [`0976933`](https://github.com/mastra-ai/mastra/commit/0976933142333ec78451feef265b68bcb45aa5e7), [`242b945`](https://github.com/mastra-ai/mastra/commit/242b94558777bfbdeb42cbfea84afff0b6ad0633), [`fea5cae`](https://github.com/mastra-ai/mastra/commit/fea5caedc7e2cfea51784a15e015952692027abf), [`4b59f78`](https://github.com/mastra-ai/mastra/commit/4b59f786cbc9a7d1ef07a07517dbd4b96865e99d), [`7010c5d`](https://github.com/mastra-ai/mastra/commit/7010c5d15728bf9c5dfe4fb6b1bf80ce23bf143a)]:
  - @mastra/core@1.58.0-alpha.3
  - @mastra/code-sdk@1.2.0-alpha.3

## 0.6.0-alpha.2

### Minor Changes

- Added stable identities and display titles for Factory user sessions. ([#20781](https://github.com/mastra-ai/mastra/pull/20781))

  `POST /web/github/projects/:id/sessions` now accepts optional `sessionId` and `title` fields. When `branch` is omitted, the session uses `user/session-<sessionId>`. Callers can create a client-side draft, safely retry the first server request with the same UUID, and show the first prompt as a human-readable title. If `sessionId` is omitted, the server generates one. Explicit branches still work unchanged.

  ```ts
  const sessionId = crypto.randomUUID();
  const response = await fetch(`/web/github/projects/${projectRepositoryId}/sessions`, {
    method: 'POST',
    body: JSON.stringify({ sessionId, title: 'Fix the login flow' }),
  });
  ```

  Titles collapse whitespace, trim surrounding space, and are limited to 80 characters. Blank titles are stored as `null`.

### Patch Changes

- Work board cards now follow their GitHub issue when it closes: closing an issue moves its card to Done (or to Canceled when the issue was closed as `not_planned` or `duplicate`), and a card whose issue closed while the deployment was unreachable is caught up automatically by the periodic reconcile sweep. Previously these cards stayed on the board until moved by hand. ([#20895](https://github.com/mastra-ai/mastra/pull/20895))

- Updated dependencies [[`b4c89b4`](https://github.com/mastra-ai/mastra/commit/b4c89b4371b0c86da57403ad1a3b3ef0681f3128), [`e44e8f3`](https://github.com/mastra-ai/mastra/commit/e44e8f370b66c339ddcaba946d33da6d3c3f06cd), [`c967a5e`](https://github.com/mastra-ai/mastra/commit/c967a5eec150c5dc5418c4a4388982d1fb7ad27c), [`f53d5bd`](https://github.com/mastra-ai/mastra/commit/f53d5bd4885b29e4ac29a428a6044088ea8d6aa3), [`bda2235`](https://github.com/mastra-ai/mastra/commit/bda22353ee28f2df0eaea555f7cae1549f979c0b), [`a7eb4a1`](https://github.com/mastra-ai/mastra/commit/a7eb4a11450f6170274ed5141bffe821d4fdd5a6), [`2f9ef3f`](https://github.com/mastra-ai/mastra/commit/2f9ef3f4ca06fc2dcdd5088c26b7f4da6a016791), [`e7eefcb`](https://github.com/mastra-ai/mastra/commit/e7eefcb162cda7c493e8c3bf43050ead0efbcb2c), [`4d7aca2`](https://github.com/mastra-ai/mastra/commit/4d7aca2fe75f225c83d1502d63079568e6ec163f), [`c4ec889`](https://github.com/mastra-ai/mastra/commit/c4ec889561c0264c43f66d04d587bee4ce35e792), [`9be8878`](https://github.com/mastra-ai/mastra/commit/9be8878dcf0388e84fc4873e0eec27bd49b881a4)]:
  - @mastra/core@1.58.0-alpha.2
  - @mastra/code-sdk@1.2.0-alpha.2

## 0.6.0-alpha.1

### Minor Changes

- Added creator and recent worker attribution to Factory board cards, with names and profile images from GitHub and Linear. GitHub pull request cards now show the author and draft, open, closed, or merged status. ([#20822](https://github.com/mastra-ai/mastra/pull/20822))

- Added searchable, resettable teammate and relevance filters to Factory work and review boards. Filter state can be shared by URL, and matching covers GitHub and Linear authors, assignees, activity, and requested reviewers. ([#20841](https://github.com/mastra-ai/mastra/pull/20841))

  Example shareable URL: `/factory/projects/<id>/board?teammate=github:octocat&relevance=authored,assigned`.

- The Factory now re-reviews a pull request when review is re-requested from its GitHub bot. After any Factory verdict (approve or request changes), clicking GitHub's re-request review button on the Factory reviewer moves the Review card back into Reviewing and starts a fresh review pass. Only trusted collaborators (write or admin) can trigger it, and re-requests aimed at human reviewers or on closed, merged, or already-in-review pull requests are ignored. ([#20830](https://github.com/mastra-ai/mastra/pull/20830))

### Patch Changes

- Fixed Linear issue investigations using inconsistent metadata, failing to start, or resolving a stale work item binding after the same session was rebound. ([#20810](https://github.com/mastra-ai/mastra/pull/20810))

- Fixed autonomous GitHub factory-rule runs ignoring the factory's configured default model. ([#20827](https://github.com/mastra-ai/mastra/pull/20827))

  A run triggered by a factory rule started on the built-in default model rather than the model configured on the factory project, so a factory set up for a provider other than the built-in default failed the run outright with a missing-credentials error. Runs started from the board were unaffected, which is why this only appeared on autonomous runs. Rule-triggered runs now start on the project's configured model, matching runs started from the board.

- Return from deleting a workspace as soon as its session is gone instead of holding the request open while the sandbox is reclaimed. Waking the VM and scrubbing its checkout took minutes on a large repository, so the UI appeared to hang long after the workspace had been removed. The scrub and pool release now run in the background; because a sandbox only becomes claimable once it is published to the reuse pool, the next session still gets a clean checkout. ([#20785](https://github.com/mastra-ai/mastra/pull/20785))

- Fixed Slack sessions ignoring the factory's configured default model and memory settings. ([#20832](https://github.com/mastra-ai/mastra/pull/20832))

  Sessions started from Slack ran on the built-in default model rather than the model configured on the factory project, so a factory set up for a provider other than the built-in default failed every Slack message with a missing-credentials error. Repo-backed Slack threads now start on the project's configured model and observational-memory settings, matching runs started from the web.

  A thread keeps a model chosen inside it. Once a model is set on the thread, restarting the server no longer resets it to the project default.

- Preserved every GitHub issue assignee end-to-end so Factory boards no longer drop co-assignees, and backfilled missing assignee and reviewer metadata so the pull request reconciler stops re-fetching cards on every sweep. ([#20841](https://github.com/mastra-ai/mastra/pull/20841))

- Updated dependencies [[`e7109ee`](https://github.com/mastra-ai/mastra/commit/e7109ee6f731bacc79c885906f3c7dca8d8f013a), [`ae0e985`](https://github.com/mastra-ai/mastra/commit/ae0e985e8f1186a8ecfcf0de6dd36ac12ef85324), [`e7109ee`](https://github.com/mastra-ai/mastra/commit/e7109ee6f731bacc79c885906f3c7dca8d8f013a), [`772c0c8`](https://github.com/mastra-ai/mastra/commit/772c0c897cec383258de2e6178147f8014767c7b), [`578bf2e`](https://github.com/mastra-ai/mastra/commit/578bf2e6a88e9d5b8bf502204e15a95dfbb679ae), [`06b2d87`](https://github.com/mastra-ai/mastra/commit/06b2d87e63bcdd0ed59215c6789692b9b12de376), [`ac01d63`](https://github.com/mastra-ai/mastra/commit/ac01d6355974aec73fdb8781449ed12bac582094), [`a810a05`](https://github.com/mastra-ai/mastra/commit/a810a058f62ad407cfc1701e0be36ae91145d7cf), [`f8da216`](https://github.com/mastra-ai/mastra/commit/f8da21633e7eb0e31c9ce0fc30567870d19416d3), [`6104347`](https://github.com/mastra-ai/mastra/commit/61043473ba6bfd0a25156824e853e13165562e6c), [`0ce1d05`](https://github.com/mastra-ai/mastra/commit/0ce1d054586c5d348543d2749067b40adbc9b783), [`6698e16`](https://github.com/mastra-ai/mastra/commit/6698e168d74e054fc3efa97b19025fb2d1dafc45), [`45bfb88`](https://github.com/mastra-ai/mastra/commit/45bfb88fd52f1dd3be20e2a38905777c96499c90), [`e3b9307`](https://github.com/mastra-ai/mastra/commit/e3b9307098daefbfae2a52ae2ef51bc9fc701190), [`d6834c5`](https://github.com/mastra-ai/mastra/commit/d6834c5a7866b16734d23900163c2414ed70d791), [`c52d346`](https://github.com/mastra-ai/mastra/commit/c52d3462ec831a5d95926ecd3d3373f5928ad2e5), [`0023e79`](https://github.com/mastra-ai/mastra/commit/0023e7919431078280abd11c89d1edeae35fcc69), [`c2ad51e`](https://github.com/mastra-ai/mastra/commit/c2ad51e2467f901eecba8c9f4a45e22a50bd7c18), [`3dc97ea`](https://github.com/mastra-ai/mastra/commit/3dc97ea415fad353b48a13095fad1835933cc12a), [`3d01cd3`](https://github.com/mastra-ai/mastra/commit/3d01cd387321b6f9c5cac31d487c84bf51b19c78), [`7bf3086`](https://github.com/mastra-ai/mastra/commit/7bf308663f0115ca74ad20554ade740f06640859), [`a8dd139`](https://github.com/mastra-ai/mastra/commit/a8dd1391a9fe9a6632c25809ef236980afa9a020), [`e5786be`](https://github.com/mastra-ai/mastra/commit/e5786be02bb903073082bd9d6da880ebaacc343f), [`2093fbd`](https://github.com/mastra-ai/mastra/commit/2093fbd53bb744bae19ec89f6d73db9a66fbe8a7), [`e7a5da4`](https://github.com/mastra-ai/mastra/commit/e7a5da4ef8e4dd452d2f232961b4e682a85ffe43), [`7b4393d`](https://github.com/mastra-ai/mastra/commit/7b4393d557411fdcf07b0e30e5acaf7cc85154ae)]:
  - @mastra/code-sdk@1.2.0-alpha.1
  - @mastra/core@1.58.0-alpha.1

## 0.5.1-alpha.0

### Patch Changes

- Updated dependencies [[`45a9147`](https://github.com/mastra-ai/mastra/commit/45a914741f578754d79d8b7de7b4e4f304d8e14a), [`990611b`](https://github.com/mastra-ai/mastra/commit/990611ba76eb876d86c9c594371ae5f02f94b432), [`ed5d606`](https://github.com/mastra-ai/mastra/commit/ed5d606739c5e3fbdfa9f272df7809aa5ab43b1d)]:
  - @mastra/core@1.58.0-alpha.0
  - @mastra/code-sdk@1.1.4-alpha.0

## 0.5.0

### Minor Changes

- Added a built-in Slack integration, so every factory and create-factory deployment can offer Slack channels without vendoring the integration itself. Register it alongside the built-in GitHub and Linear integrations: ([#20507](https://github.com/mastra-ai/mastra/pull/20507))

  ```ts
  import { SlackIntegration } from '@mastra/factory/integrations/slack/integration';

  new MastraFactory({
    integrations: [new SlackIntegration({ signingSecret, botToken, clientId, clientSecret })],
  });
  ```

  Slack-started sessions are repo-backed automatically: the factory exposes its source-control owner on `IntegrationContext` (`ctx.storage.sourceControlOwner`) and the integration wires itself up from there.

  Two related changes come with it. `FactoryIntegration.channels()` now returns a config object (`FactoryChannelsConfig`) instead of a built `AgentControllerChannels` instance, and the factory constructs the instance at the attach site. And when no Slack integration is registered, the factory answers `GET /web/channel-accounts` with `{ accounts: [], canConnect: false, reason: 'not_registered' }`, so the Connections UI can say Slack is not set up instead of telling you to set environment variables that would not enable it.

### Patch Changes

- Fixed Factory sessions that stopped responding after a server restart. GitHub webhook deliveries now restore the saved session owner when they rebuild a session, so the delivery goes through and the session picks up where it left off. ([#20698](https://github.com/mastra-ai/mastra/pull/20698))

- Updated dependencies [[`8d2399b`](https://github.com/mastra-ai/mastra/commit/8d2399b638f8e0945cf2cda0187dbea8dcf0b784), [`8d2399b`](https://github.com/mastra-ai/mastra/commit/8d2399b638f8e0945cf2cda0187dbea8dcf0b784), [`c8002da`](https://github.com/mastra-ai/mastra/commit/c8002da7775c468e2965b6ff5f82045450fa8cb9), [`92be47f`](https://github.com/mastra-ai/mastra/commit/92be47fbd26ffccec0e2131ef7c1d9e70dd5ef4a), [`89200ba`](https://github.com/mastra-ai/mastra/commit/89200bafa05444bb7949b363ce7b743e29867561), [`c950138`](https://github.com/mastra-ai/mastra/commit/c950138e72e4f317a40187e3800588731ab790ce), [`810c7e7`](https://github.com/mastra-ai/mastra/commit/810c7e74929989d8b8b5db52cd3af22cd0998af4), [`063c8b2`](https://github.com/mastra-ai/mastra/commit/063c8b2eb14e4e5ca021779bc33e8c3c031c8604), [`f9f9884`](https://github.com/mastra-ai/mastra/commit/f9f98848ee194dc71a787a709ec430b065cdc41b), [`e0904dc`](https://github.com/mastra-ai/mastra/commit/e0904dc538792e54e1806b70172e5900ac49bff4), [`9672fab`](https://github.com/mastra-ai/mastra/commit/9672fabfbcadb961a35c22a2d6722e077f7b24b9), [`f4e964c`](https://github.com/mastra-ai/mastra/commit/f4e964cad57057301d6bed5c55bcdd730175b941), [`1f7bbd7`](https://github.com/mastra-ai/mastra/commit/1f7bbd7785a8d230aad02454ecabeb4a0b2cc96f), [`e47ff36`](https://github.com/mastra-ai/mastra/commit/e47ff36945720f4ee4caa09f6e83514d7d188608), [`64d6781`](https://github.com/mastra-ai/mastra/commit/64d67814bccddd314f7e09643243821e57cb87b6), [`fb9a6ac`](https://github.com/mastra-ai/mastra/commit/fb9a6ac11c9560518742ece60b49d6b062845fd3), [`aa2cec8`](https://github.com/mastra-ai/mastra/commit/aa2cec8501f634d51c2f3ebfb3dd3aa7af8d2ca2), [`c848e65`](https://github.com/mastra-ai/mastra/commit/c848e655a64ff10331a8ceafafe7f18e70a0f092), [`2adf8eb`](https://github.com/mastra-ai/mastra/commit/2adf8eb4a70ed2b6cff2dd39281496ea0e025fac), [`0494489`](https://github.com/mastra-ai/mastra/commit/049448906e4c3d2d615bbe865b073a0d890ddb7c), [`8d1aeb8`](https://github.com/mastra-ai/mastra/commit/8d1aeb8acf7c20c4bb8e4d8e4bdc6569c83ac561), [`8264611`](https://github.com/mastra-ai/mastra/commit/8264611510e421b818bc7395dc2ae4d9c2d518b2), [`d8fa243`](https://github.com/mastra-ai/mastra/commit/d8fa2430d21113e330c4e676ac65e1235cf44f81), [`44fc98b`](https://github.com/mastra-ai/mastra/commit/44fc98b9d1242aa87a3ab44bdce9e9f12c44d8c9), [`f933ba3`](https://github.com/mastra-ai/mastra/commit/f933ba32700e1d0bf143311c1a08f88300b840b6), [`83065bf`](https://github.com/mastra-ai/mastra/commit/83065bfee9e47c3c6f09132a9034501f6cfb69cf), [`0f2ef41`](https://github.com/mastra-ai/mastra/commit/0f2ef4118da022e4f30dac4e9856cc3a8c97671c), [`01b162f`](https://github.com/mastra-ai/mastra/commit/01b162fe435295881aa7ea55f1759407ad5175ad)]:
  - @mastra/code-sdk@1.1.3
  - @mastra/core@1.57.0

## 0.5.0-alpha.2

### Patch Changes

- Updated dependencies [[`810c7e7`](https://github.com/mastra-ai/mastra/commit/810c7e74929989d8b8b5db52cd3af22cd0998af4), [`f9f9884`](https://github.com/mastra-ai/mastra/commit/f9f98848ee194dc71a787a709ec430b065cdc41b), [`e0904dc`](https://github.com/mastra-ai/mastra/commit/e0904dc538792e54e1806b70172e5900ac49bff4), [`64d6781`](https://github.com/mastra-ai/mastra/commit/64d67814bccddd314f7e09643243821e57cb87b6), [`c848e65`](https://github.com/mastra-ai/mastra/commit/c848e655a64ff10331a8ceafafe7f18e70a0f092), [`0494489`](https://github.com/mastra-ai/mastra/commit/049448906e4c3d2d615bbe865b073a0d890ddb7c), [`8d1aeb8`](https://github.com/mastra-ai/mastra/commit/8d1aeb8acf7c20c4bb8e4d8e4bdc6569c83ac561), [`83065bf`](https://github.com/mastra-ai/mastra/commit/83065bfee9e47c3c6f09132a9034501f6cfb69cf), [`01b162f`](https://github.com/mastra-ai/mastra/commit/01b162fe435295881aa7ea55f1759407ad5175ad)]:
  - @mastra/core@1.57.0-alpha.2
  - @mastra/code-sdk@1.1.3-alpha.2

## 0.5.0-alpha.1

### Minor Changes

- Added a built-in Slack integration, so every factory and create-factory deployment can offer Slack channels without vendoring the integration itself. Register it alongside the built-in GitHub and Linear integrations: ([#20507](https://github.com/mastra-ai/mastra/pull/20507))

  ```ts
  import { SlackIntegration } from '@mastra/factory/integrations/slack/integration';

  new MastraFactory({
    integrations: [new SlackIntegration({ signingSecret, botToken, clientId, clientSecret })],
  });
  ```

  Slack-started sessions are repo-backed automatically: the factory exposes its source-control owner on `IntegrationContext` (`ctx.storage.sourceControlOwner`) and the integration wires itself up from there.

  Two related changes come with it. `FactoryIntegration.channels()` now returns a config object (`FactoryChannelsConfig`) instead of a built `AgentControllerChannels` instance, and the factory constructs the instance at the attach site. And when no Slack integration is registered, the factory answers `GET /web/channel-accounts` with `{ accounts: [], canConnect: false, reason: 'not_registered' }`, so the Connections UI can say Slack is not set up instead of telling you to set environment variables that would not enable it.

### Patch Changes

- Fixed Factory sessions that stopped responding after a server restart. GitHub webhook deliveries now restore the saved session owner when they rebuild a session, so the delivery goes through and the session picks up where it left off. ([#20698](https://github.com/mastra-ai/mastra/pull/20698))

- Updated dependencies [[`89200ba`](https://github.com/mastra-ai/mastra/commit/89200bafa05444bb7949b363ce7b743e29867561), [`c950138`](https://github.com/mastra-ai/mastra/commit/c950138e72e4f317a40187e3800588731ab790ce), [`063c8b2`](https://github.com/mastra-ai/mastra/commit/063c8b2eb14e4e5ca021779bc33e8c3c031c8604), [`f4e964c`](https://github.com/mastra-ai/mastra/commit/f4e964cad57057301d6bed5c55bcdd730175b941), [`1f7bbd7`](https://github.com/mastra-ai/mastra/commit/1f7bbd7785a8d230aad02454ecabeb4a0b2cc96f), [`e47ff36`](https://github.com/mastra-ai/mastra/commit/e47ff36945720f4ee4caa09f6e83514d7d188608), [`fb9a6ac`](https://github.com/mastra-ai/mastra/commit/fb9a6ac11c9560518742ece60b49d6b062845fd3), [`aa2cec8`](https://github.com/mastra-ai/mastra/commit/aa2cec8501f634d51c2f3ebfb3dd3aa7af8d2ca2), [`2adf8eb`](https://github.com/mastra-ai/mastra/commit/2adf8eb4a70ed2b6cff2dd39281496ea0e025fac), [`8264611`](https://github.com/mastra-ai/mastra/commit/8264611510e421b818bc7395dc2ae4d9c2d518b2), [`44fc98b`](https://github.com/mastra-ai/mastra/commit/44fc98b9d1242aa87a3ab44bdce9e9f12c44d8c9), [`0f2ef41`](https://github.com/mastra-ai/mastra/commit/0f2ef4118da022e4f30dac4e9856cc3a8c97671c)]:
  - @mastra/core@1.57.0-alpha.1
  - @mastra/code-sdk@1.1.3-alpha.1

## 0.4.1-alpha.0

### Patch Changes

- Updated dependencies [[`c8002da`](https://github.com/mastra-ai/mastra/commit/c8002da7775c468e2965b6ff5f82045450fa8cb9)]:
  - @mastra/core@1.56.1-alpha.0
  - @mastra/code-sdk@1.1.3-alpha.0

## 0.4.0

### Minor Changes

- Added a lightweight pending changes viewer with per-file line counts for Factory session workspaces and improved chat composer readability. ([#20418](https://github.com/mastra-ai/mastra/pull/20418))

### Patch Changes

- Self-hosted GitHub deployments now detect merged pull requests. ([#20361](https://github.com/mastra-ai/mastra/pull/20361))

  Merge state previously reached the factory only through GitHub webhooks. A deployment GitHub cannot reach — local development, or any server behind a private network — never received one, so its pull request cards stayed `open` forever and merge rules never fired.

  A background sweep now reads live pull request state for the cards that are still open and replays missed merges through the normal rules ingress, which dedupes them against the webhook path. Webhooks remain the fast path; this is the safety net that was already running on platform-backed deployments.

  The sweep runs every 5 minutes, is scoped to repositories linked to a factory project, and coordinates across replicas so only one sweeps at a time.

  It also retires the thread's pull request subscription, which the webhook handler was previously the only thing to do. That is what the PR chip in a thread and the workspace sidebar row read, so on both self-hosted and platform deployments they now show merged or closed instead of staying open indefinitely.

  **Configuration**

  ```bash
  MASTRACODE_GITHUB_RECONCILE_ENABLED=false   # opt out entirely
  MASTRACODE_GITHUB_RECONCILE_INTERVAL_MS=60000  # change the cadence
  ```

- Improved Factory triage so editing a linked GitHub issue or creating, editing, or deleting a human comment re-runs investigation and refreshes the existing handoff comment. ([#20516](https://github.com/mastra-ai/mastra/pull/20516))

- Factory work item transitions now require explicit approval before execution. ([#20622](https://github.com/mastra-ai/mastra/pull/20622))

- Fixed Factory rule dispatches so concurrent skill wakeups stay bounded until their agent runs finish or terminal observation times out. ([#20623](https://github.com/mastra-ai/mastra/pull/20623))

- Improved Factory pull-request reviews by requiring comparison with analogous codebase patterns. ([#20524](https://github.com/mastra-ai/mastra/pull/20524))

- Fixed the Factory getting stuck after a GitHub App is uninstalled and reinstalled. ([#20481](https://github.com/mastra-ai/mastra/pull/20481))

  GitHub assigns a new installation ID on reinstall, which left every token request failing against the old one — recovering it needed a manual database edit. The Factory already knew how to repoint a repository at the replacement installation, but only triggered that recovery when the platform reported the old installation as missing (404). A suspended or soft-deleted installation reports as a conflict (409) instead, so the recovery never ran. It now covers both.

  A failed token mint that could equally be a transient GitHub outage (502) still surfaces as an error rather than repointing the repository, so a passing incident never migrates a healthy repository.

- Fixed GitHub issue intake pagination when platform responses contain fewer issues after filtering pull requests. ([#20637](https://github.com/mastra-ai/mastra/pull/20637))

- Fixed factory sessions inheriting the personal agent instructions of the machine hosting them. ([#20633](https://github.com/mastra-ai/mastra/pull/20633))

  A factory should behave the same wherever it runs. It did not: alongside the repository's AGENTS.md and the skill it was started with, every session also loaded the instruction files sitting in the home directory of whatever machine hosted the factory (`~/.claude/CLAUDE.md`, `~/.mastracode/AGENTS.md`, and the other supported home directory locations). Those files are the operator's personal preferences, so the same review rule produced a differently written review depending on who was running the factory, and nothing in the session showed why.

  Factory sessions now read only the repository's instructions (served from the pull request's base branch when the checkout is untrusted) and the skill. This applies to every session the factory creates: work items it picks up on its own, sessions a GitHub webhook resumes, and the ones you open yourself in the factory UI.

  If you were relying on a home directory file to steer factory output, move those instructions into the repository's AGENTS.md.

- Updated Factory triage to keep new features in Intake until manually advanced. ([#20624](https://github.com/mastra-ai/mastra/pull/20624))

- Updated dependencies [[`4844167`](https://github.com/mastra-ai/mastra/commit/4844167cff2d5ec5004e94edd34970833040fa3f), [`c5e56ff`](https://github.com/mastra-ai/mastra/commit/c5e56ff3bcabdf062708f2d48744fec304df6792), [`594f7b2`](https://github.com/mastra-ai/mastra/commit/594f7b28f5263fb9982fd50d95c471fb971ea984), [`7f4e26d`](https://github.com/mastra-ai/mastra/commit/7f4e26dd57bd9b23c278ea21235ab823a3810a6c), [`311f943`](https://github.com/mastra-ai/mastra/commit/311f943bee60e8fdf5c84499ea50e884276c936c), [`322daa6`](https://github.com/mastra-ai/mastra/commit/322daa6d90552909204044790d850958f6745fed), [`db4e6ff`](https://github.com/mastra-ai/mastra/commit/db4e6ff744503112eb64deeaf6c2b54bf26a54c7), [`5faf93f`](https://github.com/mastra-ai/mastra/commit/5faf93f03e19daea394b9e2a923f2e4f833407f2), [`82201f7`](https://github.com/mastra-ai/mastra/commit/82201f75fae8e050a8de2df08b74875ee74c6b83), [`cadaa13`](https://github.com/mastra-ai/mastra/commit/cadaa1372e1077c8e85eb64c5499ba8803caa323), [`0c89896`](https://github.com/mastra-ai/mastra/commit/0c8989673fb7d106837098398131e570c6023b68), [`6d19a65`](https://github.com/mastra-ai/mastra/commit/6d19a6517f5da3911023d446b7e2d5dad8adb1cb), [`23b4238`](https://github.com/mastra-ai/mastra/commit/23b423844ad0bcf2a502a68dd62866d6160f9f6d), [`80ad891`](https://github.com/mastra-ai/mastra/commit/80ad891f8cd10379aa5b5af7510c763783b2ab56), [`fb18da5`](https://github.com/mastra-ai/mastra/commit/fb18da56fc35689ae370621a8f10b5b0d8606e20), [`d01cac8`](https://github.com/mastra-ai/mastra/commit/d01cac87ef674ae6cdd354e15d39525ff9599170), [`fb18da5`](https://github.com/mastra-ai/mastra/commit/fb18da56fc35689ae370621a8f10b5b0d8606e20), [`e320a76`](https://github.com/mastra-ai/mastra/commit/e320a763feaf65c6be3cebecf746defcbde161b3), [`03b4918`](https://github.com/mastra-ai/mastra/commit/03b4918c80d188ce375334c393e131c6e94bd7eb), [`14ef73a`](https://github.com/mastra-ai/mastra/commit/14ef73a4bbd73e7808414816eb0628ce1d80b5d7), [`b582f7f`](https://github.com/mastra-ai/mastra/commit/b582f7fa2f9c1f87d19efc63d344fbe5dda2608c), [`0a6598b`](https://github.com/mastra-ai/mastra/commit/0a6598bde80bde008986ad6616bed9632b9294cb), [`06000d7`](https://github.com/mastra-ai/mastra/commit/06000d73712911572e913b8a83339270296d0a22), [`1d677d5`](https://github.com/mastra-ai/mastra/commit/1d677d5f99d7db403f7828585e8c25f299f72628), [`9e1dad8`](https://github.com/mastra-ai/mastra/commit/9e1dad8f7b1cab2bb7ade90e5b7561f24577b88a), [`2f43145`](https://github.com/mastra-ai/mastra/commit/2f4314504c03cbba280414ac81ba3197448ee6b0), [`4e35a56`](https://github.com/mastra-ai/mastra/commit/4e35a56cdf8d74a5ff6d5eda01f2c1deaf6cc7be), [`d94b8e1`](https://github.com/mastra-ai/mastra/commit/d94b8e1cee67416d518a8c30099040061bef6a1c), [`93e28ec`](https://github.com/mastra-ai/mastra/commit/93e28ecce9031c02397e0ae8406593e5c7a95883), [`729dab4`](https://github.com/mastra-ai/mastra/commit/729dab408faccfaef0cbb048e5a4338f9172847e), [`484003d`](https://github.com/mastra-ai/mastra/commit/484003d33ff59330c86b19863e4a38732d7e4155), [`3de0188`](https://github.com/mastra-ai/mastra/commit/3de0188bfaf9a9c09c95fe322b53838cf52c70b6), [`34d34d8`](https://github.com/mastra-ai/mastra/commit/34d34d8c811df512fef4dd5459f79b7821be1866), [`b582f7f`](https://github.com/mastra-ai/mastra/commit/b582f7fa2f9c1f87d19efc63d344fbe5dda2608c), [`933d291`](https://github.com/mastra-ai/mastra/commit/933d291146b789c19442ad206f94da3e4be90c64), [`a1cb98d`](https://github.com/mastra-ai/mastra/commit/a1cb98d11990b560b98482292a1f34aa1a2d9092), [`598ad82`](https://github.com/mastra-ai/mastra/commit/598ad82d41c41389a686338a1d0e50b7400e1938), [`1fd6aad`](https://github.com/mastra-ai/mastra/commit/1fd6aad1ea4a9d32f65efa832307c35e981a4c0a)]:
  - @mastra/core@1.56.0
  - @mastra/code-sdk@1.1.2

## 0.4.0-alpha.7

### Patch Changes

- Updated dependencies [[`d94b8e1`](https://github.com/mastra-ai/mastra/commit/d94b8e1cee67416d518a8c30099040061bef6a1c)]:
  - @mastra/core@1.56.0-alpha.7
  - @mastra/code-sdk@1.1.2-alpha.7

## 0.4.0-alpha.6

### Patch Changes

- Self-hosted GitHub deployments now detect merged pull requests. ([#20361](https://github.com/mastra-ai/mastra/pull/20361))

  Merge state previously reached the factory only through GitHub webhooks. A deployment GitHub cannot reach — local development, or any server behind a private network — never received one, so its pull request cards stayed `open` forever and merge rules never fired.

  A background sweep now reads live pull request state for the cards that are still open and replays missed merges through the normal rules ingress, which dedupes them against the webhook path. Webhooks remain the fast path; this is the safety net that was already running on platform-backed deployments.

  The sweep runs every 5 minutes, is scoped to repositories linked to a factory project, and coordinates across replicas so only one sweeps at a time.

  It also retires the thread's pull request subscription, which the webhook handler was previously the only thing to do. That is what the PR chip in a thread and the workspace sidebar row read, so on both self-hosted and platform deployments they now show merged or closed instead of staying open indefinitely.

  **Configuration**

  ```bash
  MASTRACODE_GITHUB_RECONCILE_ENABLED=false   # opt out entirely
  MASTRACODE_GITHUB_RECONCILE_INTERVAL_MS=60000  # change the cadence
  ```

- Improved Factory triage so editing a linked GitHub issue or creating, editing, or deleting a human comment re-runs investigation and refreshes the existing handoff comment. ([#20516](https://github.com/mastra-ai/mastra/pull/20516))

- Factory work item transitions now require explicit approval before execution. ([#20622](https://github.com/mastra-ai/mastra/pull/20622))

- Fixed Factory rule dispatches so concurrent skill wakeups stay bounded until their agent runs finish or terminal observation times out. ([#20623](https://github.com/mastra-ai/mastra/pull/20623))

- Improved Factory pull-request reviews by requiring comparison with analogous codebase patterns. ([#20524](https://github.com/mastra-ai/mastra/pull/20524))

- Fixed GitHub issue intake pagination when platform responses contain fewer issues after filtering pull requests. ([#20637](https://github.com/mastra-ai/mastra/pull/20637))

- Fixed factory sessions inheriting the personal agent instructions of the machine hosting them. ([#20633](https://github.com/mastra-ai/mastra/pull/20633))

  A factory should behave the same wherever it runs. It did not: alongside the repository's AGENTS.md and the skill it was started with, every session also loaded the instruction files sitting in the home directory of whatever machine hosted the factory (`~/.claude/CLAUDE.md`, `~/.mastracode/AGENTS.md`, and the other supported home directory locations). Those files are the operator's personal preferences, so the same review rule produced a differently written review depending on who was running the factory, and nothing in the session showed why.

  Factory sessions now read only the repository's instructions (served from the pull request's base branch when the checkout is untrusted) and the skill. This applies to every session the factory creates: work items it picks up on its own, sessions a GitHub webhook resumes, and the ones you open yourself in the factory UI.

  If you were relying on a home directory file to steer factory output, move those instructions into the repository's AGENTS.md.

- Updated Factory triage to keep new features in Intake until manually advanced. ([#20624](https://github.com/mastra-ai/mastra/pull/20624))

- Updated dependencies [[`82201f7`](https://github.com/mastra-ai/mastra/commit/82201f75fae8e050a8de2df08b74875ee74c6b83), [`fb18da5`](https://github.com/mastra-ai/mastra/commit/fb18da56fc35689ae370621a8f10b5b0d8606e20), [`d01cac8`](https://github.com/mastra-ai/mastra/commit/d01cac87ef674ae6cdd354e15d39525ff9599170), [`fb18da5`](https://github.com/mastra-ai/mastra/commit/fb18da56fc35689ae370621a8f10b5b0d8606e20), [`0a6598b`](https://github.com/mastra-ai/mastra/commit/0a6598bde80bde008986ad6616bed9632b9294cb), [`9e1dad8`](https://github.com/mastra-ai/mastra/commit/9e1dad8f7b1cab2bb7ade90e5b7561f24577b88a), [`2f43145`](https://github.com/mastra-ai/mastra/commit/2f4314504c03cbba280414ac81ba3197448ee6b0), [`34d34d8`](https://github.com/mastra-ai/mastra/commit/34d34d8c811df512fef4dd5459f79b7821be1866)]:
  - @mastra/core@1.56.0-alpha.6
  - @mastra/code-sdk@1.1.2-alpha.6

## 0.4.0-alpha.5

### Patch Changes

- Updated dependencies [[`db4e6ff`](https://github.com/mastra-ai/mastra/commit/db4e6ff744503112eb64deeaf6c2b54bf26a54c7), [`6d19a65`](https://github.com/mastra-ai/mastra/commit/6d19a6517f5da3911023d446b7e2d5dad8adb1cb)]:
  - @mastra/core@1.56.0-alpha.5
  - @mastra/code-sdk@1.1.2-alpha.5

## 0.4.0-alpha.4

### Patch Changes

- Updated dependencies [[`4844167`](https://github.com/mastra-ai/mastra/commit/4844167cff2d5ec5004e94edd34970833040fa3f), [`5faf93f`](https://github.com/mastra-ai/mastra/commit/5faf93f03e19daea394b9e2a923f2e4f833407f2), [`80ad891`](https://github.com/mastra-ai/mastra/commit/80ad891f8cd10379aa5b5af7510c763783b2ab56), [`a1cb98d`](https://github.com/mastra-ai/mastra/commit/a1cb98d11990b560b98482292a1f34aa1a2d9092), [`598ad82`](https://github.com/mastra-ai/mastra/commit/598ad82d41c41389a686338a1d0e50b7400e1938), [`1fd6aad`](https://github.com/mastra-ai/mastra/commit/1fd6aad1ea4a9d32f65efa832307c35e981a4c0a)]:
  - @mastra/core@1.56.0-alpha.4
  - @mastra/code-sdk@1.1.2-alpha.4

## 0.4.0-alpha.3

### Patch Changes

- Fixed the Factory getting stuck after a GitHub App is uninstalled and reinstalled. ([#20481](https://github.com/mastra-ai/mastra/pull/20481))

  GitHub assigns a new installation ID on reinstall, which left every token request failing against the old one — recovering it needed a manual database edit. The Factory already knew how to repoint a repository at the replacement installation, but only triggered that recovery when the platform reported the old installation as missing (404). A suspended or soft-deleted installation reports as a conflict (409) instead, so the recovery never ran. It now covers both.

  A failed token mint that could equally be a transient GitHub outage (502) still surfaces as an error rather than repointing the repository, so a passing incident never migrates a healthy repository.

- Updated dependencies [[`594f7b2`](https://github.com/mastra-ai/mastra/commit/594f7b28f5263fb9982fd50d95c471fb971ea984), [`311f943`](https://github.com/mastra-ai/mastra/commit/311f943bee60e8fdf5c84499ea50e884276c936c), [`0c89896`](https://github.com/mastra-ai/mastra/commit/0c8989673fb7d106837098398131e570c6023b68), [`23b4238`](https://github.com/mastra-ai/mastra/commit/23b423844ad0bcf2a502a68dd62866d6160f9f6d), [`e320a76`](https://github.com/mastra-ai/mastra/commit/e320a763feaf65c6be3cebecf746defcbde161b3), [`03b4918`](https://github.com/mastra-ai/mastra/commit/03b4918c80d188ce375334c393e131c6e94bd7eb), [`14ef73a`](https://github.com/mastra-ai/mastra/commit/14ef73a4bbd73e7808414816eb0628ce1d80b5d7), [`1d677d5`](https://github.com/mastra-ai/mastra/commit/1d677d5f99d7db403f7828585e8c25f299f72628), [`93e28ec`](https://github.com/mastra-ai/mastra/commit/93e28ecce9031c02397e0ae8406593e5c7a95883), [`729dab4`](https://github.com/mastra-ai/mastra/commit/729dab408faccfaef0cbb048e5a4338f9172847e), [`484003d`](https://github.com/mastra-ai/mastra/commit/484003d33ff59330c86b19863e4a38732d7e4155), [`933d291`](https://github.com/mastra-ai/mastra/commit/933d291146b789c19442ad206f94da3e4be90c64)]:
  - @mastra/core@1.56.0-alpha.3
  - @mastra/code-sdk@1.1.2-alpha.3

## 0.4.0-alpha.2

### Patch Changes

- Updated dependencies [[`322daa6`](https://github.com/mastra-ai/mastra/commit/322daa6d90552909204044790d850958f6745fed), [`cadaa13`](https://github.com/mastra-ai/mastra/commit/cadaa1372e1077c8e85eb64c5499ba8803caa323), [`06000d7`](https://github.com/mastra-ai/mastra/commit/06000d73712911572e913b8a83339270296d0a22), [`3de0188`](https://github.com/mastra-ai/mastra/commit/3de0188bfaf9a9c09c95fe322b53838cf52c70b6)]:
  - @mastra/core@1.56.0-alpha.2
  - @mastra/code-sdk@1.1.2-alpha.2

## 0.4.0-alpha.1

### Minor Changes

- Added a lightweight pending changes viewer with per-file line counts for Factory session workspaces and improved chat composer readability. ([#20418](https://github.com/mastra-ai/mastra/pull/20418))

### Patch Changes

- Updated dependencies [[`c5e56ff`](https://github.com/mastra-ai/mastra/commit/c5e56ff3bcabdf062708f2d48744fec304df6792), [`4e35a56`](https://github.com/mastra-ai/mastra/commit/4e35a56cdf8d74a5ff6d5eda01f2c1deaf6cc7be)]:
  - @mastra/core@1.56.0-alpha.1
  - @mastra/code-sdk@1.1.2-alpha.1

## 0.3.1-alpha.0

### Patch Changes

- Updated dependencies [[`7f4e26d`](https://github.com/mastra-ai/mastra/commit/7f4e26dd57bd9b23c278ea21235ab823a3810a6c), [`b582f7f`](https://github.com/mastra-ai/mastra/commit/b582f7fa2f9c1f87d19efc63d344fbe5dda2608c), [`b582f7f`](https://github.com/mastra-ai/mastra/commit/b582f7fa2f9c1f87d19efc63d344fbe5dda2608c)]:
  - @mastra/core@1.56.0-alpha.0
  - @mastra/code-sdk@1.1.2-alpha.0

## 0.3.0

### Minor Changes

- Added a `channel-identity` storage domain so a factory can link a chat-platform sender to one of its own users, and a `channels()` slot so an integration can supply the chat platform itself. ([#20060](https://github.com/mastra-ai/mastra/pull/20060))

  `ChannelIdentityStorage` persists account links keyed by platform, external team id, and external user id, and records an optional default factory project per link. A link is written only after the chat platform itself asserts the account through OpenID Connect, with the existing `createStateSigner` binding the round trip to the tenant that started it.

  `FactoryIntegration` gains an optional `channels(ctx)` returning an `AgentControllerChannels`, which the factory attaches to the mounted agent controller during `prepare()`. Inbound platform messages then reach the same agents the web UI drives, without the deploy entry reaching into the prepared controller to wire them by hand. `IntegrationContext` gains `storage.channelIdentity` for integrations that use the slot. Providing `channels()` adds the `channel-identity` domain to the integration's readiness requirements, so an integration whose reverse index is not migrated reports not-ready and its channels never attach. Only one integration may provide channels; a second fails the boot, because attaching replaces rather than merges.

  `StateTenant` — what `StateSigner.verify` returns — gains a `nonce` field carrying the per-`state` random value. A signed `state` stays valid for its whole lifetime, so a flow that must not run twice off one `state` can key single-use bookkeeping on the nonce; the Slack account-link callback burns it before spending the authorization code. `verify` now rejects a `state` carrying no nonce.

  The integration seam itself — `FactoryIntegration`, `IntegrationContext`, `IntegrationHooks`, and `IntegrationTools` — is now exported from the package entry point. Implementing an integration outside this package was already the documented path for third parties, but the types to do it were unreachable. `ChannelIdentityStorage` and `createFactoryRouteAuth` are exported too, alongside the existing projects and work-items storage domains.

  Fixed sign-in returning to the root path instead of the page the visitor started from. The OAuth `state` carrying that destination was encoded as Base64URL JSON, but `MastraAuthStudio` reads the `uuid|encodedPath` shape, so it never found a destination and every sign-in landed on `/`. The state now uses that shape, and the destination is also stashed in a short-lived `HttpOnly` cookie for providers that do not echo `state` back to the callback.

- Added a per-Factory Slack work-item setting so a new Slack thread only opens a Work-board card when that Factory opts in, and Slack OAuth now returns to the Factory the flow started from. ([#20395](https://github.com/mastra-ai/mastra/pull/20395))

### Patch Changes

- Fixed workspace re-opening failing when the session's agent switched branches and left uncommitted work in the tree. The workspace now keeps the checkout on its current branch instead of returning an error — the session's work in progress always wins over the recorded branch. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Move Github log to debug instead of info in factory ([#20331](https://github.com/mastra-ai/mastra/pull/20331))

- Opening a workspace no longer fails when the repository checkout holds uncommitted or untracked files that block `git pull` (for example residue from a changeset-version run or a build). Materialization now keeps the checkout as-is — the same treatment diverged session branches already receive — instead of surfacing "git pull failed: Your local changes would be overwritten by merge" and refusing to open the thread. Local state is never discarded to force the pull through. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Stop long-running Factory dispatches from starving the decision queue. The dispatcher poll loop previously awaited every dispatch to completion before claiming again, so a single slow effect (a skill kickoff consuming a full agent run, or binding preparation cloning a repository) froze the whole queue and left every other rule effect stuck in "pending" — sometimes for the 15-minute sandbox clone timeout times five retry attempts. Dispatches now run detached from the poll loop under a bounded in-flight cap while lease renewal keeps them protected from re-claim, so new decisions keep flowing while slow ones finish. ([#20356](https://github.com/mastra-ai/mastra/pull/20356))

- Added model switching to Factory review sessions so work can continue during a model outage. ([#20423](https://github.com/mastra-ai/mastra/pull/20423))

- Fixed a boot-time provisioning storm where several concurrent requests for the same cold session (for example multiple open browser tabs polling right after a server restart) each provisioned their own sandbox. Concurrent sandbox opens for the same session now share one in-flight provision, so only a single sandbox is created per session. ([#20380](https://github.com/mastra-ai/mastra/pull/20380))

- Fixed manual issue triage in platform deployments. The triage runner is now automatically derived from the mounted controller, so manual triage no longer returns 503 when no explicit runner is configured. The manual triage endpoint now shares the same wrapper as webhook-triggered triage, ensuring labels and default model resolution are handled consistently. ([#20362](https://github.com/mastra-ai/mastra/pull/20362))

- Improved contributor guidance for Factory backend development. ([#20327](https://github.com/mastra-ai/mastra/pull/20327))

- Fixed Factory losing repository access after a GitHub App is reinstalled with a new installation ID. ([#20348](https://github.com/mastra-ai/mastra/pull/20348))

- Review sessions now load project AGENTS.md/CLAUDE.md from the pull request's trusted base branch instead of skipping them entirely. The working-tree copies on an untrusted checkout remain excluded from the system prompt and reminder injection; content is served from the base ref via git, and sessions without a known base ref still skip project instruction files. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Factory review verdicts are stricter and grounded in the full review record: ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

  - The reviewer waits for pending review bots to finish on the head commit (polling up to 10 minutes) before forming a verdict, then reads existing reviews — bot and human — and every substantive prior finding is confirmed, addressed, or refuted with evidence. Confirmed unaddressed major findings block approval.
  - Approval is earned through explicit gates: verification executed, all prior findings dispositioned, no bot still pending, behavior covered by tests, adversarial self-check survived. Any concrete change the author should make before merge means "request changes", borderline calls tie-break toward "request changes", and real defects can't be relabeled non-blocking to protect an approval.
  - Non-blocking findings with mechanical fixes ship as a follow-up PR opened by the reviewer against the reviewed PR's branch, instead of landing as homework for the author.
  - The reviewer is hardened against prompt injection: PR content can never direct the review, steering attempts become blocking security findings, bot identity is verified by account login, the PR's install/test-time code is inspected before anything is executed, and follow-up PRs only ever contain code the reviewer authored.
  - The reviewer runs the changed packages' tests and typecheck itself instead of trusting green CI, and every approval must survive an adversarial self-check.
  - PRs with merge conflicts still get a full review but are never approved and never have their conflicts resolved by the reviewer.

  Reviews arrive on the pull request itself, published via `gh pr review --approve` or `gh pr review --request-changes` before the review pass completes.

- Fix Factory workspaces not being available to HTTP routes immediately after creation. Sessions now consistently reuse the same workspace across requests. ([#20421](https://github.com/mastra-ai/mastra/pull/20421))

- Fixed Factory rules treating a work item from a non-GitHub, non-Linear source as a GitHub issue. A Slack thread card moved into Triage ran the GitHub issue rule and handed the triage agent a Slack permalink labeled as a GitHub issue; those cards now resolve the plain work-item rules instead. ([#20395](https://github.com/mastra-ai/mastra/pull/20395))

- Review sessions no longer ingest AGENTS.md or CLAUDE.md from the checked-out pull request branch. A PR branch is third-party content, so its instruction files are treated as content under review instead of trusted configuration — closing a prompt-injection path into the reviewer agent. The reviewer also runs the PR's install/build/test commands with GitHub tokens stripped from the environment. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Fixed Factory provisioning a fresh Platform sandbox for every new session. When a work item finishes or a session is deleted, its sandbox is scrubbed back to the repository's default branch (including gitignored files) and returned to a per-repository reuse pool, so new sessions for the same repository reuse a pooled sandbox instead of spinning up another VM. ([#20328](https://github.com/mastra-ai/mastra/pull/20328))

  GitHub tokens are injected per command and are no longer stored in the sandbox environment, so a reused sandbox never carries a previous session's credentials.

- Added an option to the instruction-file reminder processor that lets hosts disable injection entirely for a request, so instruction files from untrusted checkouts are never surfaced as reminders. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Updated dependencies [[`3f472b4`](https://github.com/mastra-ai/mastra/commit/3f472b468892a1ff14ccb43cc0343b86f7d8fd7d), [`ba369f2`](https://github.com/mastra-ai/mastra/commit/ba369f2a0aaf998da0d6aa033d26f64f96bef8ac), [`7457af7`](https://github.com/mastra-ai/mastra/commit/7457af7d309fa4ba4d975904249c0d05ec32e6b7), [`35b929b`](https://github.com/mastra-ai/mastra/commit/35b929b7abc3d20d85c7985880960ac2d04a6c86), [`55c9e24`](https://github.com/mastra-ai/mastra/commit/55c9e248c27c1d72b5bb7e94ea6b8a3999eee49f), [`dcfed93`](https://github.com/mastra-ai/mastra/commit/dcfed93e1e256c6abfa792cbb7ca836f5d0e8638), [`2876e15`](https://github.com/mastra-ai/mastra/commit/2876e15b4d2f616a3bc1ed3af57d546c268384ce), [`35b929b`](https://github.com/mastra-ai/mastra/commit/35b929b7abc3d20d85c7985880960ac2d04a6c86), [`9b3626a`](https://github.com/mastra-ai/mastra/commit/9b3626aeb1d16fcd34b0a8e94c114ddb80a3b240), [`6936517`](https://github.com/mastra-ai/mastra/commit/6936517137090304b735a32aca8f8694f91cb927), [`4696963`](https://github.com/mastra-ai/mastra/commit/469696312ac4c618bc8475b0c5ed7949b8a3455e), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`4137863`](https://github.com/mastra-ai/mastra/commit/4137863eaa35f430117d21d5dc1bf2f534e64339), [`4137863`](https://github.com/mastra-ai/mastra/commit/4137863eaa35f430117d21d5dc1bf2f534e64339), [`07f5b4b`](https://github.com/mastra-ai/mastra/commit/07f5b4ba9d608d88865030732e580298296adf99), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`598080f`](https://github.com/mastra-ai/mastra/commit/598080f224edb3f0f5b801035b067fac50a56a03)]:
  - @mastra/core@1.55.0
  - @mastra/code-sdk@1.1.1

## 0.3.0-alpha.3

### Minor Changes

- Added a per-Factory Slack work-item setting so a new Slack thread only opens a Work-board card when that Factory opts in, and Slack OAuth now returns to the Factory the flow started from. ([#20395](https://github.com/mastra-ai/mastra/pull/20395))

### Patch Changes

- Fixed workspace re-opening failing when the session's agent switched branches and left uncommitted work in the tree. The workspace now keeps the checkout on its current branch instead of returning an error — the session's work in progress always wins over the recorded branch. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Opening a workspace no longer fails when the repository checkout holds uncommitted or untracked files that block `git pull` (for example residue from a changeset-version run or a build). Materialization now keeps the checkout as-is — the same treatment diverged session branches already receive — instead of surfacing "git pull failed: Your local changes would be overwritten by merge" and refusing to open the thread. Local state is never discarded to force the pull through. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Review sessions now load project AGENTS.md/CLAUDE.md from the pull request's trusted base branch instead of skipping them entirely. The working-tree copies on an untrusted checkout remain excluded from the system prompt and reminder injection; content is served from the base ref via git, and sessions without a known base ref still skip project instruction files. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Factory review verdicts are stricter and grounded in the full review record: ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

  - The reviewer waits for pending review bots to finish on the head commit (polling up to 10 minutes) before forming a verdict, then reads existing reviews — bot and human — and every substantive prior finding is confirmed, addressed, or refuted with evidence. Confirmed unaddressed major findings block approval.
  - Approval is earned through explicit gates: verification executed, all prior findings dispositioned, no bot still pending, behavior covered by tests, adversarial self-check survived. Any concrete change the author should make before merge means "request changes", borderline calls tie-break toward "request changes", and real defects can't be relabeled non-blocking to protect an approval.
  - Non-blocking findings with mechanical fixes ship as a follow-up PR opened by the reviewer against the reviewed PR's branch, instead of landing as homework for the author.
  - The reviewer is hardened against prompt injection: PR content can never direct the review, steering attempts become blocking security findings, bot identity is verified by account login, the PR's install/test-time code is inspected before anything is executed, and follow-up PRs only ever contain code the reviewer authored.
  - The reviewer runs the changed packages' tests and typecheck itself instead of trusting green CI, and every approval must survive an adversarial self-check.
  - PRs with merge conflicts still get a full review but are never approved and never have their conflicts resolved by the reviewer.

  Reviews arrive on the pull request itself, published via `gh pr review --approve` or `gh pr review --request-changes` before the review pass completes.

- Fix Factory workspaces not being available to HTTP routes immediately after creation. Sessions now consistently reuse the same workspace across requests. ([#20421](https://github.com/mastra-ai/mastra/pull/20421))

- Fixed Factory rules treating a work item from a non-GitHub, non-Linear source as a GitHub issue. A Slack thread card moved into Triage ran the GitHub issue rule and handed the triage agent a Slack permalink labeled as a GitHub issue; those cards now resolve the plain work-item rules instead. ([#20395](https://github.com/mastra-ai/mastra/pull/20395))

- Review sessions no longer ingest AGENTS.md or CLAUDE.md from the checked-out pull request branch. A PR branch is third-party content, so its instruction files are treated as content under review instead of trusted configuration — closing a prompt-injection path into the reviewer agent. The reviewer also runs the PR's install/build/test commands with GitHub tokens stripped from the environment. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Added an option to the instruction-file reminder processor that lets hosts disable injection entirely for a request, so instruction files from untrusted checkouts are never surfaced as reminders. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Updated dependencies [[`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73)]:
  - @mastra/code-sdk@1.1.1-alpha.3
  - @mastra/core@1.55.0-alpha.3

## 0.3.0-alpha.2

### Minor Changes

- Added a `channel-identity` storage domain so a factory can link a chat-platform sender to one of its own users, and a `channels()` slot so an integration can supply the chat platform itself. ([#20060](https://github.com/mastra-ai/mastra/pull/20060))

  `ChannelIdentityStorage` persists account links keyed by platform, external team id, and external user id, and records an optional default factory project per link. A link is written only after the chat platform itself asserts the account through OpenID Connect, with the existing `createStateSigner` binding the round trip to the tenant that started it.

  `FactoryIntegration` gains an optional `channels(ctx)` returning an `AgentControllerChannels`, which the factory attaches to the mounted agent controller during `prepare()`. Inbound platform messages then reach the same agents the web UI drives, without the deploy entry reaching into the prepared controller to wire them by hand. `IntegrationContext` gains `storage.channelIdentity` for integrations that use the slot. Providing `channels()` adds the `channel-identity` domain to the integration's readiness requirements, so an integration whose reverse index is not migrated reports not-ready and its channels never attach. Only one integration may provide channels; a second fails the boot, because attaching replaces rather than merges.

  `StateTenant` — what `StateSigner.verify` returns — gains a `nonce` field carrying the per-`state` random value. A signed `state` stays valid for its whole lifetime, so a flow that must not run twice off one `state` can key single-use bookkeeping on the nonce; the Slack account-link callback burns it before spending the authorization code. `verify` now rejects a `state` carrying no nonce.

  The integration seam itself — `FactoryIntegration`, `IntegrationContext`, `IntegrationHooks`, and `IntegrationTools` — is now exported from the package entry point. Implementing an integration outside this package was already the documented path for third parties, but the types to do it were unreachable. `ChannelIdentityStorage` and `createFactoryRouteAuth` are exported too, alongside the existing projects and work-items storage domains.

  Fixed sign-in returning to the root path instead of the page the visitor started from. The OAuth `state` carrying that destination was encoded as Base64URL JSON, but `MastraAuthStudio` reads the `uuid|encodedPath` shape, so it never found a destination and every sign-in landed on `/`. The state now uses that shape, and the destination is also stashed in a short-lived `HttpOnly` cookie for providers that do not echo `state` back to the callback.

### Patch Changes

- Fixed a boot-time provisioning storm where several concurrent requests for the same cold session (for example multiple open browser tabs polling right after a server restart) each provisioned their own sandbox. Concurrent sandbox opens for the same session now share one in-flight provision, so only a single sandbox is created per session. ([#20380](https://github.com/mastra-ai/mastra/pull/20380))

- Fixed Factory provisioning a fresh Platform sandbox for every new session. When a work item finishes or a session is deleted, its sandbox is scrubbed back to the repository's default branch (including gitignored files) and returned to a per-repository reuse pool, so new sessions for the same repository reuse a pooled sandbox instead of spinning up another VM. ([#20328](https://github.com/mastra-ai/mastra/pull/20328))

  GitHub tokens are injected per command and are no longer stored in the sandbox environment, so a reused sandbox never carries a previous session's credentials.

- Updated dependencies [[`7457af7`](https://github.com/mastra-ai/mastra/commit/7457af7d309fa4ba4d975904249c0d05ec32e6b7), [`55c9e24`](https://github.com/mastra-ai/mastra/commit/55c9e248c27c1d72b5bb7e94ea6b8a3999eee49f), [`07f5b4b`](https://github.com/mastra-ai/mastra/commit/07f5b4ba9d608d88865030732e580298296adf99)]:
  - @mastra/code-sdk@1.1.1-alpha.2
  - @mastra/core@1.55.0-alpha.2

## 0.2.3-alpha.1

### Patch Changes

- Move Github log to debug instead of info in factory ([#20331](https://github.com/mastra-ai/mastra/pull/20331))

- Stop long-running Factory dispatches from starving the decision queue. The dispatcher poll loop previously awaited every dispatch to completion before claiming again, so a single slow effect (a skill kickoff consuming a full agent run, or binding preparation cloning a repository) froze the whole queue and left every other rule effect stuck in "pending" — sometimes for the 15-minute sandbox clone timeout times five retry attempts. Dispatches now run detached from the poll loop under a bounded in-flight cap while lease renewal keeps them protected from re-claim, so new decisions keep flowing while slow ones finish. ([#20356](https://github.com/mastra-ai/mastra/pull/20356))

- Fixed manual issue triage in platform deployments. The triage runner is now automatically derived from the mounted controller, so manual triage no longer returns 503 when no explicit runner is configured. The manual triage endpoint now shares the same wrapper as webhook-triggered triage, ensuring labels and default model resolution are handled consistently. ([#20362](https://github.com/mastra-ai/mastra/pull/20362))

- Updated dependencies [[`ba369f2`](https://github.com/mastra-ai/mastra/commit/ba369f2a0aaf998da0d6aa033d26f64f96bef8ac), [`dcfed93`](https://github.com/mastra-ai/mastra/commit/dcfed93e1e256c6abfa792cbb7ca836f5d0e8638), [`2876e15`](https://github.com/mastra-ai/mastra/commit/2876e15b4d2f616a3bc1ed3af57d546c268384ce), [`4137863`](https://github.com/mastra-ai/mastra/commit/4137863eaa35f430117d21d5dc1bf2f534e64339), [`4137863`](https://github.com/mastra-ai/mastra/commit/4137863eaa35f430117d21d5dc1bf2f534e64339), [`598080f`](https://github.com/mastra-ai/mastra/commit/598080f224edb3f0f5b801035b067fac50a56a03)]:
  - @mastra/core@1.55.0-alpha.1
  - @mastra/code-sdk@1.1.1-alpha.1

## 0.2.3-alpha.0

### Patch Changes

- Improved contributor guidance for Factory backend development. ([#20327](https://github.com/mastra-ai/mastra/pull/20327))

- Fixed Factory losing repository access after a GitHub App is reinstalled with a new installation ID. ([#20348](https://github.com/mastra-ai/mastra/pull/20348))

- Updated dependencies [[`3f472b4`](https://github.com/mastra-ai/mastra/commit/3f472b468892a1ff14ccb43cc0343b86f7d8fd7d), [`35b929b`](https://github.com/mastra-ai/mastra/commit/35b929b7abc3d20d85c7985880960ac2d04a6c86), [`35b929b`](https://github.com/mastra-ai/mastra/commit/35b929b7abc3d20d85c7985880960ac2d04a6c86), [`9b3626a`](https://github.com/mastra-ai/mastra/commit/9b3626aeb1d16fcd34b0a8e94c114ddb80a3b240)]:
  - @mastra/core@1.55.0-alpha.0
  - @mastra/code-sdk@1.1.1-alpha.0

## 0.2.2

### Patch Changes

- Make shared-factory credentials discoverable and shareable. The providers config route now reports `orgKey` per provider (an org-wide API key exists, even when shadowed by a personal credential) and `orgKeyAdmin` on the envelope (whether the caller may write org-scoped keys). The Studio UI uses this to default factory-setup API keys to org scope, warn when a factory default model is backed by a personal-only credential, show Personal/Org key badges, and replace the composer with an actionable notice when the signed-in user has no credential for the factory default model's provider. ([#20315](https://github.com/mastra-ai/mastra/pull/20315))

- Reopening a workspace no longer fails with "git pull failed: Not possible to fast-forward" when the sandbox workdir was left on a session branch that diverged from its upstream (or has no upstream / detached HEAD). That state is the session's local work, so materialization now keeps the checkout as-is and continues instead of erroring the thread page; genuine pull failures (auth, egress, corruption) still surface. ([#20315](https://github.com/mastra-ai/mastra/pull/20315))

- Observational-memory settings no longer fail with "No session for resourceId" on the settings page: OM config routes now treat the live session as best-effort sync and fall back to the durably stored per-user settings when no agent-controller session exists for the resource (e.g. after a server restart), so settings load and save instead of 404ing ([#20265](https://github.com/mastra-ai/mastra/pull/20265))

- Pin Factory session agents to their session workdir. The agent system prompt derives its working directory from `state.projectPath`, which for Factory sessions inherited the controller-global default — the web server's own checkout. Review agents would `cd` into the host repository and run `gh pr checkout` there, mutating the developer's working tree instead of the session sandbox. The session workspace factory now seeds `projectPath`/`projectName` with the resolved sandbox workdir when the session is created and self-heals live state on later requests. ([#20320](https://github.com/mastra-ai/mastra/pull/20320))

- Fixed session creation ignoring an exact thread id when the session was already live. Requesting a session with a threadId now resumes or creates that exact thread even when another request (like an event subscription or message listing) created the session first, preventing 'Thread not found' errors for workspace threads. ([#20265](https://github.com/mastra-ai/mastra/pull/20265))

- Made Factory session opens and rule-driven kickoffs resilient to platform sandbox failures: ([#20294](https://github.com/mastra-ai/mastra/pull/20294))

  - Skill kickoffs now wait for the agent to accept the wake signal (via the new `requireDelivery` option on `session.sendSignal`) and automatically retry when delivery fails — for example when a platform sandbox is unreachable. Previously kickoffs were marked as sent even when the wake never reached the agent, so review sessions ended up as permanently empty threads.
  - Exec calls in the repo materialize/checkout/worktree-setup path retry thrown transport errors with a 5xx status (up to 2 retries with backoff). When several platform sandboxes are provisioned concurrently, the workspace proxy can return a transient 5xx on exec while a VM is still booting; this previously failed the whole session open with "Platform proxy request failed with 500". Command failures are unaffected — they resolve with a non-zero exit code and are never retried.
  - A sandbox whose git preflight fails (`git-missing`) is now treated as poisoned: the workspace factory tears it down, clears the persisted binding, and retries once on a freshly provisioned sandbox. Previously a sandbox booted from a bare base image (e.g. when the provider's template build fails) was reattached forever, so every session open failed with "git is not installed in the sandbox".
  - Concurrent kickoff preparation no longer surfaces a spurious unique-constraint error: a losing preparer can collide on both the work item's `source_key` and the pending start's `kickoff_key` in sequence, so the insert-or-replay loop now retries once more before giving up.

- Fixed Factory sessions failing to start their kickoff run. Workspaces now recover automatically when the sandbox provider changes or a sandbox is wiped (the repository is re-cloned instead of failing), thread pages surface workspace preparation errors with a Retry button instead of hanging, and kickoff messages are now delivered to the session thread instead of silently failing with a permissions error. ([#20265](https://github.com/mastra-ai/mastra/pull/20265))

- The factory-review skill now publishes its verdict on the pull request itself (gh pr review --approve / --request-changes with the full handoff body, falling back to a PR comment when GitHub rejects the review) instead of only posting the verdict in the Factory thread ([#20265](https://github.com/mastra-ai/mastra/pull/20265))

- Allow signed-out Factory pages to load their web app manifest and icon. ([#20246](https://github.com/mastra-ai/mastra/pull/20246))

- Added a periodic merged-PR reconciler so review board cards can never get stuck when a merge event is missed. Every 5 minutes the platform GitHub worker lists still-open `github-pr` review cards, fetches the live pull request state from GitHub, and replays a missed merge through the normal rules ingress with a state-derived idempotency key — moving the card to Done (and notifying an active session, if any) exactly once. The sweep has its own switch, `MASTRA_PLATFORM_GITHUB_RECONCILE_ENABLED` (default on), and keeps running in a reconcile-only worker mode even when `MASTRA_PLATFORM_GITHUB_POLLING_ENABLED=false`. Sweep failures are logged and stay on cadence instead of retrying every poll tick. ([#20315](https://github.com/mastra-ai/mastra/pull/20315))

- Move merged pull request Review cards to Done automatically. When a PR merge event binds to the PR's own Review card, the built-in rule now transitions the card to Done (delivering a note to the card's active session when one exists) instead of attempting to message a work session that may not exist. Merge events bound to a provenance-linked Work item still only remind that agent to assess completion and never auto-complete the Work item. ([#20315](https://github.com/mastra-ai/mastra/pull/20315))

  Pull requests closed without merging now clear off the board too: a new built-in `pullRequestClosed` rule moves the PR's Review card to Canceled, and the reconcile sweep replays missed closes (not just missed merges) so abandoned PRs no longer sit in Reviewing forever.

  The reconcile sweep is also scoped to factory-configured repositories: instead of probing every repository a GitHub installation exposes, it bulk-loads the (installation, repository) pairs linked to factory projects and only sweeps those, reporting the swept repository count in its summary log.

- Changed the observational memory defaults a factory gets when you connect a provider: Google and DeepSeek now seed OM with their small, cheap model instead of the model you selected for the factory, matching what Anthropic and OpenAI already did. Providers without a cheap OM model keep using your selected model, and OM models you already set are still left untouched. ([#20298](https://github.com/mastra-ai/mastra/pull/20298))

- Speed up Factory hot paths: ([#20261](https://github.com/mastra-ai/mastra/pull/20261))

  - Much lower latency on authenticated requests — successful auth verifications are cached briefly instead of hitting the platform on every request, and credential verification requests time out after 15 seconds instead of hanging
  - Faster GitHub repository listing and connecting
  - Opening the same session concurrently no longer provisions duplicate sandboxes, and stuck sandbox commands now fail with a clear error instead of hanging
  - Factory run dispatching stays fast as work-item history grows

- Updated dependencies [[`ce93a3c`](https://github.com/mastra-ai/mastra/commit/ce93a3c114ea1cbfbd576f3db41d7c26c9844f5b), [`5718a22`](https://github.com/mastra-ai/mastra/commit/5718a229281dcfd36bcd1f42a242e3717e510a33), [`a211d09`](https://github.com/mastra-ai/mastra/commit/a211d09185dc65a746534914cf38b67f21ee9bac), [`0dca9d0`](https://github.com/mastra-ai/mastra/commit/0dca9d0b1356024a53b72ea6f040db528b126caa), [`6218217`](https://github.com/mastra-ai/mastra/commit/62182171b6cfca0b099f1c6a77a2e65e7639ab86), [`f014c26`](https://github.com/mastra-ai/mastra/commit/f014c26f3445118b684e286ee5819b46dfa943a0), [`5807d3a`](https://github.com/mastra-ai/mastra/commit/5807d3ae1d259b8b7d6df7e5bf2b485c694af9c8), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`05db566`](https://github.com/mastra-ai/mastra/commit/05db566fcbdcbf33d0bffca0c72ec30129e2e3ca), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`5718a22`](https://github.com/mastra-ai/mastra/commit/5718a229281dcfd36bcd1f42a242e3717e510a33), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`d1b7e3a`](https://github.com/mastra-ai/mastra/commit/d1b7e3a978a309a5653eeaa490d2d6c7c53bd093), [`29c584a`](https://github.com/mastra-ai/mastra/commit/29c584a13a88831e5ed1fdeb0ff8e82eae180433), [`8dadb6a`](https://github.com/mastra-ai/mastra/commit/8dadb6abfe449b7f8b129663671cc614f2cceeef), [`c093146`](https://github.com/mastra-ai/mastra/commit/c0931466404d3c521308ea119cb165bb7e695155), [`2624b7e`](https://github.com/mastra-ai/mastra/commit/2624b7ecad926028e3cbc9a5e843f5624c67302e), [`8124754`](https://github.com/mastra-ai/mastra/commit/8124754ae89fbc69f8136d1df4a91904d0f84c4e), [`d12b2e4`](https://github.com/mastra-ai/mastra/commit/d12b2e4023fd9e3d3e93a9169f5088bcee2a849c)]:
  - @mastra/core@1.54.0
  - @mastra/code-sdk@1.1.0
  - @mastra/auth-studio@1.3.3

## 0.2.2-alpha.4

### Patch Changes

- Make shared-factory credentials discoverable and shareable. The providers config route now reports `orgKey` per provider (an org-wide API key exists, even when shadowed by a personal credential) and `orgKeyAdmin` on the envelope (whether the caller may write org-scoped keys). The Studio UI uses this to default factory-setup API keys to org scope, warn when a factory default model is backed by a personal-only credential, show Personal/Org key badges, and replace the composer with an actionable notice when the signed-in user has no credential for the factory default model's provider. ([#20315](https://github.com/mastra-ai/mastra/pull/20315))

- Reopening a workspace no longer fails with "git pull failed: Not possible to fast-forward" when the sandbox workdir was left on a session branch that diverged from its upstream (or has no upstream / detached HEAD). That state is the session's local work, so materialization now keeps the checkout as-is and continues instead of erroring the thread page; genuine pull failures (auth, egress, corruption) still surface. ([#20315](https://github.com/mastra-ai/mastra/pull/20315))

- Pin Factory session agents to their session workdir. The agent system prompt derives its working directory from `state.projectPath`, which for Factory sessions inherited the controller-global default — the web server's own checkout. Review agents would `cd` into the host repository and run `gh pr checkout` there, mutating the developer's working tree instead of the session sandbox. The session workspace factory now seeds `projectPath`/`projectName` with the resolved sandbox workdir when the session is created and self-heals live state on later requests. ([#20320](https://github.com/mastra-ai/mastra/pull/20320))

- Made Factory session opens and rule-driven kickoffs resilient to platform sandbox failures: ([#20294](https://github.com/mastra-ai/mastra/pull/20294))

  - Skill kickoffs now wait for the agent to accept the wake signal (via the new `requireDelivery` option on `session.sendSignal`) and automatically retry when delivery fails — for example when a platform sandbox is unreachable. Previously kickoffs were marked as sent even when the wake never reached the agent, so review sessions ended up as permanently empty threads.
  - Exec calls in the repo materialize/checkout/worktree-setup path retry thrown transport errors with a 5xx status (up to 2 retries with backoff). When several platform sandboxes are provisioned concurrently, the workspace proxy can return a transient 5xx on exec while a VM is still booting; this previously failed the whole session open with "Platform proxy request failed with 500". Command failures are unaffected — they resolve with a non-zero exit code and are never retried.
  - A sandbox whose git preflight fails (`git-missing`) is now treated as poisoned: the workspace factory tears it down, clears the persisted binding, and retries once on a freshly provisioned sandbox. Previously a sandbox booted from a bare base image (e.g. when the provider's template build fails) was reattached forever, so every session open failed with "git is not installed in the sandbox".
  - Concurrent kickoff preparation no longer surfaces a spurious unique-constraint error: a losing preparer can collide on both the work item's `source_key` and the pending start's `kickoff_key` in sequence, so the insert-or-replay loop now retries once more before giving up.

- Added a periodic merged-PR reconciler so review board cards can never get stuck when a merge event is missed. Every 5 minutes the platform GitHub worker lists still-open `github-pr` review cards, fetches the live pull request state from GitHub, and replays a missed merge through the normal rules ingress with a state-derived idempotency key — moving the card to Done (and notifying an active session, if any) exactly once. The sweep has its own switch, `MASTRA_PLATFORM_GITHUB_RECONCILE_ENABLED` (default on), and keeps running in a reconcile-only worker mode even when `MASTRA_PLATFORM_GITHUB_POLLING_ENABLED=false`. Sweep failures are logged and stay on cadence instead of retrying every poll tick. ([#20315](https://github.com/mastra-ai/mastra/pull/20315))

- Move merged pull request Review cards to Done automatically. When a PR merge event binds to the PR's own Review card, the built-in rule now transitions the card to Done (delivering a note to the card's active session when one exists) instead of attempting to message a work session that may not exist. Merge events bound to a provenance-linked Work item still only remind that agent to assess completion and never auto-complete the Work item. ([#20315](https://github.com/mastra-ai/mastra/pull/20315))

  Pull requests closed without merging now clear off the board too: a new built-in `pullRequestClosed` rule moves the PR's Review card to Canceled, and the reconcile sweep replays missed closes (not just missed merges) so abandoned PRs no longer sit in Reviewing forever.

  The reconcile sweep is also scoped to factory-configured repositories: instead of probing every repository a GitHub installation exposes, it bulk-loads the (installation, repository) pairs linked to factory projects and only sweeps those, reporting the swept repository count in its summary log.

- Updated dependencies [[`6218217`](https://github.com/mastra-ai/mastra/commit/62182171b6cfca0b099f1c6a77a2e65e7639ab86), [`d12b2e4`](https://github.com/mastra-ai/mastra/commit/d12b2e4023fd9e3d3e93a9169f5088bcee2a849c)]:
  - @mastra/core@1.54.0-alpha.4
  - @mastra/code-sdk@1.1.0-alpha.4

## 0.2.2-alpha.3

### Patch Changes

- Updated dependencies [[`29c584a`](https://github.com/mastra-ai/mastra/commit/29c584a13a88831e5ed1fdeb0ff8e82eae180433)]:
  - @mastra/core@1.54.0-alpha.3
  - @mastra/code-sdk@1.1.0-alpha.3

## 0.2.2-alpha.2

### Patch Changes

- Changed the observational memory defaults a factory gets when you connect a provider: Google and DeepSeek now seed OM with their small, cheap model instead of the model you selected for the factory, matching what Anthropic and OpenAI already did. Providers without a cheap OM model keep using your selected model, and OM models you already set are still left untouched. ([#20298](https://github.com/mastra-ai/mastra/pull/20298))

- Updated dependencies [[`a211d09`](https://github.com/mastra-ai/mastra/commit/a211d09185dc65a746534914cf38b67f21ee9bac), [`f014c26`](https://github.com/mastra-ai/mastra/commit/f014c26f3445118b684e286ee5819b46dfa943a0), [`05db566`](https://github.com/mastra-ai/mastra/commit/05db566fcbdcbf33d0bffca0c72ec30129e2e3ca), [`8dadb6a`](https://github.com/mastra-ai/mastra/commit/8dadb6abfe449b7f8b129663671cc614f2cceeef), [`8124754`](https://github.com/mastra-ai/mastra/commit/8124754ae89fbc69f8136d1df4a91904d0f84c4e)]:
  - @mastra/core@1.54.0-alpha.2
  - @mastra/code-sdk@1.1.0-alpha.2

## 0.2.2-alpha.1

### Patch Changes

- Observational-memory settings no longer fail with "No session for resourceId" on the settings page: OM config routes now treat the live session as best-effort sync and fall back to the durably stored per-user settings when no agent-controller session exists for the resource (e.g. after a server restart), so settings load and save instead of 404ing ([#20265](https://github.com/mastra-ai/mastra/pull/20265))

- Fixed session creation ignoring an exact thread id when the session was already live. Requesting a session with a threadId now resumes or creates that exact thread even when another request (like an event subscription or message listing) created the session first, preventing 'Thread not found' errors for workspace threads. ([#20265](https://github.com/mastra-ai/mastra/pull/20265))

- Fixed Factory sessions failing to start their kickoff run. Workspaces now recover automatically when the sandbox provider changes or a sandbox is wiped (the repository is re-cloned instead of failing), thread pages surface workspace preparation errors with a Retry button instead of hanging, and kickoff messages are now delivered to the session thread instead of silently failing with a permissions error. ([#20265](https://github.com/mastra-ai/mastra/pull/20265))

- The factory-review skill now publishes its verdict on the pull request itself (gh pr review --approve / --request-changes with the full handoff body, falling back to a PR comment when GitHub rejects the review) instead of only posting the verdict in the Factory thread ([#20265](https://github.com/mastra-ai/mastra/pull/20265))

- Allow signed-out Factory pages to load their web app manifest and icon. ([#20246](https://github.com/mastra-ai/mastra/pull/20246))

- Speed up Factory hot paths: ([#20261](https://github.com/mastra-ai/mastra/pull/20261))

  - Much lower latency on authenticated requests — successful auth verifications are cached briefly instead of hitting the platform on every request, and credential verification requests time out after 15 seconds instead of hanging
  - Faster GitHub repository listing and connecting
  - Opening the same session concurrently no longer provisions duplicate sandboxes, and stuck sandbox commands now fail with a clear error instead of hanging
  - Factory run dispatching stays fast as work-item history grows

- Updated dependencies [[`ce93a3c`](https://github.com/mastra-ai/mastra/commit/ce93a3c114ea1cbfbd576f3db41d7c26c9844f5b), [`5718a22`](https://github.com/mastra-ai/mastra/commit/5718a229281dcfd36bcd1f42a242e3717e510a33), [`5807d3a`](https://github.com/mastra-ai/mastra/commit/5807d3ae1d259b8b7d6df7e5bf2b485c694af9c8), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`5718a22`](https://github.com/mastra-ai/mastra/commit/5718a229281dcfd36bcd1f42a242e3717e510a33), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`d1b7e3a`](https://github.com/mastra-ai/mastra/commit/d1b7e3a978a309a5653eeaa490d2d6c7c53bd093), [`c093146`](https://github.com/mastra-ai/mastra/commit/c0931466404d3c521308ea119cb165bb7e695155), [`2624b7e`](https://github.com/mastra-ai/mastra/commit/2624b7ecad926028e3cbc9a5e843f5624c67302e)]:
  - @mastra/core@1.54.0-alpha.1
  - @mastra/auth-studio@1.3.3-alpha.0
  - @mastra/code-sdk@1.0.3-alpha.1

## 0.2.2-alpha.0

### Patch Changes

- Updated dependencies [[`0dca9d0`](https://github.com/mastra-ai/mastra/commit/0dca9d0b1356024a53b72ea6f040db528b126caa)]:
  - @mastra/core@1.54.0-alpha.0
  - @mastra/code-sdk@1.0.3-alpha.0

## 0.2.1

### Patch Changes

- Removed Git and GitHub route locking that held database transactions open during sandbox and network operations. ([#20135](https://github.com/mastra-ai/mastra/pull/20135))

- Improved Platform GitHub event polling efficiency and added event-count and latency logging for each poll. ([#20123](https://github.com/mastra-ai/mastra/pull/20123))

- Bound the `withProjectLock` / `withDbAdvisoryLock` critical section with an `AbortSignal` timeout (default 60s, configurable via `timeoutMs`). Previously, an unbounded outbound call inside the lock could keep the transaction open for up to Neon's `idle_in_transaction_session_timeout` (5 minutes), pinning the pool connection and the advisory lock the entire time. On timeout the wrapper aborts the `fn`'s signal, rolls the transaction back, releases the connection, and throws `ProjectLockTimeoutError`. ([#20129](https://github.com/mastra-ai/mastra/pull/20129))

- Improved Factory work-item concurrency by replacing distributed advisory locks with atomic claims, idempotent replay, and serializable relationship transactions. ([#20135](https://github.com/mastra-ai/mastra/pull/20135))

- Fixed the workspace files panel in Factory web returning "Path is outside the browsable root" for Factory sessions. The workspace file endpoints now recognize a session id, reattach to that session's sandbox, and list and read rendered files (like .artifacts) directly from the sandbox, so session artifacts render on deployed factories. ([#20101](https://github.com/mastra-ai/mastra/pull/20101))

- Added an updateIssue capability to the Intake surface so Factory can change the state of external issues (open/closed on GitHub, workflow state on Linear) as a side effect of stage transitions. Adapters cover the direct GitHub, direct Linear, platform GitHub, and platform Linear integrations. GitHub adapters reject pull-request targets. Linear adapters resolve the target workflow state per team and skip when the issue is already in the desired state. The platform Linear adapter degrades to a no-op (returns null) when the platform workflow-states endpoint is not yet deployed, so this change is safe to ship ahead of the platform companion route. This is a plumbing change: no rule currently emits the new decision, so behavior is unchanged. ([#20111](https://github.com/mastra-ai/mastra/pull/20111))

- Fixed Factory integrations so GitHub and Linear attach their own event rules. This restores work-item rule ingestion for Platform-backed Linear intake and for the Platform GitHub issue poller. ([#20169](https://github.com/mastra-ai/mastra/pull/20169))

- Updated dependencies [[`c8d8a01`](https://github.com/mastra-ai/mastra/commit/c8d8a010ee2efe2b7bf4d07707382c34c87b14e4), [`f497717`](https://github.com/mastra-ai/mastra/commit/f497717304ad76043f689711ccc044f0cd51ba41), [`df6a9ce`](https://github.com/mastra-ai/mastra/commit/df6a9ce87214f7aadb2edfe62f67605fe998a0a4), [`73839cb`](https://github.com/mastra-ai/mastra/commit/73839cb58322679c170627d1015669ede5f619aa), [`371cf60`](https://github.com/mastra-ai/mastra/commit/371cf6075cef88ac6919a08d59a82e485397364a), [`8e4dc79`](https://github.com/mastra-ai/mastra/commit/8e4dc793dcf035ea506f9ce79f56d2d501a4be14), [`2db93cc`](https://github.com/mastra-ai/mastra/commit/2db93ccd0b872e4de7853a93383efe0647901df8), [`094ab61`](https://github.com/mastra-ai/mastra/commit/094ab6129a1a3ecf6eeb86decac17d5faea4e02a), [`fe80944`](https://github.com/mastra-ai/mastra/commit/fe80944f3ef6681fea6eae8200fce387b7bb3c2f), [`cadd3a2`](https://github.com/mastra-ai/mastra/commit/cadd3a276f8e0026e3c84cffe935538419cb890c), [`263d2ca`](https://github.com/mastra-ai/mastra/commit/263d2cac80ba3b03b9c0f008db6f1f1b9eb0278c), [`75f843d`](https://github.com/mastra-ai/mastra/commit/75f843d09f758223e6eeb321321bdcc5c7e779d0), [`e51e166`](https://github.com/mastra-ai/mastra/commit/e51e166c52e220abc9b64554ce37359dca8544b1)]:
  - @mastra/core@1.53.0
  - @mastra/code-sdk@1.0.2

## 0.2.1-alpha.4

### Patch Changes

- Removed Git and GitHub route locking that held database transactions open during sandbox and network operations. ([#20135](https://github.com/mastra-ai/mastra/pull/20135))

- Improved Factory work-item concurrency by replacing distributed advisory locks with atomic claims, idempotent replay, and serializable relationship transactions. ([#20135](https://github.com/mastra-ai/mastra/pull/20135))

- Fixed Factory integrations so GitHub and Linear attach their own event rules. This restores work-item rule ingestion for Platform-backed Linear intake and for the Platform GitHub issue poller. ([#20169](https://github.com/mastra-ai/mastra/pull/20169))

- Updated dependencies [[`f497717`](https://github.com/mastra-ai/mastra/commit/f497717304ad76043f689711ccc044f0cd51ba41), [`73839cb`](https://github.com/mastra-ai/mastra/commit/73839cb58322679c170627d1015669ede5f619aa), [`8e4dc79`](https://github.com/mastra-ai/mastra/commit/8e4dc793dcf035ea506f9ce79f56d2d501a4be14), [`2db93cc`](https://github.com/mastra-ai/mastra/commit/2db93ccd0b872e4de7853a93383efe0647901df8), [`094ab61`](https://github.com/mastra-ai/mastra/commit/094ab6129a1a3ecf6eeb86decac17d5faea4e02a), [`fe80944`](https://github.com/mastra-ai/mastra/commit/fe80944f3ef6681fea6eae8200fce387b7bb3c2f), [`e51e166`](https://github.com/mastra-ai/mastra/commit/e51e166c52e220abc9b64554ce37359dca8544b1)]:
  - @mastra/code-sdk@1.0.2-alpha.4
  - @mastra/core@1.53.0-alpha.4

## 0.2.1-alpha.3

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.53.0-alpha.3
  - @mastra/code-sdk@1.0.2-alpha.3

## 0.2.1-alpha.2

### Patch Changes

- Updated dependencies [[`75f843d`](https://github.com/mastra-ai/mastra/commit/75f843d09f758223e6eeb321321bdcc5c7e779d0)]:
  - @mastra/core@1.53.0-alpha.2
  - @mastra/code-sdk@1.0.2-alpha.2

## 0.2.1-alpha.1

### Patch Changes

- Updated dependencies [[`c8d8a01`](https://github.com/mastra-ai/mastra/commit/c8d8a010ee2efe2b7bf4d07707382c34c87b14e4), [`371cf60`](https://github.com/mastra-ai/mastra/commit/371cf6075cef88ac6919a08d59a82e485397364a), [`263d2ca`](https://github.com/mastra-ai/mastra/commit/263d2cac80ba3b03b9c0f008db6f1f1b9eb0278c)]:
  - @mastra/core@1.53.0-alpha.1
  - @mastra/code-sdk@1.0.2-alpha.1

## 0.2.1-alpha.0

### Patch Changes

- Improved Platform GitHub event polling efficiency and added event-count and latency logging for each poll. ([#20123](https://github.com/mastra-ai/mastra/pull/20123))

- Bound the `withProjectLock` / `withDbAdvisoryLock` critical section with an `AbortSignal` timeout (default 60s, configurable via `timeoutMs`). Previously, an unbounded outbound call inside the lock could keep the transaction open for up to Neon's `idle_in_transaction_session_timeout` (5 minutes), pinning the pool connection and the advisory lock the entire time. On timeout the wrapper aborts the `fn`'s signal, rolls the transaction back, releases the connection, and throws `ProjectLockTimeoutError`. ([#20129](https://github.com/mastra-ai/mastra/pull/20129))

- Fixed the workspace files panel in Factory web returning "Path is outside the browsable root" for Factory sessions. The workspace file endpoints now recognize a session id, reattach to that session's sandbox, and list and read rendered files (like .artifacts) directly from the sandbox, so session artifacts render on deployed factories. ([#20101](https://github.com/mastra-ai/mastra/pull/20101))

- Added an updateIssue capability to the Intake surface so Factory can change the state of external issues (open/closed on GitHub, workflow state on Linear) as a side effect of stage transitions. Adapters cover the direct GitHub, direct Linear, platform GitHub, and platform Linear integrations. GitHub adapters reject pull-request targets. Linear adapters resolve the target workflow state per team and skip when the issue is already in the desired state. The platform Linear adapter degrades to a no-op (returns null) when the platform workflow-states endpoint is not yet deployed, so this change is safe to ship ahead of the platform companion route. This is a plumbing change: no rule currently emits the new decision, so behavior is unchanged. ([#20111](https://github.com/mastra-ai/mastra/pull/20111))

- Updated dependencies [[`df6a9ce`](https://github.com/mastra-ai/mastra/commit/df6a9ce87214f7aadb2edfe62f67605fe998a0a4), [`cadd3a2`](https://github.com/mastra-ai/mastra/commit/cadd3a276f8e0026e3c84cffe935538419cb890c)]:
  - @mastra/core@1.52.2-alpha.0
  - @mastra/code-sdk@1.0.2-alpha.0

## 0.2.0

### Minor Changes

- Added guided model-provider setup to Factory onboarding with a recommended default model and provider-specific observational-memory defaults. ([#20079](https://github.com/mastra-ai/mastra/pull/20079))

### Patch Changes

- Renamed Mastra Factory server log prefix from "[MastraCode Web]" to "[Mastra Factory]" ([#20088](https://github.com/mastra-ai/mastra/pull/20088))

- Link Factory Review cards to their work item when a PR opens without recorded provenance. GitHub PR-opened ingress now falls back to matching the PR head branch against work item session branches, and Review intake records `headBranch`/`baseBranch` metadata so the board and session views can relate the cards. ([#20074](https://github.com/mastra-ai/mastra/pull/20074))

- Fixed board-started work sessions to use the Factory's default coding model and persisted observational-memory settings. ([#20081](https://github.com/mastra-ai/mastra/pull/20081))

- Restored observational-memory settings so Factory users can choose models and preferences before opening a chat session. ([#20079](https://github.com/mastra-ai/mastra/pull/20079))

- Updated dependencies [[`55adddf`](https://github.com/mastra-ai/mastra/commit/55adddfda2a170b00c112bf37d677e8ce5b65d5a)]:
  - @mastra/core@1.52.1
  - @mastra/code-sdk@1.0.1

## 0.2.0-alpha.0

### Minor Changes

- Added guided model-provider setup to Factory onboarding with a recommended default model and provider-specific observational-memory defaults. ([#20079](https://github.com/mastra-ai/mastra/pull/20079))

### Patch Changes

- Link Factory Review cards to their work item when a PR opens without recorded provenance. GitHub PR-opened ingress now falls back to matching the PR head branch against work item session branches, and Review intake records `headBranch`/`baseBranch` metadata so the board and session views can relate the cards. ([#20074](https://github.com/mastra-ai/mastra/pull/20074))

- Fixed board-started work sessions to use the Factory's default coding model and persisted observational-memory settings. ([#20081](https://github.com/mastra-ai/mastra/pull/20081))

- Restored observational-memory settings so Factory users can choose models and preferences before opening a chat session. ([#20079](https://github.com/mastra-ai/mastra/pull/20079))

- Updated dependencies [[`55adddf`](https://github.com/mastra-ai/mastra/commit/55adddfda2a170b00c112bf37d677e8ce5b65d5a)]:
  - @mastra/core@1.52.1-alpha.0
  - @mastra/code-sdk@1.0.1-alpha.0

## 0.1.0

### Minor Changes

- Move the Factory project CRUD and source-control connection routes into `@mastra/factory` as a `ProjectRoutes` class. The routes take their storage handles (`FactoryProjectsStorage`, `SourceControlStorage`), the allowed version-control integration ids, and a `RouteAuth` adapter at construction time, replacing the old `ProjectDomain` that resolved domains through the `FactoryStorage` registry. The now-unused `FactoryDomain` base class was removed from the web host. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the audit domain, agent git-action auditing, intake capabilities, and intake routes into `@mastra/factory`. `AuditDomain` now takes its storage handles (`AuditStorage`, `FactoryProjectsStorage`) and a `RouteAuth` adapter directly instead of resolving them through the factory storage registry, fans out to pluggable `AuditSink`s, and resolves agent tenants through an injected `agentTenant` callback. Intake routes ship as an `IntakeRoutes` class that calls `IntakeStorage` directly (the intermediate intake store module was removed). ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Added autonomous first-pass skills to the Software Factory. Work items now get an automatic investigation, planning, or review pass as soon as they enter the matching board column — no human input needed mid-run: ([#20058](https://github.com/mastra-ai/mastra/pull/20058))

  - **factory-triage** runs when an issue enters triage: it investigates the issue, diagnoses the root cause, and requests a move to planning (or done if the issue should be closed).
  - **factory-plan** runs when an item enters planning: it produces a phased implementation plan and requests a move to execute.
  - **factory-review** runs when a pull request enters review: it reviews the changes, posts a verdict, and requests completion.

  Instead of stopping to ask questions, the skills decide and record each decision as an assumption, batching assumptions and genuinely-human questions into one terminal handoff message. The superseded interactive skills (understand-issue, understand-pr) were removed.

- Move the `FactoryIntegration` contract and the OAuth `state` signer into `@mastra/factory`. The integration interface (routes, tools, diagnostics, intake/version-control capabilities, `IntegrationContext`) now lives at `@mastra/factory/integrations/base`, and `createStateSigner`/`StateSigner` at `@mastra/factory/state-signing`, so integrations can be implemented against the package without importing the web host. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Added the @mastra/factory package. It now owns the Software Factory storage domains (projects, work items, intake, audit, credentials, integrations, model packs, queue health, source control) that previously lived inside the mastracode web app, so they can be reused outside the web server. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Moved the server config routes and provider credential helpers into @mastra/factory as a reusable ConfigRoutes class. Route handlers now receive their auth checks through an injected RouteAuth seam and storage domains through constructor options, so hosts other than the Mastra Code web app can mount the same routes. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the Factory work-item (kanban board) routes into `@mastra/factory` as a `WorkItemRoutes` class. The routes take their storage handles (`WorkItemsStorage`, `FactoryProjectsStorage`, `QueueHealthStorage`), an `AuditEmitter`, and a `RouteAuth` adapter at construction time. The request-body validators (`parseCreateWorkItem`, `parseUpdateWorkItem`) now live with the routes, the pass-through work-item store module was removed in favor of calling `WorkItemsStorage` directly, and `computeFactoryMetrics` takes a single object parameter. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

### Patch Changes

- Move the WorkOS audit integration into `@mastra/factory/integrations/workos`. Its Admin Portal route now resolves the caller through the `RouteAuth` seam on `IntegrationContext` instead of web-host auth helpers, and `@mastra/auth-workos` becomes a package dependency. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the factory auth module into `@mastra/factory/auth`. The provider-neutral ([#19866](https://github.com/mastra-ai/mastra/pull/19866))
  auth gating (`mountFactoryAuth`, `buildAuthRoutes`, `createFactoryAuthGate`),
  the `RouteAuth` implementation (`createFactoryRouteAuth`), and the WorkOS/SSO
  helpers now live next to the route seam they implement, with factory naming
  throughout.

- The Factory's default `publicUrl` is now `http://localhost:4111` (the Factory server, which serves both the UI and the API) instead of `http://localhost:5173`. Generated Factory projects now run from a single server, so OAuth callback URLs and auth redirects derived from `publicUrl` point at the right origin out of the box. If you serve the SPA from a separate origin (for example a Vite dev server on :5173), set `publicUrl` (or `MASTRACODE_PUBLIC_URL`) explicitly. ([#20036](https://github.com/mastra-ai/mastra/pull/20036))

- Factory board now picks up new GitHub/Linear intake automatically (gentle 30s poll) and refreshes work-item positions immediately when the tab regains focus, instead of requiring a manual page reload ([#20071](https://github.com/mastra-ai/mastra/pull/20071))

- Fixed GitHub PATs saved in Settings not taking effect for the gh CLI in already-running Factory sessions until the server was restarted ([#20069](https://github.com/mastra-ai/mastra/pull/20069))

- Forwarded closed Platform GitHub event-log deliveries into Factory governance before dispatching repository subscriptions, and kept default GitHub rules from auto-starting issues or pull requests created before the Factory. ([#19988](https://github.com/mastra-ai/mastra/pull/19988))

- Track per-stage automation in Factory metrics. Stage history now stamps the exiting actor (`exitedBy`) alongside the entering one, `isAutomationActor` classifies rules-engine, agent (`agent:*`), and webhook (`github:*`) actors as automation, and `computeFactoryMetrics` reports a `stageAutomation` breakdown per stage: how many passes were fully automated (entered and exited by automation on the first visit) and how those automated passes ended up (`done`, `canceled`, `reworked`, or still in flight). Adds the `canceled` terminal stage to the board vocabulary (`FACTORY_RULE_STAGES`) — a tracked non-completion that feeds neither throughput nor cycle time — and rewords organization-required errors to be auth-provider neutral. ([#19844](https://github.com/mastra-ai/mastra/pull/19844))

- Fixed @mastra/factory build output so published modules use explicit .js import extensions and resolve correctly under Node ESM ([#19954](https://github.com/mastra-ai/mastra/pull/19954))

- Deployed factories now authenticate API and Studio requests with the same provider, so Studio sessions work without extra configuration. ([#19966](https://github.com/mastra-ai/mastra/pull/19966))

- Fixed Factory metrics windowing to use inclusive UTC calendar days. Date-only `from`/`to` bounds now include both selected days, an item completing at the current instant is counted in today's throughput (previously it could be dropped on the window's exclusive edge), and `windowDays` reflects the number of gap-filled day buckets. Cards feed the source mix only when created inside the window. ([#19971](https://github.com/mastra-ai/mastra/pull/19971))

- Fixed duplicate repositories in Factory source control settings. ([#19971](https://github.com/mastra-ai/mastra/pull/19971))

- Move the API-surface assembler from mastracode/web into @mastra/factory as `routes/surface` — `assembleWebApiRoutes` is now `assembleFactoryApiRoutes` and `WebApiRoutesDeps` is now `FactoryApiRoutesDeps`. The module composes fs/config/oauth/skills/intake/work-item routes plus every registered integration's route surface (with disabled-status stubs for absent github/linear integrations) from explicitly threaded dependency handles. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the GitHub integration and the sandbox fleet into `@mastra/factory`. The fleet is now a DI-constructed `SandboxFleet` class (`@mastra/factory/sandbox/fleet`) that owns provisioning, reattach, teardown, idle windows, and per-replica budgets instead of reading a seeded runtime-config registry. The GitHub routes, webhook, sandbox materialization, project locks, and session subscriptions (`@mastra/factory/integrations/github`) resolve tenants through the `RouteAuth` seam and receive the fleet and factory storage via `IntegrationContext`, so the web host no longer exports `getSeededSandbox`/`getSeededGithubIntegration` service locators. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the filesystem routes (`@mastra/factory/routes/fs`) and skill routes (`@mastra/factory/routes/skills`) into `@mastra/factory`. The skill prepare/invoke routes are now a `SkillRoutes` class that resolves users and tenants through the `RouteAuth` seam instead of web-host auth helpers. Diagnostics fields exposed by the GitHub and Linear integrations rename `webAuthEnabled` to `factoryAuthEnabled` to match the package's auth seam naming. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Moved custom model providers and custom model packs off settings.json in the factory web app: both now live in the app database (org-scoped rows in deployed mode, a sentinel local scope in no-auth mode). Custom providers saved in the web settings page are picked up by model resolution and the model catalog through a new pluggable custom-providers source in the SDK, so the gateway no longer reads the host machine's settings.json for them, and models from your custom providers appear in the web model pickers. ([#19964](https://github.com/mastra-ai/mastra/pull/19964))

  Hosts that store custom providers elsewhere (like the factory's database) register a source at boot; when none is registered, the SDK keeps reading settings.json as before:

  ```ts
  import { setCustomProvidersSource } from '@mastra/code-sdk/agents/custom-provider-source';

  setCustomProvidersSource(tenant => (tenant ? snapshotForOrg(tenant.orgId) : []));
  ```

- Fixed cloned session threads reading from a previous storage instance. The dynamic memory cache now invalidates when the storage or vector instance changes, so thread cloning always uses the current database. ([#19966](https://github.com/mastra-ai/mastra/pull/19966))

- Added a memory-settings storage domain: observational memory settings (observer and reflector models, thresholds, attachment observation) changed in the web app are now stored in the app database — one row per user — instead of settings.json, and the settings page reads them back from the database. Factory-mounted agent controllers no longer seed observational memory settings from the host machine's settings.json (new `disableSettingsOmSeed` SDK option), so server sessions start from built-in defaults plus whatever is stored in the database. The OM settings model pickers in the web UI are now searchable comboboxes. ([#19964](https://github.com/mastra-ai/mastra/pull/19964))

  Server embedders that persist memory settings in their own database can opt out of the settings.json seed:

  ```ts
  import { createMastraCode } from '@mastra/code-sdk';

  const mastraCode = await createMastraCode({
    cwd: process.cwd(),
    // Don't seed observer/reflector models or thresholds from the host
    // machine's settings.json — sessions start from built-in defaults.
    disableSettingsOmSeed: true,
  });
  ```

- Move the Linear integration into `@mastra/factory/integrations/linear`. `LinearIntegration` now owns the full connection lifecycle (OAuth token exchange, single-flight refresh, scope checks, and connection caching) as class methods, the routes and agent tools resolve tenants through the `RouteAuth` seam instead of web-host auth imports, and the `getSeededIntegration` runtime-config indirection is gone — the host hands the integration instance and storage handles directly via `initialize()`. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Fixed Factory automation so polled GitHub events reach governance rules, authenticated sessions start with the correct ownership, and board moves reliably notify active or idle agents. ([#19979](https://github.com/mastra-ai/mastra/pull/19979))

- Move the `MastraFactory` assembly root into `@mastra/factory`. `factory-entry.ts` now lives at the package root export (`@mastra/factory`), alongside the extracted `workspace`, `spa-static`, `server-error`, and `sandbox/reattach` helpers. Factory skills ship with the package and are copied into deploy output via the consuming app's build script. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Fixed web chat sessions getting stuck in a "Connection lost — reconnecting…" loop while the session workspace was still starting up ([#20067](https://github.com/mastra-ai/mastra/pull/20067))

- Fixed a server startup crash when the factory's storage backend could not be recognized by the SDK. The factory now tells the SDK explicitly whether its Mastra store is Postgres or LibSQL, so agent state wiring works even when the project's dependency graph contains duplicate copies of Mastra packages. ([#20030](https://github.com/mastra-ai/mastra/pull/20030))

- Updated dependencies [[`a4d7c7d`](https://github.com/mastra-ai/mastra/commit/a4d7c7d74f423efc73b3e4db8142478763e6989d), [`ec857fc`](https://github.com/mastra-ai/mastra/commit/ec857fc79c264b53b38e16478c789b7177f2ad59), [`41a5392`](https://github.com/mastra-ai/mastra/commit/41a5392d9f6c5e18d6b227f0fc0ddf49c50774e9), [`ec857fc`](https://github.com/mastra-ai/mastra/commit/ec857fc79c264b53b38e16478c789b7177f2ad59), [`d7385ad`](https://github.com/mastra-ai/mastra/commit/d7385ad9e88f9e4f33d15c0ec0bfebedde0cbc2e), [`41a5392`](https://github.com/mastra-ai/mastra/commit/41a5392d9f6c5e18d6b227f0fc0ddf49c50774e9), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`1426af2`](https://github.com/mastra-ai/mastra/commit/1426af24975879c000d13ac75673f630fcc970c1), [`a40adeb`](https://github.com/mastra-ai/mastra/commit/a40adeb222b961a56a58af56a106106525721b74), [`8a0d145`](https://github.com/mastra-ai/mastra/commit/8a0d145aadbdf7278665aceaaec364b35dd9bd94), [`bd2f1d2`](https://github.com/mastra-ai/mastra/commit/bd2f1d274d05e60e2366f005ea0d94d5cea0d5ff), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`d2a51c1`](https://github.com/mastra-ai/mastra/commit/d2a51c13c92c22f82bba8b4f48e746a2cc1aecdf), [`e1f2fae`](https://github.com/mastra-ai/mastra/commit/e1f2faebaf048c3d4c2e2c01d293767c195d5794), [`63aa799`](https://github.com/mastra-ai/mastra/commit/63aa799c6b44eacc7806cda6846b7c5bbee06b37), [`b7e79c3`](https://github.com/mastra-ai/mastra/commit/b7e79c3c02ac5cd415db34ba0975ceafc1464333), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`55b6ecd`](https://github.com/mastra-ai/mastra/commit/55b6ecd1083d21d00ea19488e721e451de75e76f), [`dfc7769`](https://github.com/mastra-ai/mastra/commit/dfc77695549e4434873051ddd1f6065330ed5ab8), [`da009e1`](https://github.com/mastra-ai/mastra/commit/da009e1aacd89ed94b8d1b2af09c9d4fe7c4db49), [`3b77e77`](https://github.com/mastra-ai/mastra/commit/3b77e7704936522e4769d29de1b5ea6901f302bd), [`c7d30cd`](https://github.com/mastra-ai/mastra/commit/c7d30cd86009c407df91105591f03cd6e3d2854d), [`21a0eb8`](https://github.com/mastra-ai/mastra/commit/21a0eb86746ba0b703acea360d4f84c6a5a493f2), [`8b20926`](https://github.com/mastra-ai/mastra/commit/8b20926cd59e2ba3d66458e062fa0e6e2ada3e68), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`975295d`](https://github.com/mastra-ai/mastra/commit/975295d418552f0d46a59edfef4c3ee555f9930a), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`6b1bf3b`](https://github.com/mastra-ai/mastra/commit/6b1bf3b9494bd51aa8f654c68c9355d6046fa2a1), [`35c2181`](https://github.com/mastra-ai/mastra/commit/35c2181e6a50e47c90ba36260db7c9723d54696f), [`0a2c22c`](https://github.com/mastra-ai/mastra/commit/0a2c22c902604439ec490319e14c17f331e0c84c), [`cc656b9`](https://github.com/mastra-ai/mastra/commit/cc656b92cc8fe40af3e2ea8bb796a6b406e96791), [`4cfdd64`](https://github.com/mastra-ai/mastra/commit/4cfdd645794feaea0c4ea711e70ecdfbef0c5b8e), [`232fcbc`](https://github.com/mastra-ai/mastra/commit/232fcbc14fce625dd672ba043329c0b732c62be2), [`b75d749`](https://github.com/mastra-ai/mastra/commit/b75d749621ff5d17e86bcb4ee809d301fb4f7cf3), [`821648b`](https://github.com/mastra-ai/mastra/commit/821648bf2871ef840100c7bacbecf676010bd12a), [`de86fd7`](https://github.com/mastra-ai/mastra/commit/de86fd7119f0438381d1a642e3d258143c0b9c29), [`d2a51c1`](https://github.com/mastra-ai/mastra/commit/d2a51c13c92c22f82bba8b4f48e746a2cc1aecdf), [`2745031`](https://github.com/mastra-ai/mastra/commit/2745031d1d4a4978f037092da371428c32e2842a), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`cc656b9`](https://github.com/mastra-ai/mastra/commit/cc656b92cc8fe40af3e2ea8bb796a6b406e96791), [`ef03fbc`](https://github.com/mastra-ai/mastra/commit/ef03fbcc556bcbc04c9b3d06fab88771ecaa043c), [`3a8024c`](https://github.com/mastra-ai/mastra/commit/3a8024ce615f8aa89479c0d71fe61d10bb0040be), [`bb92559`](https://github.com/mastra-ai/mastra/commit/bb9255954be8323a5ecab7595fe5365c564b3f52), [`35865a5`](https://github.com/mastra-ai/mastra/commit/35865a53e194aa9634d6a70a97010e7a6b9d58b1), [`67dd8b5`](https://github.com/mastra-ai/mastra/commit/67dd8b594d8b87a3a4d4ca7659f57d89fe8312a6), [`f9717e4`](https://github.com/mastra-ai/mastra/commit/f9717e4a381500042d088577347a787b0ec8caff), [`74faf8b`](https://github.com/mastra-ai/mastra/commit/74faf8bd9c1018f2492653c06b1e25fc8300e9e6), [`ef03fbc`](https://github.com/mastra-ai/mastra/commit/ef03fbcc556bcbc04c9b3d06fab88771ecaa043c), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`70687f7`](https://github.com/mastra-ai/mastra/commit/70687f7e495a322a02070b4a67cb0c77a5ca91ec), [`1fadac4`](https://github.com/mastra-ai/mastra/commit/1fadac44537caeefe81f9f775ae2f2f3d94e9069), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`76b7181`](https://github.com/mastra-ai/mastra/commit/76b71810366e6d90b9d3973149d1c7ba3659ffb9), [`6341b72`](https://github.com/mastra-ai/mastra/commit/6341b720fa80e65731cbbd7d88d1088f4c5b9914), [`792ec9a`](https://github.com/mastra-ai/mastra/commit/792ec9a0869bab8274cf5e0ed2840738737a1607), [`85e4fb5`](https://github.com/mastra-ai/mastra/commit/85e4fb50087a81c74df3a762f53b56373db0b912), [`712b864`](https://github.com/mastra-ai/mastra/commit/712b864aa1ed12b14c54390ec17b69de163c37f7), [`85e4fb5`](https://github.com/mastra-ai/mastra/commit/85e4fb50087a81c74df3a762f53b56373db0b912), [`9bffb73`](https://github.com/mastra-ai/mastra/commit/9bffb73e9ea46f48b53205b35a69a57f70912c78), [`0c0e8d7`](https://github.com/mastra-ai/mastra/commit/0c0e8d7becd4d1445c656b78d5d845f606c1ff9d), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`eec6a54`](https://github.com/mastra-ai/mastra/commit/eec6a54c64cd365c9b75c14a02e32122ad5f657c), [`72e437c`](https://github.com/mastra-ai/mastra/commit/72e437c515942c80b9def5b026e0bdee61b469d9), [`8f7a5de`](https://github.com/mastra-ai/mastra/commit/8f7a5dedc246cdc938bb65516703cf9b27b03756), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`11f6cd9`](https://github.com/mastra-ai/mastra/commit/11f6cd96fe42582403416608beb212cc1a2cc79e), [`337d41d`](https://github.com/mastra-ai/mastra/commit/337d41d8aae0399d2bf42d42ebddac0c21953891), [`ef03c0c`](https://github.com/mastra-ai/mastra/commit/ef03c0cfc62367a458e4cc56462e2148b35681c5), [`4fb4d88`](https://github.com/mastra-ai/mastra/commit/4fb4d881bc107acee13890ad4d78661016c510ed), [`da009e1`](https://github.com/mastra-ai/mastra/commit/da009e1aacd89ed94b8d1b2af09c9d4fe7c4db49), [`4e68363`](https://github.com/mastra-ai/mastra/commit/4e683634f94ebd062d26a3bb6093a8dfc7263d37), [`c328769`](https://github.com/mastra-ai/mastra/commit/c3287698ff8ef98dba86d415faa566fa3e5f4d56), [`eec6a54`](https://github.com/mastra-ai/mastra/commit/eec6a54c64cd365c9b75c14a02e32122ad5f657c), [`d7f5f9e`](https://github.com/mastra-ai/mastra/commit/d7f5f9e5d76ed588842bce30fac076ec9e3ad98a), [`9f7c67a`](https://github.com/mastra-ai/mastra/commit/9f7c67abeeb52c41c51a9b5edee60b62afe7cd8d), [`c46bb46`](https://github.com/mastra-ai/mastra/commit/c46bb461636ce3a8d45ecd7fc5d4a58803360cd0), [`3b65e68`](https://github.com/mastra-ai/mastra/commit/3b65e68d7f1c771c7a70eea42d83fefdd28cad88), [`4eba27a`](https://github.com/mastra-ai/mastra/commit/4eba27adcf60f991df0e62f94b3e75b4e67f3b4b), [`c701be3`](https://github.com/mastra-ai/mastra/commit/c701be32d7d9aa94a66da8c6cc38dcac6856f464), [`db650ce`](https://github.com/mastra-ai/mastra/commit/db650ce490348914e85b93651d83acdf8f2a4c31), [`232fcbc`](https://github.com/mastra-ai/mastra/commit/232fcbc14fce625dd672ba043329c0b732c62be2), [`6354eeb`](https://github.com/mastra-ai/mastra/commit/6354eeb32efa9f5f68f51dda394e90e2ee76f1fb), [`a8799bb`](https://github.com/mastra-ai/mastra/commit/a8799bb8e44f4a60d01e4e2acd3448ff80bf14f8), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`e3868e2`](https://github.com/mastra-ai/mastra/commit/e3868e22babfffd0133771669ca724501c2dd58e), [`b06a569`](https://github.com/mastra-ai/mastra/commit/b06a56958d683e45574d2e3806dca42db5fe8a7a), [`9251370`](https://github.com/mastra-ai/mastra/commit/9251370ad413af464aa22d7566338bec5613e8de), [`b87e4ca`](https://github.com/mastra-ai/mastra/commit/b87e4cad9acf70e58c1559da0ca3640d5ae25e6e), [`3491666`](https://github.com/mastra-ai/mastra/commit/34916663c4fdd43b48c21f4ab2d5fb6dcccc94f9), [`c0bec73`](https://github.com/mastra-ai/mastra/commit/c0bec732c93d1a22ae5e51ed66cf8cacca8bd6a6)]:
  - @mastra/auth-workos@1.6.4
  - @mastra/code-sdk@1.0.0
  - @mastra/core@1.52.0
  - @mastra/auth-studio@1.3.2

## 0.1.0-alpha.10

### Patch Changes

- Factory board now picks up new GitHub/Linear intake automatically (gentle 30s poll) and refreshes work-item positions immediately when the tab regains focus, instead of requiring a manual page reload ([#20071](https://github.com/mastra-ai/mastra/pull/20071))

## 0.1.0-alpha.9

### Patch Changes

- Fixed GitHub PATs saved in Settings not taking effect for the gh CLI in already-running Factory sessions until the server was restarted ([#20069](https://github.com/mastra-ai/mastra/pull/20069))

- Fixed web chat sessions getting stuck in a "Connection lost — reconnecting…" loop while the session workspace was still starting up ([#20067](https://github.com/mastra-ai/mastra/pull/20067))

## 0.1.0-alpha.8

### Minor Changes

- Added autonomous first-pass skills to the Software Factory. Work items now get an automatic investigation, planning, or review pass as soon as they enter the matching board column — no human input needed mid-run: ([#20058](https://github.com/mastra-ai/mastra/pull/20058))

  - **factory-triage** runs when an issue enters triage: it investigates the issue, diagnoses the root cause, and requests a move to planning (or done if the issue should be closed).
  - **factory-plan** runs when an item enters planning: it produces a phased implementation plan and requests a move to execute.
  - **factory-review** runs when a pull request enters review: it reviews the changes, posts a verdict, and requests completion.

  Instead of stopping to ask questions, the skills decide and record each decision as an assumption, batching assumptions and genuinely-human questions into one terminal handoff message. The superseded interactive skills (understand-issue, understand-pr) were removed.

## 0.1.0-alpha.7

### Patch Changes

- Updated dependencies:
  - @mastra/code-sdk@1.0.0-alpha.18

## 0.1.0-alpha.6

### Patch Changes

- The Factory's default `publicUrl` is now `http://localhost:4111` (the Factory server, which serves both the UI and the API) instead of `http://localhost:5173`. Generated Factory projects now run from a single server, so OAuth callback URLs and auth redirects derived from `publicUrl` point at the right origin out of the box. If you serve the SPA from a separate origin (for example a Vite dev server on :5173), set `publicUrl` (or `MASTRACODE_PUBLIC_URL`) explicitly. ([#20036](https://github.com/mastra-ai/mastra/pull/20036))

## 0.1.0-alpha.5

### Patch Changes

- Fixed a server startup crash when the factory's storage backend could not be recognized by the SDK. The factory now tells the SDK explicitly whether its Mastra store is Postgres or LibSQL, so agent state wiring works even when the project's dependency graph contains duplicate copies of Mastra packages. ([#20030](https://github.com/mastra-ai/mastra/pull/20030))

- Updated dependencies [[`b06a569`](https://github.com/mastra-ai/mastra/commit/b06a56958d683e45574d2e3806dca42db5fe8a7a)]:
  - @mastra/code-sdk@1.0.0-alpha.17

## 0.1.0-alpha.4

### Patch Changes

- Moved custom model providers and custom model packs off settings.json in the factory web app: both now live in the app database (org-scoped rows in deployed mode, a sentinel local scope in no-auth mode). Custom providers saved in the web settings page are picked up by model resolution and the model catalog through a new pluggable custom-providers source in the SDK, so the gateway no longer reads the host machine's settings.json for them, and models from your custom providers appear in the web model pickers. ([#19964](https://github.com/mastra-ai/mastra/pull/19964))

  Hosts that store custom providers elsewhere (like the factory's database) register a source at boot; when none is registered, the SDK keeps reading settings.json as before:

  ```ts
  import { setCustomProvidersSource } from '@mastra/code-sdk/agents/custom-provider-source';

  setCustomProvidersSource(tenant => (tenant ? snapshotForOrg(tenant.orgId) : []));
  ```

- Added a memory-settings storage domain: observational memory settings (observer and reflector models, thresholds, attachment observation) changed in the web app are now stored in the app database — one row per user — instead of settings.json, and the settings page reads them back from the database. Factory-mounted agent controllers no longer seed observational memory settings from the host machine's settings.json (new `disableSettingsOmSeed` SDK option), so server sessions start from built-in defaults plus whatever is stored in the database. The OM settings model pickers in the web UI are now searchable comboboxes. ([#19964](https://github.com/mastra-ai/mastra/pull/19964))

  Server embedders that persist memory settings in their own database can opt out of the settings.json seed:

  ```ts
  import { createMastraCode } from '@mastra/code-sdk';

  const mastraCode = await createMastraCode({
    cwd: process.cwd(),
    // Don't seed observer/reflector models or thresholds from the host
    // machine's settings.json — sessions start from built-in defaults.
    disableSettingsOmSeed: true,
  });
  ```

- Updated dependencies [[`eec6a54`](https://github.com/mastra-ai/mastra/commit/eec6a54c64cd365c9b75c14a02e32122ad5f657c), [`eec6a54`](https://github.com/mastra-ai/mastra/commit/eec6a54c64cd365c9b75c14a02e32122ad5f657c)]:
  - @mastra/code-sdk@1.0.0-alpha.16
  - @mastra/core@1.52.0-alpha.13

## 0.1.0-alpha.3

### Patch Changes

- Forwarded closed Platform GitHub event-log deliveries into Factory governance before dispatching repository subscriptions, and kept default GitHub rules from auto-starting issues or pull requests created before the Factory. ([#19988](https://github.com/mastra-ai/mastra/pull/19988))

- Deployed factories now authenticate API and Studio requests with the same provider, so Studio sessions work without extra configuration. ([#19966](https://github.com/mastra-ai/mastra/pull/19966))

- Fixed cloned session threads reading from a previous storage instance. The dynamic memory cache now invalidates when the storage or vector instance changes, so thread cloning always uses the current database. ([#19966](https://github.com/mastra-ai/mastra/pull/19966))

- Updated dependencies [[`cc656b9`](https://github.com/mastra-ai/mastra/commit/cc656b92cc8fe40af3e2ea8bb796a6b406e96791), [`cc656b9`](https://github.com/mastra-ai/mastra/commit/cc656b92cc8fe40af3e2ea8bb796a6b406e96791), [`337d41d`](https://github.com/mastra-ai/mastra/commit/337d41d8aae0399d2bf42d42ebddac0c21953891)]:
  - @mastra/code-sdk@1.0.0-alpha.15

## 0.1.0-alpha.2

### Patch Changes

- Fixed Factory metrics windowing to use inclusive UTC calendar days. Date-only `from`/`to` bounds now include both selected days, an item completing at the current instant is counted in today's throughput (previously it could be dropped on the window's exclusive edge), and `windowDays` reflects the number of gap-filled day buckets. Cards feed the source mix only when created inside the window. ([#19971](https://github.com/mastra-ai/mastra/pull/19971))

- Fixed duplicate repositories in Factory source control settings. ([#19971](https://github.com/mastra-ai/mastra/pull/19971))

- Fixed Factory automation so polled GitHub events reach governance rules, authenticated sessions start with the correct ownership, and board moves reliably notify active or idle agents. ([#19979](https://github.com/mastra-ai/mastra/pull/19979))

## 0.1.0-alpha.1

### Minor Changes

- Move the Factory project CRUD and source-control connection routes into `@mastra/factory` as a `ProjectRoutes` class. The routes take their storage handles (`FactoryProjectsStorage`, `SourceControlStorage`), the allowed version-control integration ids, and a `RouteAuth` adapter at construction time, replacing the old `ProjectDomain` that resolved domains through the `FactoryStorage` registry. The now-unused `FactoryDomain` base class was removed from the web host. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the audit domain, agent git-action auditing, intake capabilities, and intake routes into `@mastra/factory`. `AuditDomain` now takes its storage handles (`AuditStorage`, `FactoryProjectsStorage`) and a `RouteAuth` adapter directly instead of resolving them through the factory storage registry, fans out to pluggable `AuditSink`s, and resolves agent tenants through an injected `agentTenant` callback. Intake routes ship as an `IntakeRoutes` class that calls `IntakeStorage` directly (the intermediate intake store module was removed). ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the `FactoryIntegration` contract and the OAuth `state` signer into `@mastra/factory`. The integration interface (routes, tools, diagnostics, intake/version-control capabilities, `IntegrationContext`) now lives at `@mastra/factory/integrations/base`, and `createStateSigner`/`StateSigner` at `@mastra/factory/state-signing`, so integrations can be implemented against the package without importing the web host. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Added the @mastra/factory package. It now owns the Software Factory storage domains (projects, work items, intake, audit, credentials, integrations, model packs, queue health, source control) that previously lived inside the mastracode web app, so they can be reused outside the web server. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Moved the server config routes and provider credential helpers into @mastra/factory as a reusable ConfigRoutes class. Route handlers now receive their auth checks through an injected RouteAuth seam and storage domains through constructor options, so hosts other than the Mastra Code web app can mount the same routes. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the Factory work-item (kanban board) routes into `@mastra/factory` as a `WorkItemRoutes` class. The routes take their storage handles (`WorkItemsStorage`, `FactoryProjectsStorage`, `QueueHealthStorage`), an `AuditEmitter`, and a `RouteAuth` adapter at construction time. The request-body validators (`parseCreateWorkItem`, `parseUpdateWorkItem`) now live with the routes, the pass-through work-item store module was removed in favor of calling `WorkItemsStorage` directly, and `computeFactoryMetrics` takes a single object parameter. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

### Patch Changes

- Move the WorkOS audit integration into `@mastra/factory/integrations/workos`. Its Admin Portal route now resolves the caller through the `RouteAuth` seam on `IntegrationContext` instead of web-host auth helpers, and `@mastra/auth-workos` becomes a package dependency. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the factory auth module into `@mastra/factory/auth`. The provider-neutral ([#19866](https://github.com/mastra-ai/mastra/pull/19866))
  auth gating (`mountFactoryAuth`, `buildAuthRoutes`, `createFactoryAuthGate`),
  the `RouteAuth` implementation (`createFactoryRouteAuth`), and the WorkOS/SSO
  helpers now live next to the route seam they implement, with factory naming
  throughout.

- Track per-stage automation in Factory metrics. Stage history now stamps the exiting actor (`exitedBy`) alongside the entering one, `isAutomationActor` classifies rules-engine, agent (`agent:*`), and webhook (`github:*`) actors as automation, and `computeFactoryMetrics` reports a `stageAutomation` breakdown per stage: how many passes were fully automated (entered and exited by automation on the first visit) and how those automated passes ended up (`done`, `canceled`, `reworked`, or still in flight). Adds the `canceled` terminal stage to the board vocabulary (`FACTORY_RULE_STAGES`) — a tracked non-completion that feeds neither throughput nor cycle time — and rewords organization-required errors to be auth-provider neutral. ([#19844](https://github.com/mastra-ai/mastra/pull/19844))

- Fixed @mastra/factory build output so published modules use explicit .js import extensions and resolve correctly under Node ESM ([#19954](https://github.com/mastra-ai/mastra/pull/19954))

- Move the API-surface assembler from mastracode/web into @mastra/factory as `routes/surface` — `assembleWebApiRoutes` is now `assembleFactoryApiRoutes` and `WebApiRoutesDeps` is now `FactoryApiRoutesDeps`. The module composes fs/config/oauth/skills/intake/work-item routes plus every registered integration's route surface (with disabled-status stubs for absent github/linear integrations) from explicitly threaded dependency handles. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the GitHub integration and the sandbox fleet into `@mastra/factory`. The fleet is now a DI-constructed `SandboxFleet` class (`@mastra/factory/sandbox/fleet`) that owns provisioning, reattach, teardown, idle windows, and per-replica budgets instead of reading a seeded runtime-config registry. The GitHub routes, webhook, sandbox materialization, project locks, and session subscriptions (`@mastra/factory/integrations/github`) resolve tenants through the `RouteAuth` seam and receive the fleet and factory storage via `IntegrationContext`, so the web host no longer exports `getSeededSandbox`/`getSeededGithubIntegration` service locators. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the filesystem routes (`@mastra/factory/routes/fs`) and skill routes (`@mastra/factory/routes/skills`) into `@mastra/factory`. The skill prepare/invoke routes are now a `SkillRoutes` class that resolves users and tenants through the `RouteAuth` seam instead of web-host auth helpers. Diagnostics fields exposed by the GitHub and Linear integrations rename `webAuthEnabled` to `factoryAuthEnabled` to match the package's auth seam naming. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the Linear integration into `@mastra/factory/integrations/linear`. `LinearIntegration` now owns the full connection lifecycle (OAuth token exchange, single-flight refresh, scope checks, and connection caching) as class methods, the routes and agent tools resolve tenants through the `RouteAuth` seam instead of web-host auth imports, and the `getSeededIntegration` runtime-config indirection is gone — the host hands the integration instance and storage handles directly via `initialize()`. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the `MastraFactory` assembly root into `@mastra/factory`. `factory-entry.ts` now lives at the package root export (`@mastra/factory`), alongside the extracted `workspace`, `spa-static`, `server-error`, and `sandbox/reattach` helpers. Factory skills ship with the package and are copied into deploy output via the consuming app's build script. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Updated dependencies [[`a4d7c7d`](https://github.com/mastra-ai/mastra/commit/a4d7c7d74f423efc73b3e4db8142478763e6989d), [`d7385ad`](https://github.com/mastra-ai/mastra/commit/d7385ad9e88f9e4f33d15c0ec0bfebedde0cbc2e), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`35865a5`](https://github.com/mastra-ai/mastra/commit/35865a53e194aa9634d6a70a97010e7a6b9d58b1), [`70687f7`](https://github.com/mastra-ai/mastra/commit/70687f7e495a322a02070b4a67cb0c77a5ca91ec), [`9bffb73`](https://github.com/mastra-ai/mastra/commit/9bffb73e9ea46f48b53205b35a69a57f70912c78), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`b87e4ca`](https://github.com/mastra-ai/mastra/commit/b87e4cad9acf70e58c1559da0ca3640d5ae25e6e)]:
  - @mastra/auth-workos@1.6.4-alpha.1
  - @mastra/core@1.52.0-alpha.12
  - @mastra/code-sdk@1.0.0-alpha.14
  - @mastra/auth-studio@1.3.2-alpha.1
