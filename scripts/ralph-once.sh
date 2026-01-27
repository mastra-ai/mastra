#!/bin/bash
set -e

# Usage: ./scripts/ralph-once.sh <plan-file> [phase-number]
# Example: ./scripts/ralph-once.sh thoughts/shared/plans/2025-01-23-admin-pg.md 3
# If phase-number is omitted, it will work on the first phase

if [ -z "$1" ]; then
  echo "Usage: $0 <plan-file> [phase-number]"
  echo "Example: $0 thoughts/shared/plans/2025-01-23-admin-pg.md 3"
  exit 1
fi

PLAN_FILE="$1"
PHASE_NUM="$2"

if [ ! -f "$PLAN_FILE" ]; then
  echo "Error: Plan file not found: $PLAN_FILE"
  exit 1
fi

# Try to extract phases - support multiple formats
# Format 1: ### Phase N: Description
PHASES=$(grep -E "^### Phase [0-9]+:" "$PLAN_FILE" 2>/dev/null | sed 's/^### //' || true)

# Format 2: ## Section headers that have numbered sub-sections (### N.N)
if [ -z "$PHASES" ]; then
  # Get ## headers that are implementation sections
  # Exclude common non-phase headers and version numbers (like ## 1.0.0)
  PHASES=$(grep -E "^## " "$PLAN_FILE" | \
    grep -v -E "^## (Overview|Summary|Success Criteria|Dependencies|Notes|References|Background|Introduction|Conclusion|Implementation Order|[0-9]+\.[0-9])" | \
    sed 's/^## //' || true)
fi

# Format 3: Numbered ## headers like ## 1. Setup, ## 2. Implementation
if [ -z "$PHASES" ]; then
  PHASES=$(grep -E "^## [0-9]+\." "$PLAN_FILE" 2>/dev/null | sed 's/^## //' || true)
fi

if [ -z "$PHASES" ]; then
  echo "Error: No phases found in plan file."
  echo "Expected one of these formats:"
  echo "  - '### Phase 1: Description'"
  echo "  - '## Section Name' (with ### N.N sub-sections)"
  echo "  - '## 1. Section Name'"
  exit 1
fi

PHASE_COUNT=$(echo "$PHASES" | wc -l | tr -d ' ')

if [ -n "$PHASE_NUM" ]; then
  # Get specific phase
  PHASE=$(echo "$PHASES" | sed -n "${PHASE_NUM}p")
  if [ -z "$PHASE" ]; then
    echo "Error: Phase $PHASE_NUM not found. Plan has $PHASE_COUNT phases."
    echo ""
    echo "Available phases:"
    echo "$PHASES" | nl
    exit 1
  fi
else
  # Get first phase (user should track progress externally or use ralph.sh for full automation)
  PHASE=$(echo "$PHASES" | head -n 1)
  PHASE_NUM=1
fi

echo "Working on: $PHASE"
echo "================================"

claude --dangerously-skip-permissions "@$PLAN_FILE \
You are implementing a technical plan. Focus on: $PHASE

Instructions:
1. Implement the current phase ($PHASE) following the plan exactly.
2. If the phase has sub-sections (like 1.1, 1.2, etc.), work through them in order.
3. Check that the types check via 'pnpm typecheck' and tests pass via 'pnpm test' (if applicable).
4. Make git commits as you complete meaningful units of work.
5. If you complete ALL items in the current phase, output <phase>COMPLETE</phase>.
6. If you encounter blockers that prevent completion, describe them clearly.

IMPORTANT: Only work on the current phase. Do not skip ahead.
"
