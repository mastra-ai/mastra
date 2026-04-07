# Onboarding Testing (`--test onboarding`)

## Purpose
Test new user registration and onboarding flow.

## Prerequisites
- Email that hasn't been used on Gateway
- Browser with cleared cookies (or incognito)

## Steps

### 1. Navigate to Gateway
- [ ] Open `$GATEWAY_URL` in browser
- [ ] Landing page loads correctly

### 2. Start Sign Up
- [ ] Click "Sign up" / "Get started"
- [ ] Sign-up form appears

### 3. Verify Sign-up Methods
- [ ] Google SSO option available
- [ ] Email/password option available
- [ ] Both methods visually accessible

### 4. Complete Registration
Choose one method and complete:
- [ ] Registration form accepted
- [ ] No errors during process
- [ ] Redirected to dashboard or onboarding wizard

### 5. Verify Account Created
- [ ] Organization created automatically
- [ ] Default project created
- [ ] API key displayed

### 6. Copy API Key
- [ ] API key is copyable
- [ ] Copy button works
- [ ] Key format: `msk_...`

**Important**: Copy immediately - may not be shown again!

### 7. Onboarding State Persistence

**Tab Switch Test:**
1. Start a new onboarding flow (or "Create Project")
2. Before completing: Switch to another browser tab
3. Wait 5-10 seconds
4. Switch back to Gateway tab
5. [ ] Onboarding modal/flow still visible
6. [ ] Any entered data preserved

**Window Switch Test:**
1. Start fresh onboarding
2. Before completing: Switch to different workspace or minimize browser
3. Return to browser
4. [ ] Onboarding still in progress
5. [ ] Complete onboarding - API key shown

**Rapid Switch Test:**
1. Start onboarding
2. Rapidly switch tabs/windows 5-6 times
3. Return to Gateway
4. [ ] Onboarding state preserved

### 8. Verify Provider Attached
1. Complete onboarding
2. Navigate to Project → Settings → Providers
3. [ ] Provider is attached to project

### 9. Curl Command Accessibility
After onboarding:
1. [ ] Curl command example shown with your API key
2. [ ] Copy the curl command
3. Navigate away from page
4. [ ] Check if curl command accessible elsewhere (Settings? Docs?)
5. [ ] Command includes correct provider prefix in model

## Expected Results

| Check | Expected |
|-------|----------|
| Sign-up methods | Google + email available |
| Registration | Completes without error |
| Org/project | Created automatically |
| API key | Displayed and copyable |
| State persistence | Survives tab/window switch |
| Provider | Attached to project |

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Can't sign up | Email already used | Use new email |
| No API key shown | Onboarding incomplete | Complete all steps |
| State lost | Bug | Note and report |
| Provider not attached | Auto-attach failed | Add manually in settings |
