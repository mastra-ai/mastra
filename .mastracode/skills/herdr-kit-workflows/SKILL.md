---
name: herdr-kit-workflows
description: >-
  Set up and operate Herdr Kit safely: install and configure the plugin and Mastra Code integration, manage Review and Work repository scope, open primary repository workspaces, synchronize managers, materialize or dematerialize managed worktrees, and update Herdr Kit settings or shortcuts.
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
capabilities_file=$(mktemp)
data_file=
cleanup() { rm -f "$plugin_file" "$capabilities_file" ${data_file:+"$data_file"}; }
trap cleanup EXIT
if ! herdr plugin list --plugin herdr-kit --json > "$plugin_file"; then
    exit 1
fi
if ! plugin_root=$(python3 - "$plugin_file" <<'PY'
import json, sys
p = json.load(open(sys.argv[1]))
if not isinstance(p, dict) or p.get("error") is not None:
    raise SystemExit(p.get("error") if isinstance(p, dict) else "Malformed herdr plugin list response")
result = p.get("result")
if not isinstance(result, dict) or not isinstance(result.get("plugins"), list):
    raise SystemExit("Malformed herdr plugin list response")
plugin = next((item for item in result["plugins"] if item.get("plugin_id") == "herdr-kit"), None)
if not plugin or not plugin.get("enabled") or not plugin.get("plugin_root"):
    raise SystemExit("Enabled herdr-kit plugin root is unavailable")
print(plugin["plugin_root"])
PY
); then
    exit 1
fi
manager_cli="$plugin_root/herdr-kit"
if ! "$manager_cli" capabilities > "$capabilities_file"; then
    exit 1
fi
python3 - "$capabilities_file" <<'PY'
import json, sys
p = json.load(open(sys.argv[1]))
if not isinstance(p, dict) or p.get("error") is not None:
    raise SystemExit(p.get("error") if isinstance(p, dict) else "Malformed herdr-kit capabilities response")
if p.get("protocol_version") != 1:
    raise SystemExit(f"Unsupported herdr-kit protocol: {p.get('protocol_version')}")
operations = p.get("operations")
if not isinstance(operations, dict):
    raise SystemExit("Malformed herdr-kit capabilities response")
print(json.dumps(operations, indent=2))
PY
```

Before each operation, require its capability to be present and `available: true`. Before any command using `--request`, also require that operation's `request_schema` to equal the request file's `schema_version` (`1` below).

## Detect and update an outdated plugin

The skill describes the current Herdr Kit public contract, but the enabled plugin may be older. Treat a missing required capability, an unsupported protocol/request schema, or a missing documented command as an update signal—not as permission to call private scripts or invent a fallback.

Inspect the discovered plugin's `source.kind` from `herdr plugin list`:

- For a GitHub-installed plugin, update it with `herdr plugin install mastra-ai/herdr-kit -y`, reinstall the official integration with `herdr integration install mastracode`, and run `herdr server reload-config`.
- For a locally linked plugin, do not replace it with a GitHub installation. Report the linked `plugin_root`. Before pulling, verify that `git -C "$plugin_root" remote get-url origin` identifies exactly `mastra-ai/herdr-kit`, the current branch matches the normal branch advertised by `refs/remotes/origin/HEAD`, and `git -C "$plugin_root" status --porcelain` is empty. Only after all checks pass may you run `git -C "$plugin_root" pull --ff-only` and reload Herdr. If the remote or repository identity is different, the normal branch cannot be verified, or the checkout is dirty, detached, or on a feature branch, stop and ask before modifying it.

After any update, repeat plugin discovery and capability negotiation from scratch. Continue only when the required operation is present and `available: true`; otherwise report the remaining incompatibility exactly. Do not update merely because a newer release exists—update when setup is requested or the requested workflow requires an interface the enabled plugin does not provide.

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
if ! "$manager_cli" manager query > "$data_file"; then
    exit 1
fi
python3 - "$data_file" <<'PY'
import json, sys
p = json.load(open(sys.argv[1]))
if not isinstance(p, dict) or p.get("error") is not None:
    raise SystemExit(p.get("error") if isinstance(p, dict) else "Malformed manager query response")
if p.get("protocol_version") != 1:
    raise SystemExit(f"Unsupported manager protocol: {p.get('protocol_version')}")
inventory = p.get("inventory")
if not isinstance(inventory, dict):
    raise SystemExit("Malformed manager query response")
if inventory.get("schema_version") != 1:
    raise SystemExit(f"Unsupported manager inventory schema: {inventory.get('schema_version')}")
summary = inventory.get("summary")
if not isinstance(summary, dict):
    raise SystemExit("Malformed manager query response")
errors = summary.get("errors", [])
if not isinstance(errors, list):
    raise SystemExit("Malformed manager query response")
if errors:
    raise SystemExit("Manager inventory error: " + "; ".join(map(str, errors)))
if not isinstance(inventory.get("items"), list):
    raise SystemExit("Malformed manager query response")
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
{ "schema_version": 1, "items": [{ "key": "AUTHORITATIVE_MANAGER_KEY" }] }
```

