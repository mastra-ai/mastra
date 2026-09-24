#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .scratch/tmp .scratch/npm-cache
export TMPDIR="$PWD/.scratch/tmp"
export npm_config_cache="$PWD/.scratch/npm-cache"
export TSX_DISABLE_CACHE=1
npm ci --workspaces=false --include=dev --ignore-scripts --no-audit --no-fund
npm run build --workspaces=false
npm pack --workspaces=false --pack-destination .scratch
npm ci --prefix examples/editorial-review --workspaces=false --install-links --include=dev --ignore-scripts --no-audit --no-fund
npm install --prefix examples/editorial-review --workspaces=false --no-save --include=dev --ignore-scripts --no-audit --no-fund "$PWD/.scratch/renderinc-mastra-0.0.0.tgz"
