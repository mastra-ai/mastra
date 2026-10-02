#!/usr/bin/env bash
set -euo pipefail
core=$(realpath "${1:?Pass a packed core tarball}")
consumer=${2:?Pass a new consumer directory}
test -f "$core"
test ! -e "$consumer"
mkdir -p "$consumer"
fixture=$(cd "$(dirname "$0")" && pwd)
cp "$fixture/package.json" "$fixture/tsconfig.json" "$fixture/demo.ts" "$consumer/"
cd "$consumer"
pnpm add "@mastra/core@file:$core" --ignore-workspace --strict-peer-dependencies
pnpm exec tsc --noEmit
pnpm demo
