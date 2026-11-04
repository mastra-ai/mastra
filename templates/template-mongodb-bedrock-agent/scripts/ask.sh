#!/usr/bin/env bash
# Pretty terminal demo of the DEPLOYED AgentCore runtime.
#   Usage: ./scripts/ask.sh "How do I define a tool in Mastra?"
#
# Invokes the cloud runtime, strips the JSON envelope, and renders the markdown
# answer. If `glow` is installed (brew install glow) it renders in full color;
# otherwise it prints clean markdown source.
set -euo pipefail

prompt="${*:-How do I define a tool in Mastra?}"
payload=$(jq -Rn --arg p "$prompt" '{prompt:$p}')

echo "▶ Asking the deployed AgentCore runtime…" >&2
answer=$(npx @aws/agentcore invoke --json "$payload" 2>/dev/null | jq -r '.response | fromjson | .response')

if command -v glow >/dev/null 2>&1; then
  printf '%s\n' "$answer" | glow -
else
  printf '%s\n' "$answer"
  echo "" >&2
  echo "💡 Tip: 'brew install glow' for rendered markdown (colors, code highlighting)." >&2
fi
