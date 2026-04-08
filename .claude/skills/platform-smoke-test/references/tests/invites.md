# Team Invitation Testing (`--test invites`)

## Purpose

Test team invitation functionality.

## Prerequisites

- Admin access to a project
- Email address for test invitee
- (Ideally) Access to invitee's email

## Steps

### 1. Navigate to Team Settings

1. Open Dashboard
2. Navigate to Settings → Team

- [ ] Team page loads
- [ ] Current members listed

### 2. Send Invitation

1. Click "Invite team member"
2. Enter invitee email address
3. Select role (Viewer, Editor, or Admin)
4. Click "Send invitation"

- [ ] Invitation sent successfully
- [ ] Pending invitation appears in list

### 3. Verify Invitation Email (if possible)

- [ ] Email received by invitee
- [ ] Email contains invitation link
- [ ] Link leads to Gateway

### 4. Accept Invitation (if possible)

1. Open invitation link
2. Complete sign-up (if new user)
3. Accept invitation

- [ ] Invitee can now access the project

### 5. Verify Invitee Access

As invitee:

- [ ] Can see the project
- [ ] Can access resources (based on role)
- [ ] Appears in team list

### 6. Test Role Assignment

1. Invite with "Viewer" role
2. Verify limited access
3. Change to "Editor"
4. Verify expanded access

## Observations to Report

| Check        | What to Record                          |
| ------------ | --------------------------------------- |
| Send invite  | Record message shown after sending      |
| Pending list | Note if invitation appears              |
| Email        | Record if email received                |
| Accept       | Note if invitee can access project      |
| Role         | Record what permissions the invitee has |

## Common Issues

| Issue             | Cause         | Fix                     |
| ----------------- | ------------- | ----------------------- |
| Invite not sent   | Invalid email | Check email format      |
| No email received | Spam filter   | Check spam folder       |
| Can't accept      | Link expired  | Send new invitation     |
| Wrong permissions | Role mismatch | Update role in settings |

## Notes

- Invitations may expire after some time
- Some tests require a second account/email
- Test with email aliases for solo testing
