---
name: herdr-manager-query
description: Query the authoritative global Herdr Review and Work Manager inventory, recommend actionable PR work, and explicitly materialize confirmed remote-only Review Manager records through the plugin's stable public CLI.
---

# Herdr Manager Query

Use the enabled `herdr-kit` plugin as the authoritative repository-independent source for Review Manager and Work Manager data.

Activate this skill for requested reviews, authored PRs, managed checkouts, Herdr workspaces, manager review/CI/activity/freshness/cleanup state, work recommendations, or explicit Review Manager materialization.

## Safety and source of truth

- Querying and recommending are read-only.
- The manager inventory is authoritative. Never substitute direct GitHub/`gh`, current-directory Git, TUI scraping, raw manager state files, or another inventory.
- If discovery, capability negotiation, query execution, JSON parsing, schema validation, or a relevant source reports an error, stop and report the exact problem. Never fall back.
- Never synchronize, dematerialize, clean up, create a Git worktree directly, or materialize a Work Manager record.
- The only permitted mutation is explicit, user-confirmed materialization of authoritative remote-only Review Manager records through the plugin's public CLI.
- Treat protocol and schema versions as compatibility boundaries. Do not guess around unsupported versions.

## Discover the installed interface

Resolve the enabled plugin root through Herdr, not from the current repository:

```sh
plugin_file=$(mktemp)
if ! herdr plugin list --plugin herdr-kit --json > "$plugin_file"; then
    exit 1
fi
if ! plugin_root=$(python3 - "$plugin_file" <<'PY'
import json, sys
plugins = json.load(open(sys.argv[1]))["result"]["plugins"]
plugin = next((p for p in plugins if p.get("plugin_id") == "herdr-kit"), None)
if not plugin or not plugin.get("enabled") or not plugin.get("plugin_root"):
    raise SystemExit("Enabled herdr-kit plugin root is unavailable")
print(plugin["plugin_root"])
PY
); then
    exit 1
fi
manager_cli="$plugin_root/herdr-kit"
```

Negotiate capabilities before any query or mutation:

```sh
capabilities_file=$(mktemp)
"$manager_cli" capabilities > "$capabilities_file"
python3 - "$capabilities_file" <<'PY'
import json, sys
p = json.load(open(sys.argv[1]))
if p.get("protocol_version") != 1:
    raise SystemExit(f"Unsupported herdr-kit protocol: {p.get('protocol_version')}")
if not p.get("operations", {}).get("manager_query", {}).get("available"):
    raise SystemExit("herdr-kit manager query is unavailable")
PY
```

## Query workflow

Write output to a temporary file so large JSON is never passed through shell command substitution:

```sh
data_file=$(mktemp)
"$manager_cli" manager query > "$data_file"
python3 - "$data_file" <<'PY'
import json, sys
p = json.load(open(sys.argv[1]))
if p.get("protocol_version") != 1:
    raise SystemExit(f"Unsupported manager protocol: {p.get('protocol_version')}")
inventory = p.get("inventory", {})
if inventory.get("schema_version") != 1:
    raise SystemExit(f"Unsupported manager inventory schema: {inventory.get('schema_version')}")
errors = inventory.get("summary", {}).get("errors", [])
if errors:
    raise SystemExit("Manager inventory error: " + "; ".join(map(str, errors)))
print(json.dumps(inventory.get("summary", {}), indent=2))
PY
```

Filter `inventory.items` locally. Every item identifies its source manager and includes repository/PR identity, state, checkout location, Herdr state, reviews, CI, activity, freshness, changes, and cleanup data. Review records additionally include `head_sha`, `materialization.target_path`, and PR diff statistics under `diff`.

For Review Manager records, use the structured review metadata when reasoning about initial reviews and follow-up work:

- `reviews.your_latest_review_at` and `reviews.your_latest_review_sha` identify the user's latest submitted review and reviewed commit.
- `reviews.events` provides submitted review events with actors, states, timestamps, commit SHAs, and compact bodies.
- `reviews.comments` and `reviews.unresolved_threads` provide available comment and unresolved-discussion timing. Compare each item's timestamp with `reviews.your_latest_review_at`: only later items are follow-up feedback, and the result remains unknown when either timestamp is unavailable.
- `reviews.commits_since_your_review` identifies commits submitted after the user's latest review.
- Compare event timestamps rather than assuming PR-wide `activity_at` occurred after the user's review. A missing timestamp or event remains unknown.

Treat missing values as unknown, never as favorable defaults.

## Recommendation workflow

When asked what to review or work on next, rank only records returned by the authoritative query.

Prioritize:

1. Open Review Manager PRs where the user is requested or has participated and still has actionable review work.
2. Within similarly actionable reviews, smaller quick wins by fewer `diff.changed_files` and lower `diff.total_changes`; then recent activity and passing CI.
3. Open Work Manager items with actionable author follow-up, review, CI, or local development work.
4. Fresh, unblocked records with a clear next action and safe checkout state.

Deprioritize cleanup-only, merged/closed/completed, stale/unavailable, blocked, or locally hazardous records. Do not treat missing diff metadata as a small PR.

For each recommendation include repository/PR, title, source manager, rationale and size, review/CI state, remote-only versus materialized state, Herdr state, warnings, and a concrete next action.

`remote only` does not prove whether a record was never materialized or later dematerialized unless inventory evidence distinguishes it.

## Explicit Review Manager materialization

Materialize only after the authoritative query identifies `manager: "review"`, `location: "remote only"` records and the user explicitly confirms the exact repository/PR targets. A current user message that unambiguously requests those exact targets counts as confirmation; otherwise ask first.

Before asking, show for each target:

- repository and PR number/title;
- immutable manager key;
- current `head_sha`;
- `materialization.target_path`;
- relevant freshness, eligibility, checkout, or collision warnings.

Freeze the confirmed key and head SHA in a request file. Never refresh or silently replace a confirmed head:

```sh
request_file=$(mktemp)
cat > "$request_file" <<'JSON'
{"schema_version":1,"items":[{"key":"OWNER/REPO#NUMBER","head_sha":"CONFIRMED_HEAD_SHA"}]}
JSON
result_file=$(mktemp)
"$manager_cli" review materialize --request "$request_file" > "$result_file"
python3 - "$result_file" <<'PY'
import json, sys
p = json.load(open(sys.argv[1]))
if p.get("protocol_version") != 1 or p.get("schema_version") != 1:
    raise SystemExit("Unsupported materialization result schema")
print(json.dumps(p, indent=2))
PY
```

For several confirmed reviews, include all items in the same request. The public CLI validates every item against authoritative current inventory before mutation, rejects stale heads, delegates fresh eligibility/head/repository/path safety to Review Manager, continues after individual failures, and returns structured per-item outcomes.

Success is reported only after the CLI re-queries authoritative manager state and verifies the record is materialized with a checkout path. The backend creates the canonical review worktree and opens/focuses its Herdr workspace. No Sync All is required.

Report every result exactly. Never retry a stale/failed item with a changed head without showing the new inventory state and obtaining fresh user confirmation. Never fall back to manual Git worktree creation.

## Response guidance

- Answer the specific question; do not dump the inventory unless requested.
- Clearly distinguish Review Manager from Work Manager records.
- Include repository and PR number for PR-backed items.
- Call out remote-only, closed Herdr workspace, dirty/unpushed changes, stale metadata, blocking CI/reviews, and cleanup warnings.
- Explain uncertainty and ranking tradeoffs instead of inventing context.
