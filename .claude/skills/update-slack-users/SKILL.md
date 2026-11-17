---
name: update-slack-users
description: Update .github/slack-users.json, the GitHub login to Slack member ID map that CI alerts use to tag people. Use when a maintainer joins or leaves, when a CI alert shows a plain @login instead of a Slack tag, or when asked to refresh the map. Needs a Slack token that can read the workspace's user list.
---

# Update the GitHub → Slack user map

`.github/slack-users.json` maps GitHub logins to Slack member IDs:

```json
{
  "octocat": "U012AB3CD4E"
}
```

CI alerts look GitHub logins up in this file. One example is the test-tier escape alert built by `scripts/test-tiers/attribute.mjs`. A listed login becomes a Slack tag (`<@U012AB3CD4E>`), and an unlisted one is printed as a plain `@login`. So a missing entry is harmless, but a wrong entry tags the wrong person. **Leave someone out rather than guess.**

Who an alert tags: the author of the PR that broke something. When a bot opened that PR, the alert tags a person instead: the human who merged it, then the humans who approved it, then the human credited on the most commits (including `Co-authored-by` trailers). It falls back to `@here` only when it can't tell who the person is. So the map needs everyone who authors, merges or approves PRs on `main`, everyone co-credited on `main`, and everyone credited on a bot PR's own commits.

## What you need

- **The workspace's Slack user list**, from someone with a token that has the `users:read` scope. That is the only scope the steps below need: matching never uses emails, so `users:read.email` isn't needed. The token holder can run step 2 and hand you the resulting file, or set `SLACK_TOKEN` in your environment. Never print the token, write it to a file, or put it in a commit or PR.
- `gh`, authenticated with read access to this repo, and `jq`.

If you hold the token yourself, check it before anything else:

```bash
curl -sS -H "Authorization: Bearer $SLACK_TOKEN" https://slack.com/api/auth.test | jq '{ok, error, team}'
```

`ok: false` with `missing_scope` or `invalid_auth` means stop and ask for a token with `users:read`.

## Steps

### 1. List the GitHub logins that need an entry

Take the last 90 days. `gh` writes colour codes into `--jq` output when `CLICOLOR_FORCE` is set, which breaks the `jq` calls below, so run `unset CLICOLOR_FORCE` first. GitHub search returns at most 1,000 PRs per query and `main` merges more than that in 90 days, so query one week at a time. GitHub sometimes answers 502 or 504, so each week is retried; if a week still fails, the loop stops. Don't continue with a gap.

```bash
work=$(mktemp -d)
(
  for w in $(seq 0 12); do
    from=$(date -u -v-$(( (w+1)*7 ))d +%F 2>/dev/null || date -u -d "$(( (w+1)*7 )) days ago" +%F)
    to=$(date -u -v-$(( w*7 ))d +%F 2>/dev/null || date -u -d "$(( w*7 )) days ago" +%F)
    for try in 1 2 3 4; do
      gh pr list --repo mastra-ai/mastra --state merged --base main --limit 1000 \
        --search "merged:$from..$to" --json number,author,mergedBy,reviews \
        > "$work/week-$w.json" && break
      [ "$try" = 4 ] && { echo "week $w failed: stop and run step 1 again" >&2; exit 1; }
      sleep 10
    done
  done
)
```

If it prints `week ... failed`, stop: the list is missing that week.

Take the authors, mergers and approvers from those PRs, and note which PRs a bot opened:

```bash
jq -r '.[] | (.author.login, .mergedBy.login, (.reviews[] | select(.state=="APPROVED") | .author.login)) // empty' \
  "$work"/week-*.json > "$work/prs.txt"
jq -r '.[] | select(.author.is_bot) | .number' "$work"/week-*.json | sort -un > "$work/bot-prs.txt"
```

For a bot PR, the alert's last rung credits the people on the PR's own commits: each commit's author, and each `Co-authored-by` noreply address in its message. A squash merge can drop both from `main`, so read them from each bot PR's commits. Every page is fetched, a failing PR is retried, and the loop stops if it still fails:

```bash
(
  while read -r pr; do
    for try in 1 2 3 4; do
      gh api --paginate --slurp "repos/mastra-ai/mastra/pulls/$pr/commits?per_page=100" > "$work/commits.json" && break
      [ "$try" = 4 ] && { echo "commits of #$pr failed: stop and run this step again" >&2; exit 1; }
      sleep 10
    done
    jq -r 'add[] | (.author.login // empty), (.commit.message | scan("(?im)^co-authored-by:.*<(?:[0-9]+\\+)?([^@<>\\s]+)@users\\.noreply\\.github\\.com>\\s*$") | .[0])' \
      "$work/commits.json" || exit 1
  done < "$work/bot-prs.txt"
) > "$work/bot-commits.txt"
```

If it prints `commits of ... failed`, stop: the list is missing that PR's people.

Then add co-authors credited on `main` through GitHub noreply addresses, both `<id>+<login>@users.noreply.github.com` and the older `<login>@users.noreply.github.com` (the same forms the alert reads). If the fetch fails, stop rather than read a stale `origin/main`:

```bash
git fetch -q origin main || { echo "fetch failed: stop" >&2; false; } &&
git log origin/main --since=90.days --format=%B \
  | grep -ioE '^co-authored-by:.*<([0-9]+\+)?[^@<>[:space:]]+@users\.noreply\.github\.com>' \
  | sed -E 's/.*<([0-9]+\+)?([^@<>[:space:]]+)@.*/\2/' > "$work/coauthors.txt"
```

