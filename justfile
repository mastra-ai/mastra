# Task runner for Mastra Factory development. Bare `just` lists the recipes.
#
# Two ways to run the stack:
#   `just start` builds both sides and serves that build from :4111 (or the
#              next free port in 4111–4131). Nothing is rebuilt while it runs,
#              so edits land on the next run.
#   `just watch` runs the dev servers: the API rebundles on backend edits and
#              Vite hot-reloads the UI on :5173, proxying the API on :4111.
#
# `mastracode/web` is the API host and consumes the packages in this repo
# through `link:` dependencies, so `@mastra/factory` must be built before the
# API can see `src` changes.
#
# `~/justfile` carries the personal recipes. These two give this file
# precedence, so a recipe or variable name defined in both is the repo's
# version instead of a hard redefinition error that blocks every recipe.
# Variables need their own setting: a colliding `web` or `api_url` aborts the
# whole invocation exactly like a colliding recipe name does.
set allow-duplicate-recipes := true
set allow-duplicate-variables := true

import? '~/justfile'

web := justfile_directory() / "mastracode/web"
factory_ui := justfile_directory() / "mastracode/factory-ui"

api_url := "http://localhost:4111"
ui_url := "http://localhost:5173"

# Show available recipes.
default:
    @just --list

# First free TCP port from `preferred` through preferred+20. Prints the port.
[private]
_free-api-port preferred="4111":
    #!/usr/bin/env bash
    set -euo pipefail
    start="{{preferred}}"
    # PORT is whatever the caller exported. Arithmetic on a non-number aborts
    # under `set -u` naming a bash internal, so reject it here with the value.
    if ! [[ "$start" =~ ^[0-9]+$ ]]; then
      echo "_free-api-port: expected a port number, got '${start}'" >&2
      exit 1
    fi
    last=$((start + 20))
    # Decide by attempting the bind, the way `mastra factory dev` does: it picks
    # its port with get-port, which binds rather than connects. A connect probe
    # misses any listener on an address it does not dial -- an IPv6-only socket,
    # say -- and hands back a port the server then refuses. The host list below
    # mirrors get-port's own: the wildcard plus every local interface address,
    # skipping addresses this machine cannot bind at all.
    node -e '
      const net = require("node:net");
      const os = require("node:os");
      const [start, last] = process.argv.slice(1).map(Number);
      const hosts = [undefined, "0.0.0.0"];
      for (const addresses of Object.values(os.networkInterfaces())) {
        for (const { address } of addresses ?? []) hosts.push(address);
      }
      const bindable = (port, host) =>
        new Promise((resolve, reject) => {
          const server = net.createServer();
          server.unref();
          server.once("error", reject);
          server.listen({ port, host, exclusive: true }, () => server.close(() => resolve()));
        });
      const isFree = async port => {
        for (const host of hosts) {
          try {
            await bindable(port, host);
          } catch (err) {
            // The address exists on no bindable interface here, so it says
            // nothing about the port; anything else means the port is taken.
            if (err.code === "EADDRNOTAVAIL" || err.code === "EINVAL") continue;
            return false;
          }
        }
        return true;
      };
      (async () => {
        for (let port = start; port <= last; port++) {
          if (await isFree(port)) {
            console.log(port);
            return;
          }
        }
        console.error(`no free port in ${start}-${last}`);
        process.exit(1);
      })();
    ' "$start" "$last"

