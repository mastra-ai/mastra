# Issue debug context

Use this shared context-gathering checklist when a command needs code-accurate issue debugging context. This file only gathers evidence; the calling command owns debugging decisions, reproduction, fixes, routing, severity, and user interaction.

## Inputs

- Issue number or URL.
- Optional shared triage file.

## Context to gather

1. Fetch the issue details, comments, labels, assignees, milestone, and linked discussion context.

```bash
gh issue view <ISSUE> --json title,body,comments,labels,assignees,milestone,state,author,url,createdAt,updatedAt
```

2. If the issue body contains a Discord thread URL like `https://discord.com/channels/GUILD_ID/<THREAD_ID>`, fetch the thread when `MASTRA_DISCORD_BOT_TOKEN` is available. If Discord returns `401`, continue without Discord messages.

```bash
curl -s -X GET -H "Authorization: Bot $MASTRA_DISCORD_BOT_TOKEN" "https://discord.com/api/v10/channels/<THREAD_ID>/messages?limit=100" > /tmp/discord_out.json && jq '[.[] | {timestamp, author: {username: .author.username, display_name: .author.global_name}, content, attachments: [.attachments[]? | {filename, url}], embeds: [.embeds[]? | {title, description, url}]}]' /tmp/discord_out.json ; rm -f /tmp/discord_out.json
```

3. Check linked PRs, related issues, and comments/discussion threads.
4. Identify the likely affected package, API, feature, tests, docs, or runtime path.
5. Inspect relevant files narrowly. Prefer existing issue evidence, error text, API names, stack traces, and likely pathspecs over broad searches.

```bash
git grep -n "<error text|API|symbol>" -- '<likely/pathspec>'
git log --oneline --decorate -- '<relevant/path>' | head -20
git log -p --max-count=5 -- '<relevant/path>'
```

6. Read surrounding implementation and nearby tests before forming a debugging theory.
7. Summarize how the feature should work, what appears to be happening, and where a reproduction test would likely belong.
8. Capture uncertainties and any missing environment details that affect confidence.

## Return only context

Return concise context for the calling command:

- Issue summary.
- Relevant comments/discussion details.
- Linked PRs or related issues.
- Likely affected area and files.
- Repo/history evidence checked, including important `path:line` references.
- Debugging theory and likely reproduction path or test target.
- Context gaps or uncertainty.

Do not implement fixes, write reproduction tests, assign severity, route triage branches, post comments, or create files from this shared checklist.
