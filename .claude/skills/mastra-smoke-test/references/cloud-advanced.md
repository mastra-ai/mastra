# Cloud Advanced Testing

Advanced test flows for `--env staging` and `--env production`.

## Account Creation Flow (`--test account`)

Tests new user registration entry points.

### Via Studio (`studio.mastra.ai`)

1. Navigate to `https://studio.mastra.ai` (or `https://studio.staging.mastra.ai` for staging)
2. Click "Sign up" / "Get started"
3. Complete registration flow
4. Verify redirected to project creation or dashboard

### Via Gateway (`gateway.mastra.ai`)

1. Navigate to `https://gateway.mastra.ai` (or staging equivalent)
2. Complete registration flow
3. Verify account created and API key accessible

## Invitation Flow (`--test invites`)

Tests team invitation functionality.

1. Navigate to deployed Studio → Settings → Team
2. Click "Invite team member"
3. Enter email address for test teammate
4. Send invitation
5. (If possible) Accept invitation from another account
6. Verify invited user can access the project

## RBAC Testing (`--test rbac`)

Tests role-based access control.

### Viewer Role

1. Invite a team member with "Viewer" role
2. As that user, verify:
   - ✅ Can view agents, tools, workflows
   - ❌ Cannot modify or delete resources
   - ❌ Cannot change project settings

### Editor Role

1. Change role to "Editor"
2. Verify:
   - ✅ Can view agents, tools, workflows
   - ✅ Can modify agents, tools, workflows
   - ❌ Cannot change team settings

### Admin Role

1. Change role to "Admin"
2. Verify:
   - ✅ Full access to all features
   - ✅ Can manage team members
   - ✅ Can change project settings

## BYOK Testing (`--byok`)

Tests bring-your-own-key functionality.

### Via HTTP Header

```bash
# Test with OpenAI key via header
curl -X POST https://<project>.server.<env>.mastra.cloud/api/agents/weather-agent/generate \
  -H "Content-Type: application/json" \
  -H "x-openai-api-key: sk-your-openai-key" \
  -d '{"messages": [{"role": "user", "content": "What is the weather in Tokyo?"}]}'
```

### Via Project Settings

1. Navigate to Studio → Settings → API Keys
2. Add OpenAI/Anthropic/Google API key
3. Verify agents use the configured key instead of default

## Extended Test Verification Checklist

| Category    | Test              | Expected Result                           | Status |
| ----------- | ----------------- | ----------------------------------------- | ------ |
| **Account** | Studio sign-up    | New account created, dashboard accessible | ⬜     |
| **Account** | Gateway sign-up   | New account created, API key accessible   | ⬜     |
| **Invites** | Send invitation   | Email sent to invitee                     | ⬜     |
| **Invites** | Accept invitation | Invitee can access project                | ⬜     |
| **RBAC**    | Viewer role       | Read-only access, no modifications        | ⬜     |
| **RBAC**    | Editor role       | Can modify, cannot manage team            | ⬜     |
| **RBAC**    | Admin role        | Full access to all features               | ⬜     |
| **BYOK**    | Header key        | Agent uses key from header                | ⬜     |
| **BYOK**    | Settings key      | Agent uses key from project settings      | ⬜     |
| **Storage** | DB connector      | Project works with selected DB            | ⬜     |
