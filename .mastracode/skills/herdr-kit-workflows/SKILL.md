---
name: herdr-kit-workflows
description: Set up and operate Herdr Kit safely: install and configure the plugin and Mastra Code integration, manage Review and Work repository scope, open primary repository workspaces, synchronize managers, materialize or dematerialize managed worktrees, and update Herdr Kit settings or shortcuts.
---

# Herdr Kit Workflows

Use Herdr Kit's supported Herdr and protocol-1 interfaces for setup, configuration, repository scope, synchronization, and worktree lifecycle operations.

Activate this skill when the user asks to install or configure Herdr Kit, change its shortcuts or launcher settings, open a repository correctly in Herdr, keep a closed repository synchronized, synchronize Review or Work Manager records, or materialize/dematerialize manager worktrees.

## Safety and authority

- Discover the enabled `herdr-kit` plugin through Herdr. Do not assume the current repository contains the plugin.
- Negotiate capabilities before using the public CLI. Treat protocol and request schema versions as compatibility boundaries.
- Use `manager query` as the authoritative source for manager keys, revisions, heads, checkout generations, paths, warnings, and postconditions.
- Use only the public `herdr-kit` CLI for manager scope, synchronization, and lifecycle mutations. Never invoke private scripts, edit manager state, create/remove Git worktrees manually, or substitute direct `gh`/Git/TUI scraping.
- Repository scope is manager-specific. Adding a repository to Review scope does not add it to Work scope.
- `remove` changes persistent synchronization scope only. It does not delete repositories, worktrees, branches, or Herdr workspaces.
- Never bypass stale-confirmation or warning checks. If a request is rejected, query again, show the changed authoritative values, and obtain renewed user confirmation.
- Materialization and dematerialization require explicit user confirmation of the exact records. Synchronization and opening/focusing an already registered primary repository may proceed when directly requested.
- If discovery, capabilities, query output, schema validation, configuration validation, or a lifecycle result reports an error, stop and report it exactly. Do not fall back.

## Discover and negotiate the installed interface

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
capabilities_file=$(mktemp)
"$manager_cli" capabilities > "$capabilities_file"
python3 - "$capabilities_file" <<'PY'
import json, sys
p = json.load(open(sys.argv[1]))
if p.get("protocol_version") != 1:
    raise SystemExit(f"Unsupported herdr-kit protocol: {p.get('protocol_version')}")
print(json.dumps(p.get("operations", {}), indent=2))
PY
```

Before each operation, require its capability to be present and `available: true`.

## New-user setup

1. Install the plugin and official Mastra Code integration:

   ```sh
   herdr plugin install mastra-ai/herdr-kit
   herdr integration install mastracode
   herdr plugin action list --plugin herdr-kit
   ```

2. Resolve the installed plugin as above and inspect its current `README.md` for the exact supported launcher settings and suggested keybindings. Do not copy configuration from an unrelated checkout or old plugin identity.
3. Configure required launcher commands in the Herdr-managed plugin `integrations.env` documented by that installed version. Preserve mode `0600`; do not overwrite unrelated values. Process environment variables are intentional overrides.
4. Add only the shortcuts the user requests to `~/.config/herdr/config.toml`. Plugin installation intentionally does not edit personal keybindings.
5. Validate and apply configuration:

   ```sh
   herdr config check
   herdr server reload-config
   ```

6. Start new Mastra Code sessions through the official Herdr integration before relying on lifecycle state or PR labels.

## Repository and workspace model

A primary/root repository workspace authorizes repository-wide synchronization while it is open. A manager-specific persistent scope entry keeps that repository synchronized even when its primary workspace is closed. Linked/detached PR worktrees do not replace the primary repository registration.

Use concrete repository registration:

```sh
"$manager_cli" manager scope review add-local --path /absolute/path/to/existing-checkout
"$manager_cli" manager scope work add-local --path /absolute/path/to/existing-checkout
"$manager_cli" manager scope review clone --repository OWNER/REPOSITORY --path /absolute/destination
"$manager_cli" manager scope work clone --repository https://github.com/OWNER/REPOSITORY.git --path /absolute/destination
```

- `add-local` validates and registers an existing primary checkout.
- `clone` clones immediately, validates identity, registers the checkout, and adds it only to the selected manager's persistent scope.
- Do not register only an `OWNER/REPOSITORY` name without a concrete checkout.

List, open/focus, or remove scope:

```sh
"$manager_cli" manager scope review list
"$manager_cli" manager scope work list
"$manager_cli" manager scope review open OWNER/REPOSITORY --focus
"$manager_cli" manager scope work open OWNER/REPOSITORY --focus
"$manager_cli" manager scope review remove OWNER/REPOSITORY
"$manager_cli" manager scope work remove OWNER/REPOSITORY
```

`open` requires the registered checkout to exist and opens or focuses its primary Herdr workspace without cloning. Worktree materialization may open that registered primary workspace when needed, but it never clones unexpectedly.

## Query authoritative manager state

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
print(json.dumps(inventory, indent=2))
PY
```

