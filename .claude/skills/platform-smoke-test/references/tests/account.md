# Account Creation Testing (`--test account`)

## Purpose

Test new user account creation for Gateway.

## Prerequisites

- Email that hasn't been used on Gateway
- Browser with cleared cookies (or incognito)

## Steps

### 1. Navigate to Gateway

```
Open: $GATEWAY_URL
```

- [ ] Landing page loads

### 2. Start Registration

- [ ] Click "Sign up" or "Get started"
- [ ] Registration form appears

### 3. Complete Registration

**Via Google SSO:**

1. Click "Continue with Google"
2. Select/enter Google account
3. Authorize access
4. [ ] Redirected to dashboard

**Via Email:**

1. Enter email address
2. Enter password
3. Click "Sign up"
4. [ ] Verify email (if required)
5. [ ] Redirected to dashboard

### 4. Verify Account Created

- [ ] You're logged in
- [ ] Organization created (check top-left)
- [ ] Default project exists

### 5. Verify API Key

- [ ] API key displayed
- [ ] Can copy the key
- [ ] Key format: `msk_...`

### 6. Test Account Features

- [ ] Can create new project
- [ ] Can access settings
- [ ] Can view usage

## Observations to Report

| Check           | What to Record                             |
| --------------- | ------------------------------------------ |
| Registration    | Record if it completes, note any errors    |
| Org created     | Note if organization appears automatically |
| Project created | Note if default project exists             |
| API key         | Record if displayed and copyable           |

## Common Issues

| Issue                  | Cause                 | Fix                          |
| ---------------------- | --------------------- | ---------------------------- |
| "Email already exists" | Account exists        | Use different email or login |
| No API key             | Onboarding incomplete | Check if wizard still open   |
| Can't access dashboard | Auth failed           | Try login instead            |

## Notes

- This test requires a fresh email
- For testing, consider using email aliases (e.g., `user+test1@example.com`)
- Account creation may trigger verification email
