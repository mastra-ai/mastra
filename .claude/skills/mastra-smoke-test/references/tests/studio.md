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

- [ ] Note if browser opens for OAuth
- [ ] Record login flow completion
- [ ] Record CLI authentication confirmation

### 3. Deploy Studio

```bash
pnpx mastra@latest studio deploy -y
```

**Record:**

- [ ] Note if build starts
- [ ] Record build completion and any warnings
- [ ] Note if deploy starts
- [ ] **Capture Studio URL from output**

### 4. Handle Deploy Output

| Output                           | Action                   |
| -------------------------------- | ------------------------ |
| Error/Failed                     | STOP - report error      |
| Warning (observability, session) | Note and continue        |
| Success + URL                    | Continue to verification |

### 5. Observe Studio Access

- [ ] Open Studio URL in browser
- [ ] Note if sign-in is prompted
- [ ] Record whether Studio UI loads
- [ ] Record which agents appear in list

### 6. Test Basic Functionality

- [ ] Navigate to `/agents`
- [ ] Click on an agent
- [ ] Send a test message
- [ ] Record the response

## Observations to Report

| Check  | What to Record                            |
| ------ | ----------------------------------------- |
| Deploy | Completion status, any errors or warnings |
| URL    | Studio URL returned                       |
| Access | Sign-in behavior, UI load status          |
| UI     | What interface elements appear            |
| Agents | Which agents are visible                  |

## Deploy URLs

| Environment | URL Pattern                                     |
| ----------- | ----------------------------------------------- |
| Staging     | `https://<project>.studio.staging.mastra.cloud` |
| Production  | `https://<project>.studio.mastra.cloud`         |

## Common Issues

| Issue             | Cause           | Fix                       |
| ----------------- | --------------- | ------------------------- |
| Deploy hangs      | Network issue   | Check connectivity, retry |
| "Session expired" | Auth timeout    | Re-run `auth login`       |
| 404 after deploy  | DNS propagation | Wait 1-2 minutes          |
| Build fails       | Code errors     | Check build output        |

## Studio vs Server: When to Use Each

| Deploy          | What It Does           | Use For                                         |
| --------------- | ---------------------- | ----------------------------------------------- |
| `studio deploy` | Deploys the Studio UI  | Interactive testing, viewing traces, debugging  |
| `server deploy` | Deploys the API server | API access, production use, programmatic access |

**Typical flow:**

1. Deploy Studio first (for UI access)
2. Deploy Server (for API access)
3. Test via both UI and API
4. Check if Server traces appear in Studio

**You can deploy one without the other**, but:

- Studio-only: No API access, can't test server traces
- Server-only: No UI, must use curl/API clients

## Notes

- First deploy may take longer (2-5 minutes)
- Subsequent deploys are faster
- Studio URL persists across deploys
- Check `projects.mastra.ai` to view all deployments
