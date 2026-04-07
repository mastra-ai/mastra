# Gateway Dashboard UI Testing

Detailed UI testing procedures for the Gateway dashboard.

## Dashboard URLs

| Environment | URL |
|-------------|-----|
| Production  | `https://gateway.mastra.ai` |
| Staging     | `https://gateway.staging.mastra.ai` |

## Onboarding Flow

### New User Registration

1. Navigate to dashboard URL
2. Click "Sign up" or "Get started"
3. Choose auth method:
   - Google SSO (primary)
   - Email (may not be available on all environments)
4. Complete authentication
5. **Verify**: Redirected to project page with API key visible

### First-Time Experience

After registration, verify:
- [ ] Organization created automatically
- [ ] Default project created
- [ ] API key generated and visible
- [ ] Curl command example shown
- [ ] Can copy API key and URL

## Projects Page

Path: `/orgs/{orgId}/projects`

### Verify

- [ ] Projects list loads
- [ ] Each project shows name and status
- [ ] Can click into project
- [ ] Can create new project

### Project Card

Each project card should show:
- Project name
- Status indicator
- Quick actions (if any)

## Threads Page

Path: `/orgs/{orgId}/projects/{projectId}/threads`

### Verify

- [ ] Thread list loads
- [ ] Shows thread IDs
- [ ] Shows message counts
- [ ] Shows last activity time
- [ ] Can click into thread detail

### Thread Detail View

- [ ] Messages displayed in order
- [ ] User/assistant messages styled differently
- [ ] Timeline/flame graph loads
- [ ] Can delete thread

## Logs Page

Path: `/orgs/{orgId}/projects/{projectId}/logs`

### Verify

- [ ] Logs table loads
- [ ] Shows recent requests
- [ ] Columns: Time, Model, Tokens, Cost, Status
- [ ] Can expand log entry for details
- [ ] Can filter by date range

### Log Entry Details

Each log should show:
- Request timestamp
- Model used
- Token counts (prompt, completion, total)
- Cost breakdown
- Cache stats (if applicable)
- Status (success/error)

## Usage Page

Path: `/orgs/{orgId}/projects/{projectId}/usage`

### Verify

- [ ] Usage charts render
- [ ] Cost tab shows breakdown
- [ ] Token counts accurate
- [ ] Model breakdown chart works
- [ ] Date range selector works
- [ ] Memory tokens tracked separately (if OM enabled)

### Tabs

1. **Cost** - Should be first tab
   - Total cost
   - Breakdown by model
   - Time series chart

2. **Tokens**
   - Prompt tokens
   - Completion tokens
   - Total tokens
   - Memory/OM tokens (separate)

3. **Model Breakdown**
   - Stacked bar chart
   - Breakdown by provider/model

## Settings Page

Path: `/orgs/{orgId}/projects/{projectId}/settings`

### Project Settings

- [ ] Project name displayed
- [ ] Can edit project name (if admin)

### OM Thresholds

- [ ] Thresholds displayed
- [ ] Default values correct
- [ ] Can modify thresholds

### API Keys

- [ ] List of API keys
- [ ] Can create new key
- [ ] Can delete key
- [ ] Can see key details (admin only)

### Provider Keys (BYOK)

- [ ] Can add OpenAI key
- [ ] Can add Anthropic key
- [ ] Can add Google key
- [ ] Keys are masked after saving

## Team Settings

Path: `/orgs/{orgId}/settings/team`

### Verify

- [ ] Team members listed
- [ ] Roles displayed (Admin, Editor, Viewer)
- [ ] Can invite new member
- [ ] Can change member role (if admin)
- [ ] Can remove member (if admin)

## Navigation

### Sidebar

- [ ] Projects link works
- [ ] Settings link works
- [ ] Account switcher works (if multiple orgs)
- [ ] Sign out works

## Responsive Behavior

Test on different viewport sizes:
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)

## Browser Compatibility

Test on:
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge
