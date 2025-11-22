#!/bin/bash

# Script to run all test files individually and report results
# Usage: ./run-tests-individually.sh [package-name]

set -e

PACKAGE=${1:-"core"}
RESULTS_FILE="test-results-${PACKAGE}.txt"

echo "Running tests for @mastra/${PACKAGE}" | tee "$RESULTS_FILE"
echo "======================================" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

# Find all test files
if [ "$PACKAGE" = "core" ]; then
  TEST_FILES=$(find packages/core/src -name "*.test.ts" -type f | grep -v node_modules | sort)
elif [ "$PACKAGE" = "memory" ]; then
  TEST_FILES=$(find packages/memory/src -name "*.test.ts" -type f | grep -v node_modules | sort)
elif [ "$PACKAGE" = "memory-integration" ]; then
  TEST_FILES=$(find packages/memory/integration-tests/src -name "*.test.ts" -type f | grep -v node_modules | sort)
elif [ "$PACKAGE" = "memory-integration-v5" ]; then
  TEST_FILES=$(find packages/memory/integration-tests-v5/src -name "*.test.ts" -type f | grep -v node_modules | sort)
else
  echo "Unknown package: $PACKAGE"
  echo "Available: core, memory, memory-integration, memory-integration-v5"
  exit 1
fi

TOTAL=0
PASSED=0
FAILED=0
SKIPPED=0

for test_file in $TEST_FILES; do
  TOTAL=$((TOTAL + 1))
  
  # Get relative path for display
  rel_path=$(echo "$test_file" | sed "s|packages/${PACKAGE}/||" | sed "s|packages/memory/integration-tests/||" | sed "s|packages/memory/integration-tests-v5/||")
  
  echo "[$TOTAL] Running: $rel_path" | tee -a "$RESULTS_FILE"
  
  # Determine which directory to run from
  if [ "$PACKAGE" = "core" ]; then
    TEST_DIR="packages/core"
    TEST_PATH="$test_file"
  elif [ "$PACKAGE" = "memory" ]; then
    TEST_DIR="packages/memory"
    TEST_PATH="$test_file"
  elif [ "$PACKAGE" = "memory-integration" ]; then
    TEST_DIR="packages/memory/integration-tests"
    TEST_PATH=$(echo "$test_file" | sed "s|packages/memory/integration-tests/||")
  elif [ "$PACKAGE" = "memory-integration-v5" ]; then
    TEST_DIR="packages/memory/integration-tests-v5"
    TEST_PATH=$(echo "$test_file" | sed "s|packages/memory/integration-tests-v5/||")
  fi
  
  # Run the test
  if cd "$TEST_DIR" && pnpm test "$TEST_PATH" > /tmp/test-output-$$.txt 2>&1; then
    echo "  ✅ PASSED" | tee -a "$RESULTS_FILE"
    PASSED=$((PASSED + 1))
  else
    # Check if it was skipped or failed
    if grep -q "no test files found" /tmp/test-output-$$.txt || grep -q "0 passed" /tmp/test-output-$$.txt; then
      echo "  ⏭️  SKIPPED (no tests)" | tee -a "$RESULTS_FILE"
      SKIPPED=$((SKIPPED + 1))
    else
      echo "  ❌ FAILED" | tee -a "$RESULTS_FILE"
      echo "     Error:" | tee -a "$RESULTS_FILE"
      tail -20 /tmp/test-output-$$.txt | sed 's/^/     /' | tee -a "$RESULTS_FILE"
      FAILED=$((FAILED + 1))
    fi
  fi
  
  cd - > /dev/null
  echo "" | tee -a "$RESULTS_FILE"
done

echo "======================================" | tee -a "$RESULTS_FILE"
echo "Summary:" | tee -a "$RESULTS_FILE"
echo "  Total:   $TOTAL" | tee -a "$RESULTS_FILE"
echo "  Passed:  $PASSED" | tee -a "$RESULTS_FILE"
echo "  Failed:  $FAILED" | tee -a "$RESULTS_FILE"
echo "  Skipped: $SKIPPED" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

if [ $FAILED -gt 0 ]; then
  echo "❌ Some tests failed. See $RESULTS_FILE for details." | tee -a "$RESULTS_FILE"
  exit 1
else
  echo "✅ All tests passed!" | tee -a "$RESULTS_FILE"
  exit 0
fi
