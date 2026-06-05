---
name: mastrabowl-recap
description: Help write the weekly MastraBowl Recap that Abhi and Shane publish every Friday. Use when asked to draft, fill in, or update the MastraBowl Recap, or to pull the weekly Open Source stats (merged PRs, open issues/PRs, releases) for mastra-ai/mastra and mastra-ai/platform. Triggers on "MastraBowl", "weekly recap", "Friday recap".
---

# MastraBowl Recap

The MastraBowl Recap is the weekly internal update Abhi and Shane publish every Friday.
This skill holds the template, the writing process, and a script to auto-pull the
Open Source numbers so the recap can be drafted quickly each week.

## What the recap is

A structured weekly summary covering: highlights (Agents Hour, Workshop, Weekly Demos),
Open Source momentum + stats, releases, and progress across "Road to London" workstreams
(LRA, Framework, Observability, Agent Learning, Platform, Agent Builder), plus Sales /
Customer Engineering and Product Revenue. It opens with a "Dear ____," greeting and a
[song], and closes with "Peace ✌️ — Abhi and Shane".

**The greeting is always an alliterative, playful dev/agent-themed honorific for the
team**, in the form "Dear [Title of the Thing],". Each week is different and shouldn't
repeat a past one. Past examples: "Titans of the Traces", "Tamers of the Threads",
"Guardians of Git", "Barons of the Branch", "Lords of Loops", "Architects of Agents".
Tie it to the week's biggest theme when you can (e.g. an Agent Builder launch week →
"Architects of Agents").

**The song is a Suno track** embedded right under the greeting. To make one: open
https://suno.com/create (Advanced tab, "Write" lyrics mode), paste lyrics written from
the week's recap (the wins, deals, stats, the greeting hook), set a style, and create.
Pick a **different genre each week** (past weeks have done country, R&B, etc.; rotate to
EDM, rock, pop, etc.). Keep the lyrics about the work and the team. Don't put individual
names (e.g. Abhi/Shane) in the lyrics. After it generates, click the clip's Share button
(it copies a `https://suno.com/s/...` link to the clipboard) and put it in the draft as
`@embed https://suno.com/s/...` on its own line under the greeting. The publish script
turns that into a Notion embed (inline player).

## Process (do this each Friday)

1. **Copy the template.** Start from `template.md`. Keep all section headers and the
   sign-off intact.