Keep only people, with their GitHub profile name. `gh pr list` drops the `[bot]` suffix from app accounts, so you can't spot them by name. Ask GitHub for each login's account type instead: apps return 404, bots `Bot` and organisations `Organization`. Retry a lookup that fails with anything other than 404, and stop if it still fails: a silently dropped login would quietly lose a person.

```bash
sort -u "$work/prs.txt" "$work/bot-commits.txt" "$work/coauthors.txt" | grep -v '^$' | while read -r login; do
  for try in 1 2 3 4; do
    if user=$(gh api "users/$login" 2>"$work/err"); then
      jq -c 'select(.type == "User") | {login, name}' <<<"$user"
      break
    fi
    grep -q 'HTTP 404' "$work/err" && break
    [ "$try" = 4 ] && { echo "lookup failed for $login: $(cat "$work/err")" >&2; exit 1; }
    sleep 5
  done
done > "$work/people.jsonl"
```

If the loop stops with `lookup failed`, run it again; don't continue with a partial list.

Expect around 175 people.

### 2. Fetch the Slack users

`users.list` is paged; follow `response_metadata.next_cursor` until it is empty. Drop deleted users, bots, app users and Slackbot, and keep only the ID and the names. Pages go to a `.partial` file that only becomes `slack-users.jsonl` once every page has arrived, so a failed run can't leave a list that looks complete.

```bash
(
  cursor=""; : > "$work/slack-users.partial" || exit 1
  while :; do
    page=$(curl -sS --fail-with-body --retry 3 -G -H "Authorization: Bearer $SLACK_TOKEN" \
      --data-urlencode "cursor=$cursor" "https://slack.com/api/users.list?limit=200") || exit 1
    [ "$(jq -r .ok <<<"$page")" = true ] || { echo "users.list failed: $(jq -r .error <<<"$page")" >&2; exit 1; }
    jq -c '.members[] | select(.deleted|not) | select(.is_bot|not) | select(.is_app_user|not)
           | select(.id != "USLACKBOT")
           | {id, name, real_name: .profile.real_name, display_name: .profile.display_name}' \
      <<<"$page" >> "$work/slack-users.partial" || exit 1
    cursor=$(jq -er '.response_metadata.next_cursor // ""' <<<"$page") || exit 1
    [ -n "$cursor" ] || break
  done
  mv "$work/slack-users.partial" "$work/slack-users.jsonl"
) || { rm -f "$work/slack-users.partial"; echo "Slack user list incomplete: stop" >&2; }
```

If it prints `Slack user list incomplete`, or `$work/slack-users.jsonl` doesn't exist, stop and run it again. Don't go on to matching or to removing entries in step 4 with a partial list: a person missing from it would look deleted.

This file names everyone in the workspace. Keep it in the temp directory, never commit it or paste it anywhere, and delete it when you're done.

### 3. Work out who is who

Match only on exact, unique names. A wrong tag pings the wrong person; a missing entry just prints a plain `@login`, so when in doubt leave the login out.

Normalise every name on both sides the same way: Unicode NFKC, lower-case, trim, and collapse inner whitespace. Nothing else: no fuzzy matching, nicknames, first names, partial matches or emails.

- **Rule A, profile name.** The GitHub profile `name` equals a Slack user's `real_name` or `display_name`, and exactly one Slack user and exactly one GitHub login in your list carry that name. A second candidate on either side makes it ambiguous.
- **Rule B, login as display name.** The GitHub login equals a Slack `display_name`, unique on both sides, and the GitHub profile name, if set, doesn't contradict the Slack `real_name` (after normalising, they are equal or one of them is empty).
- Check both rules for every login, even one rule A already matched. If A and B point at different Slack users, leave the login out. Otherwise use whichever matched.
- One Slack user must never end up under two logins.

Everyone else is left out. Keep a list of the logins you left out, split into _ambiguous_ (more than one candidate, or the names contradict) and _no candidate_. Don't pick the likeliest; the person you're working for can settle an ambiguous login in a line if they want it in.

### 4. Check the entries already in the file

Only with the complete `slack-users.jsonl` from step 2: for each existing entry, confirm its Slack ID is still in your step 2 list, so the account hasn't been deleted or turned into a bot. Remove entries whose Slack user is gone. Don't remove people just because they had no PR in the last 90 days.

### 5. Write the file

- Keys are GitHub logins exactly as the GitHub API returns them; the alert looks them up case-sensitively. Values are Slack member IDs.
- Sort keys alphabetically (case-insensitive), with a two-space indent and a trailing newline.
- Only logins and IDs go in the file: no names, emails or comments.

Validate:

```bash
jq -e 'type == "object" and all(.[]; type == "string" and test("^[UW][A-Z0-9]{6,}$"))' .github/slack-users.json
pnpm oxfmt --check .github/slack-users.json
```

### 6. Hand it over

Show the person you're working for a table of what changed: GitHub login, Slack display name and the rule that matched (A or B). Add the removed entries and the unresolved list. Leave emails out of the table. Commit only `.github/slack-users.json`. Opening the PR is their call. The PR description lists the added and removed logins and nothing from Slack beyond that.

## Don'ts

- Don't add a login you couldn't match with rule A or B.
- Don't commit, log or paste the Slack token, the user list, or anyone's email.
- Don't map bots, guests you can't identify, or shared accounts.
- Don't post to Slack to test a tag; the validation above is enough.