# Origin of this project's factory API, from the dev server's own lockfile, or
# nothing when no live server owns it. Every recipe here reaches the API through
# `mastra factory dev`, which records the host and port it bound in
# `.mastra/dev.lock`, so this follows a port shift instead of assuming :4111 and
# never attributes another checkout's server on :4111 to this one.
[private]
_api-origin:
    #!/usr/bin/env bash
    set -euo pipefail
    node -e '
      const fs = require("node:fs");
      try {
        const lock = JSON.parse(fs.readFileSync(process.argv[1], "utf-8"));
        // The lockfile outlives a crashed server, so the pid decides whether
        // its host/port still describe anything. EPERM means the process is
        // there but owned by someone else, which still counts as running.
        try {
          process.kill(lock.pid, 0);
        } catch (err) {
          if (err.code !== "EPERM") throw err;
        }
        // A pre-host/port lockfile (a bare pid) names a live server whose
        // origin it does not record, so treat it as unknown rather than guess.
        if (lock.host && lock.port) console.log(`http://${lock.host}:${lock.port}`);
      } catch {
        // No lockfile, unparseable, or a dead pid: nothing is serving.
      }
    ' "{{web}}/.mastra/dev.lock"

# Build the factory and serve that build on :4111, or the next free port.
[group('run')]
start:
    #!/usr/bin/env bash
    set -euo pipefail
    # Postgres (+pgvector) and Redis behind DATABASE_URL/REDIS_URL. The package
    # script passes `--wait`, so this blocks until both containers are healthy
    # and the API never boots against a database that is still starting.
    pnpm --dir "{{web}}" db:up
    just build-factory
    # Build the SPA into the Mastra entry's public dir. The API server runs with
    # that dir as its cwd, so `mastra factory dev` finds `factory/index.html`
    # there and serves the built SPA itself: one origin, no Vite, no HMR.
    # The UI's workspace dependencies (@mastra/playground-ui and friends) are
    # consumed through their dists, so build those first: the SPA build below
    # is a bare `pnpm --dir` call that knows nothing of the workspace graph and
    # fails to resolve any export a stale dist is missing. `^...` is the
    # dependencies of factory-ui without factory-ui itself, which stays out of
    # turbo so MASTRACODE_OUT_DIR reaches it and its output escapes the cache.
    # The package name, not the path: `./mastracode/factory-ui^...` keeps the
    # package in the selection and rebuilds the SPA into the wrong directory.
    pnpm turbo build --filter '@internal/factory-ui^...'
    MASTRACODE_OUT_DIR="{{web}}/src/mastra/public/factory" pnpm --dir "{{factory_ui}}" build
    # Probe right before bind so a long build does not race a port that frees
    # (or is taken) in the meantime. Range matches `mastra factory dev` (4111–4131).
    preferred="${PORT:-4111}"
    port="$(just _free-api-port "$preferred")"
    # Not `api_url`: that is a just variable this file's header flags as a
    # collision hazard, and one name with two meanings invites a future
    # `{{api_url}}` that reads correct and points at the wrong port.
    origin="http://localhost:${port}"
    echo
    echo "Mastra Factory (built)"
    echo "  app  ${origin}   <- open this; the API server serves the SPA too"
    if [ "$port" != "$preferred" ]; then
      echo "  :${preferred} was in use; using :${port} (OAuth callbacks must match this origin)"
    fi
    echo "  db   postgres :54329   redis :63799"
    echo "  factory dist and the SPA are frozen; rerun just start to rebuild them"
    echo
    # `mastra factory dev` is the only server that runs this repo's packages
    # through their `link:` dists — `mastra build` pins them to their published
    # npm versions, so a built-and-started bundle would ignore local changes.
    # Its watcher only reaches the host wiring under `mastracode/web/src/mastra`,
    # so editing those few files still restarts the API; factory and UI do not.
    # PORT is exported so `pnpm api`'s `PORT=${PORT:-4111}` keeps the free port
    # instead of pinning 4111 and disabling the CLI's own fallback.
    cd "{{web}}" && PORT="$port" MASTRACODE_PUBLIC_URL="$origin" pnpm api

