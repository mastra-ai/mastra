#!/usr/bin/env bash
set -euo pipefail
fixture=$(cd "$(dirname "$0")" && pwd)
core=$(realpath "${1:?Pass a packed core tarball}")
consumer=${2:?Pass a new consumer directory}
bash "$fixture/../published-v1/run.sh" "$core" "$consumer"
cp "$fixture/native.ts" "$fixture/tsconfig.native.json" "$consumer/"
cd "$consumer"
pnpm exec tsc --noEmit -p tsconfig.native.json
pnpm exec tsc --outDir dist --noEmit false -p tsconfig.native.json
node dist/native.js
