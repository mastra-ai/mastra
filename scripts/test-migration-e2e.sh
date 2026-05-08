#!/bin/bash
#
# E2E Migration Test Script
#
# This script tests the full migration workflow:
# 1. Sets up a database with old schema + duplicates
# 2. Verifies that storage init() throws
# 3. Runs `mastra migrate`
# 4. Verifies that storage init() now succeeds
#
# Usage:
#   ./scripts/test-migration-e2e.sh [pg|libsql|mongodb|mssql|clickhouse]
#
# Environment variables:
#   POSTGRES_URL - PostgreSQL connection string (default: postgres://postgres:postgres@localhost:5432/mastra_test)
#   MONGODB_URL - MongoDB connection string (default: mongodb://localhost:27017)
#   CLICKHOUSE_URL - ClickHouse URL (default: http://localhost:8123)
#   MSSQL_URL - MSSQL connection string (default: mssql://sa:Password123!@localhost:1433)
#
# Prerequisites:
#   - Docker running with database services (pnpm dev:services:up)
#   - Project built (pnpm build)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Default database URLs
POSTGRES_URL="${POSTGRES_URL:-postgres://postgres:postgres@localhost:5432/mastra_test}"
MONGODB_URL="${MONGODB_URL:-mongodb://localhost:27017}"
CLICKHOUSE_URL="${CLICKHOUSE_URL:-http://localhost:8123}"
MSSQL_URL="${MSSQL_URL:-mssql://sa:Password123!@localhost:1433}"

# Database-specific test configurations
DB_TYPE="${1:-pg}"

case "$DB_TYPE" in
    pg)
        TEST_DIR="$ROOT_DIR/stores/pg"
        TEST_FILE="src/storage/migration.test.ts"
        TEST_PATTERN="PostgreSQL Migration Required Error"
        ;;
    libsql)
        TEST_DIR="$ROOT_DIR/stores/libsql"
        TEST_FILE="src/storage/migration.test.ts"
        TEST_PATTERN="LibSQL Migration Required Error"
        ;;
    mongodb)
        TEST_DIR="$ROOT_DIR/stores/mongodb"
        TEST_FILE="src/storage/migration.test.ts"
        TEST_PATTERN="MongoDB Migration Required Error"
        ;;
    mssql)
        TEST_DIR="$ROOT_DIR/stores/mssql"
        TEST_FILE="src/storage/migration.test.ts"
        TEST_PATTERN="MSSQL Migration Required Error"
        ;;
    clickhouse)
        TEST_DIR="$ROOT_DIR/stores/clickhouse"
        TEST_FILE="src/storage/migration.test.ts"
        TEST_PATTERN="ClickHouse Migration Required Error"
        ;;
    all)
        log_info "Running E2E migration tests for all databases..."
        echo ""

        FAILED=0

        for db in pg libsql mongodb clickhouse; do
            log_info "Testing $db..."
            if "$SCRIPT_DIR/test-migration-e2e.sh" "$db"; then
                log_success "$db migration tests passed"
            else
                log_error "$db migration tests failed"
                FAILED=1
            fi
            echo ""
        done

        # MSSQL is optional (doesn't work on Mac)
        if [[ "$OSTYPE" != "darwin"* ]]; then
            log_info "Testing mssql..."
            if "$SCRIPT_DIR/test-migration-e2e.sh" mssql; then
                log_success "mssql migration tests passed"
            else
                log_error "mssql migration tests failed"
                FAILED=1
            fi
        else
            log_warn "Skipping mssql on macOS (not supported)"
        fi

        if [ $FAILED -eq 0 ]; then
            log_success "All E2E migration tests passed!"
            exit 0
        else
            log_error "Some E2E migration tests failed"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 [pg|libsql|mongodb|mssql|clickhouse|all]"
        exit 1
        ;;
esac

log_info "Running E2E migration tests for $DB_TYPE"
log_info "Test directory: $TEST_DIR"
log_info "Test pattern: $TEST_PATTERN"
echo ""

# Check if test directory exists
if [ ! -d "$TEST_DIR" ]; then
    log_error "Test directory not found: $TEST_DIR"
    exit 1
fi

# Check if test file exists
if [ ! -f "$TEST_DIR/$TEST_FILE" ]; then
    log_error "Test file not found: $TEST_DIR/$TEST_FILE"
    exit 1
fi

cd "$TEST_DIR"

# Run the migration tests
log_info "Running migration error tests..."
if pnpm vitest run "$TEST_FILE" --reporter=verbose -t "$TEST_PATTERN" 2>&1; then
    log_success "Migration error tests passed for $DB_TYPE"
else
    log_error "Migration error tests failed for $DB_TYPE"
    exit 1
fi

echo ""
log_success "E2E migration tests completed successfully for $DB_TYPE"
