#!/usr/bin/env bash
set -euo pipefail
fixture=$(cd "$(dirname "$0")" && pwd)
consumer=${1:?Pass a new consumer directory}
bash "$fixture/../published-v1/run.sh" "$consumer"
cp "$fixture/native.ts" "$fixture/tsconfig.native.json" "$consumer/"
cd "$consumer"
pnpm exec tsc --noEmit -p tsconfig.native.json
pnpm exec tsc --outDir dist --noEmit false -p tsconfig.native.json
node dist/native.js