Filter `inventory.items` locally. Never refresh or silently replace values after the user confirms a lifecycle request.

## Synchronize managers

Synchronize the complete current scope:

```sh
"$manager_cli" manager sync review
"$manager_cli" manager sync work
```

Synchronize only authoritative selected records by freezing their keys from the latest query:

```json
{"schema_version":1,"items":[{"key":"AUTHORITATIVE_MANAGER_KEY"}]}
```

```sh
"$manager_cli" manager sync review --request selected.json
"$manager_cli" manager sync work --request selected.json
```

Inspect the JSON result and report every failed, removed, or synchronized record. Sync never creates a repository checkout or PR worktree.

## Materialize Review worktrees

Confirm that each queried item has `manager: "review"` and `location: "remote only"`. Show the user its repository/PR, title, key, `head_sha`, target path, freshness, and warnings. After exact confirmation, freeze key and head:

```json
{"schema_version":1,"items":[{"key":"OWNER/REPOSITORY#NUMBER","head_sha":"CONFIRMED_HEAD_SHA"}]}
```

```sh
"$manager_cli" review materialize --request review-materialize.json
```

The manager validates current PR identity/head, opens the registered primary repository workspace if necessary, creates the canonical linked review worktree, and verifies manager state. Multi-item requests belong in one request file.

## Materialize Work worktrees

Confirm that each queried item has `manager: "work"` and `location: "remote only"`. Show its key, repository/PR, title, `revision`, `head_sha`, registered repository state, target path, and warnings. Freeze the exact values:

```json
{"schema_version":1,"items":[{"key":"REPOSITORY_ID:PR_NUMBER","revision":7,"head_sha":"CONFIRMED_HEAD_SHA"}]}
```

```sh
"$manager_cli" work materialize --request work-materialize.json
```

The registered primary checkout must already exist. The manager may open it in Herdr, but must not clone during materialization.

## Dematerialize managed worktrees

Dematerialization removes only manager-owned linked worktree resources after safety validation. It must not remove a primary checkout. Present local changes, unpublished history, active-process, workspace, branch, cleanup, and freshness warnings before confirmation.

For Review, freeze key, path, and head:

```json
{"schema_version":1,"items":[{"key":"OWNER/REPOSITORY#NUMBER","path":"/confirmed/review/path","head_sha":"CONFIRMED_HEAD_SHA","allow_warnings":false}]}
```

```sh
"$manager_cli" review dematerialize --request review-dematerialize.json
```

For Work, freeze key, record revision, and checkout generation:

```json
{"schema_version":1,"items":[{"key":"checkout:REPOSITORY_ID:PATH_HASH","revision":8,"checkout_generation":"CONFIRMED_GENERATION","allow_warnings":false}]}
```

```sh
"$manager_cli" work dematerialize --request work-dematerialize.json
```

Set `allow_warnings: true` only after the user explicitly accepts the currently reported warnings. All items in one dematerialization request must use the same `allow_warnings` value. Re-query after completion and report the verified resulting location or removal.

## Configuration and shortcut changes

When asked to change Herdr Kit settings or shortcuts:

1. Discover the active plugin root and inspect that installed version's configuration documentation and action list.
2. Read the existing target file before editing it.
3. Change only the requested plugin setting or keybinding; preserve unrelated configuration and file permissions.
4. Never remove or replace official `herdr integration install mastracode` hooks as legacy files.
5. Run `herdr config check`, then `herdr server reload-config`.
6. Report the exact setting/action changed and whether reload returned `status: applied`.

## Completion report

Report:

- plugin discovery and negotiated protocol;
- manager and exact repositories/records affected;
- commands performed and whether they mutate state;
- verified final manager location, path, Herdr state, head/revision/generation as applicable;
- warnings accepted or still blocking;
- configuration validation/reload result when configuration changed.
