# Task runner for Mastra Factory development. Bare `just` lists the recipes.
#
# Two ways to run the stack:
#   `just start` builds both sides and serves that build from :4111 alone.
#              Nothing is rebuilt while it runs, so edits land on the next run.
#   `just watch` runs the dev servers: the API rebundles on backend edits and
#              Vite hot-reloads the UI on :5173, proxying the API on :4111.
#
# `mastracode/web` is the API host and consumes the packages in this repo
# through `link:` dependencies, so `@mastra/factory` must be built before the
# API can see `src` changes.
import? '~/justfile'

web := justfile_directory() / "mastracode/web"
factory_ui := justfile_directory() / "mastracode/factory-ui"

api_url := "http://localhost:4111"
ui_url := "http://localhost:5173"

# Show available recipes. Named `_default` because `~/justfile` owns `default`.
[private]
_default:
    @just --list

# Build the factory and serve that build on :4111. Ignores later code changes.
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
    MASTRACODE_OUT_DIR="{{web}}/src/mastra/public/factory" pnpm --dir "{{factory_ui}}" build
    echo
    echo "Mastra Factory (built)"
    echo "  app  {{api_url}}   <- open this; the API server serves the SPA too"
    echo "  db   postgres :54329   redis :63799"
    echo "  factory dist and the SPA are frozen; rerun just start to rebuild them"
    echo
    # `mastra factory dev` is the only server that runs this repo's packages
    # through their `link:` dists — `mastra build` pins them to their published
    # npm versions, so a built-and-started bundle would ignore local changes.
    # Its watcher only reaches the host wiring under `mastracode/web/src/mastra`,
    # so editing those few files still restarts the API; factory and UI do not.
    cd "{{web}}" && MASTRACODE_PUBLIC_URL="{{api_url}}" pnpm api

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
    # :5173 is the Vite dev server, so it only answers under `just watch`; after
    # `just start` the SPA is served from :4111 and :5173 is correctly down.
    for target in "{{api_url}}" "{{ui_url}}"; do
      # curl prints its own "000" on a refused connection and exits non-zero, so
      # `|| true` keeps `set -e` happy without appending a second 000.
      code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$target" || true)
      # 000 means nothing answered; anything else (401 included) means it is serving.
      [ "$code" = 000 ] && echo "down  $target" || echo "up    $target  (HTTP $code)"
    done
    # Auth-gated, so this answers 401 unless a browser session cookie is present.
    echo
    echo "gitlab: $(curl -s --max-time 5 "{{api_url}}/web/gitlab/status" || echo 'unreachable')"
