#!/bin/bash
set -e

# Usage: ./scripts/ralph.sh <plan-file> [max-iterations-per-phase]
# Example: ./scripts/ralph.sh thoughts/shared/plans/2025-01-23-admin-pg.md 10

if [ -z "$1" ]; then
  echo "Usage: $0 <plan-file> [max-iterations-per-phase]"
  echo "Example: $0 thoughts/shared/plans/2025-01-23-admin-pg.md 10"
  exit 1
fi

PLAN_FILE="$1"
MAX_ITERATIONS="${2:-10}"

if [ ! -f "$PLAN_FILE" ]; then
  echo "Error: Plan file not found: $PLAN_FILE"
  exit 1
fi

# Extract phase headers from the plan file
PHASES=$(grep -E "^### Phase [0-9]+:" "$PLAN_FILE" | sed 's/^### //')

if [ -z "$PHASES" ]; then
  echo "Error: No phases found in plan file. Expected headers like '### Phase 1: Description'"
  exit 1
fi

PHASE_COUNT=$(echo "$PHASES" | wc -l | tr -d ' ')
echo "Found $PHASE_COUNT phases in $PLAN_FILE"
echo "================================"
echo "$PHASES"
echo "================================"
echo ""

# Process each phase using a different file descriptor to avoid stdin conflicts
PHASE_NUM=0
while IFS= read -r PHASE <&3; do
  PHASE_NUM=$((PHASE_NUM + 1))
  echo ""
  echo "========================================"
  echo "STARTING: $PHASE"
  echo "========================================"
  echo ""

  for ((i=1; i<=$MAX_ITERATIONS; i++)); do
    echo "Phase $PHASE_NUM, Iteration $i"
    echo "--------------------------------"

    result=$(claude --dangerously-skip-permissions -p "@$PLAN_FILE \
You are implementing a technical plan. Focus on: $PHASE

Instructions:
1. Implement the current phase ($PHASE) following the plan exactly.
2. If the phase has sub-sections (like 1.1, 1.2, etc.), work through them in order.
3. Check that the types check via 'pnpm typecheck' and tests pass via 'pnpm test' (if applicable).
4. Make git commits as you complete meaningful units of work.
5. If you complete ALL items in the current phase, output <phase>COMPLETE</phase>.
6. If you encounter blockers that prevent completion, describe them clearly.

IMPORTANT: Only work on the current phase. Do not skip ahead.
" < /dev/null)

    echo "$result"

    if [[ "$result" == *"<phase>COMPLETE</phase>"* ]]; then
      echo ""
      echo "Phase complete: $PHASE"
      break
    fi

    if [ $i -eq $MAX_ITERATIONS ]; then
      echo ""
      echo "Warning: Reached max iterations ($MAX_ITERATIONS) for phase: $PHASE"
      echo "Continuing to next phase..."
    fi
  done
done 3<<< "$PHASES"

echo ""
echo "========================================"
echo "ALL PHASES PROCESSED"
echo "========================================"

# Send notification if tt is available
if command -v tt &> /dev/null; then
  tt notify "Ralph completed all phases in $PLAN_FILE"
fi
