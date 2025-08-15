# Redirect Testing Guide

This guide explains how to automatically test your locale-aware redirects to ensure they work correctly.

## Quick Start

### Test Locally During Development

```bash
# Start your dev server in one terminal
pnpm dev

# In another terminal, run all tests
pnpm test:all-redirects
```

### Test Against Production

```bash
# Test against your production site
TEST_BASE_URL=https://docs.mastra.ai pnpm test:all-redirects --skip-server-start
```

## Available Test Commands

### Basic Redirect Tests

```bash
# Test all redirects from next.config.mjs
pnpm test:redirects

# Test against specific URL
TEST_BASE_URL=https://example.com pnpm test:redirects
```

### Locale-Specific Tests

```bash
# Test locale-specific redirect scenarios
pnpm test:locale-redirects

# Tests things like:
# - /en/docs/old-path → /en/docs/new-path
# - /ja/docs/old-path → /ja/docs/new-path
# - /docs/old-path → /en/docs/new-path (fallback)
```

### Comprehensive Test Suite

```bash
# Run all tests (recommended)
pnpm test:all-redirects

# With custom URL
TEST_BASE_URL=https://staging.mastra.ai pnpm test:all-redirects --skip-server-start
```

## Test Reports

After running tests, you'll get several reports:

### 📄 Generated Files

- `redirect-test-results.json` - Raw test data
- `redirect-test-report.md` - Comprehensive redirect test report
- `locale-redirect-test-results.json` - Raw locale test data
- `locale-redirect-test-report.md` - Locale-specific test report
- `combined-test-report.md` - Combined summary report

### 📊 Report Contents

- Success/failure rates
- Detailed error information
- Status code validation
- Redirect chain analysis
- Performance metrics

## Continuous Integration

### GitHub Actions

The tests automatically run on:

- Pull requests that modify `next.config.mjs` or docs content
- Pushes to main branch
- Manual workflow dispatch

### Local Pre-commit Testing

Add to your workflow:

```bash
# Before committing redirect changes
pnpm test:all-redirects

# If tests pass, commit your changes
git add .
git commit -m "Update redirects"
```

## Test Scenarios Covered

### ✅ Basic Redirect Functionality

- All redirects defined in `next.config.mjs`
- Correct status codes (301 vs 302)
- Proper destination URLs
- Redirect chain handling

### 🌍 Locale-Aware Testing

- English locale redirects (`/en/docs/...`)
- Japanese locale redirects (`/ja/docs/...`)
- Fallback redirects (non-locale URLs → English)
- Wildcard redirects with locales

### 🔍 Edge Cases

- Invalid locales (should 404)
- Case sensitivity
- Anchor links preservation
- Complex redirect chains

### ⚡ Performance Testing

- Response time monitoring
- Concurrent request handling
- Server resource usage

## Troubleshooting

### Common Issues

#### Tests Fail Locally

```bash
# Make sure your dev server is running
pnpm dev

# Check if port 3000 is available
lsof -ti:3000

# Run tests with debug output
DEBUG=1 pnpm test:all-redirects
```

#### Tests Pass Locally But Fail in CI

```bash
# Test against your deployed staging environment
TEST_BASE_URL=https://staging.mastra.ai pnpm test:all-redirects --skip-server-start
```

#### Redirect Not Working as Expected

1. Check the redirect definition in `next.config.mjs`
2. Verify the source and destination paths
3. Test the specific redirect:
   ```bash
   curl -I http://localhost:3000/your/source/path
   ```

### Debug Mode

```bash
# Enable detailed logging
DEBUG=1 pnpm test:all-redirects

# Test specific redirect patterns
node scripts/test-redirects.js --pattern="/docs/agents/*"
```

## Writing Custom Tests

### Add New Test Cases

Edit `scripts/test-locale-redirects.js`:

```javascript
// Add your custom test cases
const customTests = [
  {
    name: "My custom redirect test",
    source: "/my/old/path",
    expectedDestination: "/my/new/path",
    permanent: true,
  },
];
```

### Test Against Different Environments

```bash
# Development
TEST_BASE_URL=http://localhost:3000 pnpm test:all-redirects

# Staging
TEST_BASE_URL=https://staging.mastra.ai pnpm test:all-redirects --skip-server-start

# Production
TEST_BASE_URL=https://docs.mastra.ai pnpm test:all-redirects --skip-server-start
```

## Migration Testing

### After Redirect Migration

```bash
# Test the migration
pnpm migrate:redirects

# Verify all redirects still work
pnpm test:all-redirects

# Check the backup was created
ls -la next.config.mjs.backup.*
```

### Rollback if Needed

```bash
# Restore from backup
cp next.config.mjs.backup.TIMESTAMP next.config.mjs

# Verify rollback worked
pnpm test:all-redirects
```

## Best Practices

### 🎯 Regular Testing

- Run tests before deploying redirect changes
- Test both locally and against staging
- Include redirect tests in your CI/CD pipeline

### 📊 Monitor Results

- Review test reports for patterns
- Track redirect performance over time
- Monitor for redirect loops or chains

### 🔄 Maintenance

- Clean up old redirects periodically
- Update tests when adding new content areas
- Keep test reports for historical analysis

## Command Reference

| Command                      | Purpose                           |
| ---------------------------- | --------------------------------- |
| `pnpm test:redirects`        | Test all redirects from config    |
| `pnpm test:locale-redirects` | Test locale-specific scenarios    |
| `pnpm test:all-redirects`    | Run comprehensive test suite      |
| `pnpm migrate:redirects`     | Convert redirects to locale-aware |

## Environment Variables

| Variable            | Purpose                  | Default                 |
| ------------------- | ------------------------ | ----------------------- |
| `TEST_BASE_URL`     | Target URL for testing   | `http://localhost:3000` |
| `SKIP_SERVER_START` | Skip starting dev server | `false`                 |
| `DEBUG`             | Enable debug logging     | `false`                 |

---

## Need Help?

- Check the test reports for detailed error information
- Review the [Nextra i18n documentation](https://nextra.site/docs/guide/i18n)
- Examine the generated reports in the `docs/` directory
