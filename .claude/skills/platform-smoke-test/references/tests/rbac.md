# RBAC Testing (`--test rbac`)

## Purpose

Test role-based access control.

## Prerequisites

- Admin access to a project
- At least one team member (or ability to invite)
- Access to change roles

## Steps

### 1. Viewer Role Test

1. Invite or assign user as "Viewer"
2. As that user, verify:
   - [ ] ✅ Can view threads
   - [ ] ✅ Can view usage
   - [ ] ✅ Can view logs
   - [ ] ❌ Cannot modify project settings
   - [ ] ❌ Cannot create API keys
   - [ ] ❌ Cannot delete threads

### 2. Editor Role Test

1. Change user role to "Editor"
2. As that user, verify:
   - [ ] ✅ Can view threads, usage, logs
   - [ ] ✅ Can create API keys
   - [ ] ✅ Can delete threads
   - [ ] ❌ Cannot manage team members
   - [ ] ❌ Cannot change project settings

### 3. Admin Role Test

1. Change user role to "Admin"
2. As that user, verify:
   - [ ] ✅ Full access to all features
   - [ ] ✅ Can manage team members
   - [ ] ✅ Can change project settings
   - [ ] ✅ Can invite/remove users

### 4. Role Downgrade Test

1. Downgrade from Admin to Viewer
2. [ ] Verify access immediately restricted
3. [ ] Cannot access admin-only features

### 5. API Key Permissions

Test that API actions respect roles:

1. Create API key as Editor
2. Try to delete as Viewer
3. [ ] Viewer cannot delete Editor's key

## Role Permissions Matrix

| Action           | Viewer | Editor | Admin |
| ---------------- | ------ | ------ | ----- |
| View threads     | ✅     | ✅     | ✅    |
| View usage       | ✅     | ✅     | ✅    |
| View logs        | ✅     | ✅     | ✅    |
| Create API key   | ❌     | ✅     | ✅    |
| Delete threads   | ❌     | ✅     | ✅    |
| Project settings | ❌     | ❌     | ✅    |
| Manage team      | ❌     | ❌     | ✅    |
| Billing          | ❌     | ❌     | ✅    |

## Observations to Report

| Check     | What to Record                          |
| --------- | --------------------------------------- |
| Viewer    | Record what actions are allowed/blocked |
| Editor    | Record what actions are allowed/blocked |
| Admin     | Record what actions are allowed/blocked |
| Downgrade | Note when restrictions take effect      |

## Common Issues

| Issue                 | Cause                  | Fix             |
| --------------------- | ---------------------- | --------------- |
| Role not applying     | Cache                  | Refresh page    |
| Can access restricted | Bug                    | Note and report |
| Can't test            | Need multiple accounts | Use incognito   |

## Notes

- RBAC testing requires multiple accounts
- Use browser incognito for second account
- Note when role changes take effect
