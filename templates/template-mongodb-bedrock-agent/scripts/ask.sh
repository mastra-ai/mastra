#!/usr/bin/env bash
# Pretty terminal demo of the DEPLOYED AgentCore runtime.
#   Usage: ./scripts/ask.sh "How do I define a tool in Mastra?"
#   Set AGENTCORE_USER_ID to your own identity for this trusted operator demo.
#
# Invokes the cloud runtime, strips the JSON envelope, and renders the markdown
# answer. If `glow` is installed (brew install glow) it renders in full color;
# otherwise it prints clean markdown source.
set -euo pipefail
: "${AGENTCORE_USER_ID:?Set AGENTCORE_USER_ID to your own identity before invoking the runtime}"

prompt="${*:-How do I define a tool in Mastra?}"

echo "▶ Asking the deployed AgentCore runtime…" >&2
answer=$(npx @aws/agentcore@0.31.1 invoke --user-id "$AGENTCORE_USER_ID" --json --prompt "$prompt" | jq -r '.response | fromjson | .response')

if command -v glow >/dev/null 2>&1; then
  printf '%s\n' "$answer" | glow -
else
  printf '%s\n' "$answer"
  echo "" >&2
  echo "💡 Tip: 'brew install glow' for rendered markdown (colors, code highlighting)." >&2
fi
