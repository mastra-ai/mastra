# Studio Deploy Testing (`--test studio`)

**Cloud only**: For `--env staging` or `--env production`.

## Purpose
Verify Studio deployment works and UI is accessible.

## Prerequisites
- Mastra platform account
- Project with at least one agent
- Authenticated via `mastra auth login`

## Steps

### 1. Set Environment
```bash
# For staging
export MASTRA_PLATFORM_API_URL=https://platform.staging.mastra.ai

# For production (default)
unset MASTRA_PLATFORM_API_URL
```

### 2. Authenticate
```bash
pnpx mastra@latest auth login
```
- [ ] Browser opens for OAuth
- [ ] Complete login flow
- [ ] CLI confirms authentication

### 3. Deploy Studio
```bash
pnpx mastra@latest studio deploy -y
```

**Watch for:**
- [ ] Build starts
- [ ] Build completes (note any warnings)
- [ ] Deploy starts
- [ ] **Capture Studio URL from output**

### 4. Handle Deploy Output

| Output | Action |
|--------|--------|
| Error/Failed | STOP - report error |
| Warning (observability, session) | Note and continue |
| Success + URL | Continue to verification |

### 5. Verify Studio Access
- [ ] Open Studio URL in browser
- [ ] Sign in if prompted
- [ ] Verify Studio UI loads
- [ ] Check agents list appears

### 6. Test Basic Functionality
- [ ] Navigate to `/agents`
- [ ] Click on an agent
- [ ] Send a test message
- [ ] Verify response

## Expected Results

| Check | Expected |
|-------|----------|
| Deploy | Completes without errors |
| URL | Valid Studio URL returned |
| Access | Can open and sign in |
| UI | Studio interface loads |
| Agents | At least one agent visible |

## Deploy URLs

| Environment | URL Pattern |
|-------------|-------------|
| Staging | `https://<project>.studio.staging.mastra.cloud` |
| Production | `https://<project>.studio.mastra.cloud` |

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Deploy hangs | Network issue | Check connectivity, retry |
| "Session expired" | Auth timeout | Re-run `auth login` |
| 404 after deploy | DNS propagation | Wait 1-2 minutes |
| Build fails | Code errors | Check build output |

## Notes

- First deploy may take longer (2-5 minutes)
- Subsequent deploys are faster
- Studio URL persists across deploys
- Check `projects.mastra.ai` to view all deployments