```sh
"$manager_cli" manager sync review --request selected.json
"$manager_cli" manager sync work --request selected.json
```

Inspect the JSON result and report every failed, removed, or synchronized record. Sync never creates a repository checkout or PR worktree.

## Materialize Review worktrees

Confirm that each queried item has `manager: "review"` and `location: "remote only"`. Show the user its repository/PR, title, key, `head_sha`, target path, freshness, and warnings. After exact confirmation, freeze key and head:

```json
{ "schema_version": 1, "items": [{ "key": "OWNER/REPOSITORY#NUMBER", "head_sha": "CONFIRMED_HEAD_SHA" }] }
```

```sh
"$manager_cli" review materialize --request review-materialize.json
```

The manager validates current PR identity/head, opens the registered primary repository workspace if necessary, creates the canonical linked review worktree, and verifies manager state. Multi-item requests belong in one request file. After command success, run a fresh authoritative `manager query` and require every requested Review record to have the expected materialized location/path and the confirmed head SHA, plus matching revision or checkout generation when those fields are present. Treat command success alone as insufficient; fail closed if any postcondition cannot be confirmed.

## Materialize Work worktrees

Confirm that each queried item has `manager: "work"` and `location: "remote only"`. Show its key, repository/PR, title, `revision`, `head_sha`, registered repository state, target path, and warnings. Freeze the exact values:

```json
{
  "schema_version": 1,
  "items": [{ "key": "REPOSITORY_ID:PR_NUMBER", "revision": 7, "head_sha": "CONFIRMED_HEAD_SHA" }]
}
```

```sh
"$manager_cli" work materialize --request work-materialize.json
```

The registered primary checkout must already exist. The manager may open it in Herdr, but must not clone during materialization. After command success, run a fresh authoritative `manager query` and require every requested Work record to have the expected materialized location/path, confirmed head SHA, and authoritative revision and checkout generation corresponding to the resulting checkout. Treat command success alone as insufficient; fail closed if any postcondition cannot be confirmed.

## Dematerialize managed worktrees

Dematerialization removes only manager-owned linked worktree resources after safety validation. It must not remove a primary checkout. Present local changes, unpublished history, active-process, workspace, branch, cleanup, and freshness warnings before confirmation.

For Review, freeze key, path, and head:

```json
{
  "schema_version": 1,
  "items": [
    {
      "key": "OWNER/REPOSITORY#NUMBER",
      "path": "/confirmed/review/path",
      "head_sha": "CONFIRMED_HEAD_SHA",
      "allow_warnings": false
    }
  ]
}
```

```sh
"$manager_cli" review dematerialize --request review-dematerialize.json
```

For Work, freeze key, record revision, and checkout generation:

```json
{
  "schema_version": 1,
  "items": [
    {
      "key": "checkout:REPOSITORY_ID:PATH_HASH",
      "revision": 8,
      "checkout_generation": "CONFIRMED_GENERATION",
      "allow_warnings": false
    }
  ]
}
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