2. **Pull Open Source stats automatically.** Run:

   ```bash
   .claude/skills/mastrabowl-recap/scripts/oss-stats.sh
   ```

   With no argument it uses the past 7 days as the week window (the standard Friday
   recap). Pass an explicit `YYYY-MM-DD` to override (e.g. when recapping a past week
   or aligning to a Memorial-Day-shifted window):

   ```bash
   .claude/skills/mastrabowl-recap/scripts/oss-stats.sh 2026-05-29
   ```

   The script prints, for both `mastra-ai/mastra` and `mastra-ai/platform`:
   PRs merged this week, open PRs (EoW), open issues (EoW), and the week's releases.

   Map the output into the template:
   - `**EoW ___ Issues Open | ___ PRs Open**` → use the **mastra-ai/mastra** open numbers.
   - `**___ PRs have been merged this week in mastra-ai/mastra**`
   - `**___ PRs merged this week in mastra-ai/platform**`
   - Releases → the script emits markdown bullets linking each GitHub release published
     in the window (from https://github.com/mastra-ai/mastra/releases). Drop them under
     `### Releases`. Volume is usually small; if a week has many per-package tags, curate
     to the meaningful version bumps but keep the links.

3. **Write the Open Source narrative.** One short line on momentum (up/down vs. last
   week, holidays, notable spikes). Reference the stats you just pulled.

4. **Fill the qualitative sections.** Highlights links, Kindergarten, Feature
   Announcements, and each "Road to London" workstream, Sales/CE, Product Revenue.
   Most are human-supplied — ask Abhi/Shane for inputs or leave as `?` placeholders
   to fill in. Never invent customer, revenue, or roadmap claims.

   **Highlights (Agents Hour + Workshop) are sourceable from YouTube.** Open
   https://www.youtube.com/@mastra-ai/streams (sorted Latest first). Take the
   in-window streams (Sunday → day before today) and map them:
   - **Agents Hour** → the weekly Agents Hour livestream.
   - **Workshop** → the weekly workshop livestream.
   Verify each video's stream date is inside the window before including it — list
   order alone is not proof. On the watch page, "Streamed N days ago" gives the date
   (today minus N); exclude anything before Sunday or after the day-before-today.
   Capture the full `https://www.youtube.com/watch?v=...` permalink and the title.
   **Weekly Demos** uses a Fireflies link, not YouTube — leave as `?` for manual paste.

   **Kindergarten is sourceable from Slack.** It's the `#kindergarten` channel where
   the team drops interesting articles/links. Run:

   ```bash
   node .claude/skills/mastrabowl-recap/scripts/kindergarten.mjs
   ```

   The script reads `SLACK_TOKEN` + `KINDERGARTEN_SLACK_ID` from `recap.env`, pulls the
   week's messages (same Sunday → day-before-today window), extracts shared article
   links, dedupes them, and ranks by engagement (reactions + replies). The Slack token
   needs `channels:history`, `channels:read`, `reactions:read` (+ `groups:*` if private),
   and the bot must be a member of the channel (`/invite` it) — or use a user token
   (`xoxp-`) which already has your channel access.

   From the ranked list, pick the most interesting with judgment: weight engagement
   (replies/reactions) but also topical relevance to the recap audience (AI/agent news,
   notable model releases, funding, TS/JS ecosystem). Drop low-signal/no-context drops.
   Capture each as a link with a short label.

5. **Generate the OSS download chart.** The recap shows the `@mastra/core` "downloads
   per day" trend for the recap week. The week runs **Sunday → the day before today**
   (npm download data lags, so never include today/yesterday-incomplete days). Run:

   ```bash
   node .claude/skills/mastrabowl-recap/scripts/download-chart.mjs
   ```

   With no args it defaults to the most recent Sunday through yesterday. Override with
   `--from YYYY-MM-DD --to YYYY-MM-DD` (e.g. `--from 2026-05-31 --to 2026-06-04`).
   It pulls daily counts from the public npm API, prints the daily numbers + total for
   the window, and writes `downloads-chart-<to>.svg` to the skill dir.

   The chart data comes from the same source as npm-stat.com (npm's download API), so
   the totals match. Reference it in the draft with `!downloads-chart-<to>.svg` on its
   own line; the publish step uploads and embeds it automatically.

   **Product Revenue chart (from Slack / PostHog).** Revenue lives in the `#revenue`
   Slack channel, where a PostHog "Subscription Revenue by Type" subscription posts a
   daily message with the chart embedded as an image block (a signed PostHog exporter
   PNG — no PostHog API key required). Run:

   ```bash
   node .claude/skills/mastrabowl-recap/scripts/revenue-image.mjs
   ```

   It reads `SLACK_TOKEN` + `REVENUE_SLACK_ID` from `recap.env`, finds the newest
   in-window revenue post (Sunday → day before today), downloads the chart to
   `revenue-<date>.png` in the skill dir, and prints the "View in PostHog" link.
   Open the saved PNG to read the totals and transcribe the figures under Product
   Revenue (e.g. plan breakdown + total). The PNG is gitignored — it contains real
   revenue numbers; never commit it. Reference it in the draft with
   `!revenue-<date>.png` on its own line and the publish step embeds it automatically.
   Never invent or round revenue figures — only use what the chart shows.

6. **Feature Announcements (from X/Twitter).** Open https://x.com/mastra and scan posts.

   **Stay strictly within the weekly window.** The window is the same one used everywhere
   in the recap: **Sunday → the day before today** (run `oss-stats.sh`/`download-chart.mjs`
   first; they print the exact `from`/`to`). Each post on X shows its date (e.g. "Jun 2").
   ONLY include posts whose date is `>= from` AND `<= to`. Today's posts and anything
   before Sunday are out of scope — do not include them even if they look relevant.

   Scroll until you have passed the `from` (Sunday) date — i.e. until you see posts dated
   before the window — so you know you've covered the whole week. Then collect only the
   in-window posts. (X lazy-loads; keep scrolling until older-than-window posts appear or
   the timeline stops loading.)

   From the in-window posts, include genuine Mastra feature/launch announcements (and
   reposts of team members announcing a Mastra primitive). Capture each as a markdown link
   using the post permalink (`https://x.com/<author>/status/<id>`) with a short feature
   description and its date. Order chronologically.

   Exclude: workshop "happening now" / broadcast notices (those are Highlights), customer
   fundraising or customer-story reposts (those belong under Sales / Customer Engineering),
   docs/blog follow-up tweets that just point at a feature already listed, and general hype.

7. **Road to London (from merged PRs, bucketed by code AREA).** Do NOT use GitHub
   labels — they're incomplete and inconsistently applied. Bucket by the file paths a
   PR touches instead. Run:

   ```bash
   node .claude/skills/mastrabowl-recap/scripts/road-to-london.mjs
   ```

   It reads merged PRs in-window (Sunday → day before today) from `mastra-ai/mastra`
   and `mastra-ai/platform`, fetches each PR's changed files, filters release/chore/deps
   noise, and buckets by code area:
   - **LRA (Long Running Agents)** = signals / channels / events / notifications /
     background-tasks / memory (PubSub, Signals, Memory).
   - **Observability** = observability / telemetry / logger(s), plus MOBS in Platform.
   - **Agent Builder** = agent-builder / editor / workspace.
   - **Agent Learning** = datasets / evals / relevance (mostly research phase, but it
     does ship eval/dataset tooling some weeks; report what actually landed).
   - **Platform** = everything in `mastra-ai/platform`.
   - **Framework** = the rest of `mastra-ai/mastra` (catch-all; the script caps the
     list and surfaces `feat` PRs first).

   The script prints PRs per bucket with links. Use it as raw material, but **write a
   narrative, not a changelog.** For each workstream, write a short prose paragraph
   (2–5 sentences) that tells the story: what theme the week's work points to, why it
   matters for "the road to London," and where the workstream is heading. Weave the
   most representative PRs in as **inline markdown links** within the prose (not a bare
   bullet list of every PR), and close with a one-line throughline when it helps. End
   on the direction, not the diff. If a workstream is in research phase with no PRs,
   say so plainly and briefly rather than padding. Never invent work that didn't land.
   Adjust the area path maps at the top of the script if the codebase reorganizes.

8. **Sales / Customer Engineering (from Slack).** Two channels feed this section:
   - **Sales** (`SALES_SLACK_ID`): recap the **deals**. Pull the channel and look for
     signed-deal markers ("X is Signed"), contract values, and active pipeline.
   - **Customer Engineering** (`CUSTOMER_ENG_SLACK_ID`): recap the **customers** and CE
     work. The PRIMARY source is **Romain's weekly CE/OSS report**, which he posts to
     this channel every week. It's a `oss-report-workflow` run (a Mastra agent) attached
     as two files: an `image.png` briefing card and a `result.json` with the full data.
     Use that report as the backbone, then layer in the human updates from the channel
     (deals likely to sign, support/SLA work, triage status).

   Run:

   ```bash
   node .claude/skills/mastrabowl-recap/scripts/slack-channel.mjs SALES_SLACK_ID --threads
   node .claude/skills/mastrabowl-recap/scripts/slack-channel.mjs CUSTOMER_ENG_SLACK_ID --files
   ```

   `--threads` expands reply threads (signed-deal posts put contract details in the
   thread). `--files` lists attachments with a ready-to-run `curl` download command;
   use it to find Romain's report files. Downloading files needs the **`files:read`**
   scope on the Slack token. The `image.png` is the briefing card (reference it in the
   CE section as `!ce-report-<endDate>.png` so it embeds on publish); `result.json` has `result.briefing`
   (headline, wins, regressions, watchlist, talkingPoints) and `result.summary` /
   `initialState.metrics` (backlog, issues opened/closed, PRs opened/merged, category
   breakdown). Save the card as `ce-report-<endDate>.png` in the skill dir (gitignored).

   Write each section as a short narrative in the same plain voice as Road to London.
   Customer/deal names and dollar figures are in scope (the recap is internal), but
   never invent or round numbers — use exactly what the report and channel say.

9. **Publish to Notion.** Recaps live in a Notion database (one page per week).
   Write the finished draft to a local markdown file, then:

   ```bash
   # preview blocks without hitting Notion:
   node .claude/skills/mastrabowl-recap/scripts/publish-notion.mjs draft.md \
     --title "Week of June 6, 2026" --dry-run

   # create the page:
   node .claude/skills/mastrabowl-recap/scripts/publish-notion.mjs draft.md \
     --title "Week of June 6, 2026"
   ```

   The script converts headings, bullets, **bold** text, and `[links](url)` into
   Notion blocks. Title defaults to "Week of <today>"; use `--title "2026-MM-DD"` for
   the ISO date format we use.

   **Images embed automatically.** A line like `!revenue-2026-06-04.png` is uploaded
   via Notion's Direct File Upload API and inserted as a real image block (no manual
   drag-in). The file is looked up next to the draft, then in the skill dir. If the
   file is missing, the script falls back to a 🖼️ "Attach image" callout. Keep the
   generated chart/report files in the skill dir (gitignored) so they upload cleanly.

   Two API-version notes baked into the script (don't revert these):
   - File uploads use Notion-Version `2026-03-11` (the upload endpoints don't exist on
     older versions).
   - Pages are parented to the database's **data source** (`data_source_id`), not the
     bare `database_id`. On current API versions the database view reads from a data
     source, and pages parented to `database_id` won't appear in the view.

## Notion setup (one-time)

1. Create an internal integration at https://www.notion.so/my-integrations (workspace
   `kepler-inc`) and copy the Internal Integration Secret.
2. Open the recap database → `•••` → Connections → add the integration. Without this
   the API returns 404 even with a valid token.
3. Copy `recap.env.example` to `recap.env` and set `NOTION_TOKEN`. The database ID is
   already filled in. `recap.env` is gitignored — never commit it.

Verify connectivity:

```bash
set -a; source .claude/skills/mastrabowl-recap/recap.env; set +a
curl -s https://api.notion.com/v1/databases/$NOTION_DATABASE_ID \
  -H "Authorization: Bearer $NOTION_TOKEN" -H "Notion-Version: 2022-06-28" \
  | head -c 400
```

## Style notes

- Keep the warm, informal voice (greeting + [song], "Peace ✌️").
- Stats lines stay **bold**.
- Don't fabricate numbers, releases, customers, or roadmap status. If a section has no
  input, leave `?` rather than guessing.
- **Write like a human, not an AI.** This is the most important style rule for the
  narrative sections (especially Road to London):
  - **No em dashes** (—). Use a period, comma, colon, or parentheses instead.
  - Avoid AI-tell phrasing: "the throughline," "the story is," "it's worth noting,"
    "in summary," "let's dive in," stacked adjectives ("composable, performant,
    foundational"), and breathless hype. Just say what happened and why it matters.
  - Prefer short, plain sentences. Lead with the work, not a thesis statement.
  - It's fine to be a little dry. Don't editorialize every bullet.

## Files

- `template.md` — the blank weekly template.
- `scripts/oss-stats.sh` — pulls merged/open PR + issue counts and releases via `gh api`.
- `scripts/download-chart.mjs` — generates the `@mastra/core` weekly download chart (SVG)
  from npm's download API (Sunday → day before today).
- `scripts/publish-notion.mjs` — creates a new page in the recap Notion DB from a
  markdown file: converts headings/bullets/bold/links, uploads + embeds `!image` lines
  via the Direct File Upload API, and parents the page to the DB's data source so it
  shows in the view (no external deps; needs Node 18+).
- `recap.env.example` / `recap.env` — Notion token + database ID (`recap.env` gitignored).

## Requirements

- `gh` CLI authenticated with access to the `mastra-ai` org.
- `jq`.
- Node 18+ (for the Notion publish script's built-in `fetch`).
- Notion integration token in `recap.env`, with the integration shared on the recap DB.
- This repo's `gh` predates `gh search`, so the script uses `gh api search/issues`.
  If `gh` is upgraded, the queries remain compatible.

## TODO / future enhancements

- **OSS chart format.** The OSS download chart is an SVG; Notion's image rendering of SVG
  can be inconsistent. If it ever renders poorly, render the chart to PNG in
  `download-chart.mjs` and reference the PNG in the draft instead.
- **Update in place.** `publish-notion.mjs` currently creates a new page each run. If a
  stable per-week URL is wanted, extend it to find an existing page by title and replace
  its blocks rather than creating a new page.

## Iterating on this skill

This skill is meant to evolve. As the recap format changes, update `template.md` and the
section mapping above. If new automatable data sources appear (e.g. revenue dashboards,
release-notes generation), add scripts under `scripts/` and document them here.