# Watch backend and UI and hot reload both: API on :4111, Vite HMR on :5173.
[group('run')]
watch:
    #!/usr/bin/env bash
    set -euo pipefail
    # See the comment in `start`: --wait keeps the API off a starting database.
    pnpm --dir "{{web}}" db:up
    # The dev server bundles the API entry on boot, so factory dist has to exist
    # before it starts; `turbo watch` below only keeps it fresh afterwards.
    just build-factory
    # Children share this process group, so one Ctrl-C takes down the stack
    # instead of orphaning the API and leaving its dev-server lock held.
    trap 'kill 0' EXIT
    echo
    echo "Mastra Factory (watch)"
    echo "  api  {{api_url}}"
    echo "  ui   {{ui_url}}   <- open this"
    echo "  db   postgres :54329   redis :63799"
    echo "  factory src -> dist on save, the API rebundles, Vite HMRs the UI"
    echo
    (cd "{{web}}" && MASTRACODE_PUBLIC_URL="{{api_url}}" pnpm api) &
    (pnpm turbo watch build --filter ./mastracode/factory) &
    (cd "{{factory_ui}}" && MASTRACODE_API_TARGET="{{api_url}}" pnpm dev) &
    wait

# Start only the factory API server on :4111 (agents, intake, integrations).
[group('run')]
api:
    # MASTRACODE_PUBLIC_URL is passed explicitly because the package script
    # defaults it to :5173, which would break OAuth redirect URIs registered
    # against :4111 (GitLab's app, and the platform's auth callback).
    cd "{{web}}" && MASTRACODE_PUBLIC_URL="{{api_url}}" pnpm api

# Start only the factory UI on :5173, proxying every API call to :4111.
[group('run')]
ui:
    cd "{{factory_ui}}" && MASTRACODE_API_TARGET="{{api_url}}" pnpm dev

# Rebuild the factory package after editing it, so the linked API host sees it.
[group('build')]
build-factory:
    pnpm turbo build --filter ./mastracode/factory

# Kill a factory dev server that outlived its terminal and still holds the lock.
[group('run')]
stop:
    #!/usr/bin/env bash
    set -euo pipefail
    # The CLI allows one dev server per project; a crashed run keeps the lock and
    # every restart then fails with "Another development server instance is
    # already running". pkill returns 1 when nothing matched, which is not an error.
    stopped=0
    if pkill -f 'factory dev'; then
      echo "stopped the factory dev server"
      stopped=1
    fi
    if pkill -f 'turbo watch build --filter ./mastracode/factory'; then
      echo "stopped the factory watch"
      stopped=1
    fi
    if [ "$stopped" -eq 0 ]; then
      echo "no factory dev server running"
    fi

# Report what is up, and how GitLab intake is authenticated.
[group('run')]
status:
    #!/usr/bin/env bash
    set -euo pipefail
    # The API origin comes from the dev lockfile, not the `api_url` constant,
    # because `start` may have shifted off :4111; probing :4111 blind would
    # report a server that belongs to another checkout as this one's. An empty
    # origin means no live server owns the lock, so there is nothing to probe.
    api_origin="$(just _api-origin)"
    # :5173 is the Vite dev server, so it only answers under `just watch`; after
    # `just start` the SPA is served from the API origin and :5173 is correctly
    # down.
    if [ -n "$api_origin" ]; then
      targets=("$api_origin" "{{ui_url}}")
    else
      echo "down  factory api  (no live dev server owns .mastra/dev.lock)"
      targets=("{{ui_url}}")
    fi
    for target in "${targets[@]}"; do
      # curl prints its own "000" on a refused connection and exits non-zero, so
      # `|| true` keeps `set -e` happy without appending a second 000.
      code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$target" || true)
      # 000 means nothing answered; anything else (401 included) means it is serving.
      [ "$code" = 000 ] && echo "down  $target" || echo "up    $target  (HTTP $code)"
    done
    # Auth-gated, so this answers 401 unless a browser session cookie is present.
    echo
    if [ -n "$api_origin" ]; then
      echo "gitlab: $(curl -s --max-time 5 "${api_origin}/web/gitlab/status" || echo 'unreachable')"
    else
      echo "gitlab: no api server to ask"
    fi
