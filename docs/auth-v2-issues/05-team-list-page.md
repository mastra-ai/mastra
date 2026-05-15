# Team list page

## Type

Feature

## Priority

P1

## Estimate

2.5 days (includes invite flow)

## Description

Build the Team tab in Studio that lists all team members who can access Studio, with the ability to invite new members. This is the internal user management view.

## Requirements

### Team List

- [ ] Add "Team" nav item in sidebar (requires `team:read` permission)
- [ ] Team list page at `/team`
- [ ] Table showing: avatar, name, email, role(s), last active
- [ ] Search by name/email
- [ ] Filter by role
- [ ] Pagination
- [ ] Click row to navigate to member detail page
- [ ] Empty state when no team members
- [ ] Loading state while fetching
- [ ] Error state if API fails

### Invite Flow

- [ ] "Invite" button (requires `team:write` permission)
- [ ] Invite modal with: email input, role selector (optional)
- [ ] Call provider's `sendInvitation()` (WorkOS handles email delivery)
- [ ] Success toast with "Invitation sent" message
- [ ] Show pending invitations section (optional but nice)

## Permission Requirements

**View team list:** `team:read` permission

**Invite members:** `team:write` permission

| Action            | Permission   | Roles                |
| ----------------- | ------------ | -------------------- |
| See Team tab      | `team:read`  | owner, admin, member |
| View team list    | `team:read`  | owner, admin, member |
| Invite new member | `team:write` | owner, admin         |

## UI Design

```
┌─────────────────────────────────────────────────────────────────┐
│ Team                                    [Search] [+ Invite]     │
├─────────────────────────────────────────────────────────────────┤
│ [Role filter ▼]                                                 │
├─────────────────────────────────────────────────────────────────┤
│ Avatar │ Name          │ Email              │ Role   │ Last Active│
│────────┼───────────────┼────────────────────┼────────┼───────────│
│   👤   │ Sarah Chen    │ sarah@company.com  │ Admin  │ 2 min ago │
│   👤   │ John Smith    │ john@company.com   │ Member │ 1 hour ago│
│   👤   │ Jane Doe      │ jane@company.com   │ Viewer │ Yesterday │
├─────────────────────────────────────────────────────────────────┤
│                        [Load more]                              │
└─────────────────────────────────────────────────────────────────┘

Invite Modal:
┌─────────────────────────────────────────────────────────────────┐
│ Invite Team Member                                     [× Close]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Email address                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ teammate@company.com                                        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Role (optional)                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Member                                                   ▼  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│                              [Cancel]  [Send Invitation]        │
└─────────────────────────────────────────────────────────────────┘
```

Note: "+ Invite" button only visible to users with `team:write` permission.

## API Endpoints

### List Team Members

```
GET /api/auth/team
  ?search=<string>
  &role=<string>
  &cursor=<string>
  &limit=<number>

Response:
{
  users: UserListItem[],
  nextCursor?: string,
  total?: number
}
```

Requires `team:read` permission.

### Send Invitation

```
POST /api/auth/team/invite
Body: { email: string, role?: string }

Response:
{ success: true, invitationId: string }
```

Requires `team:write` permission.

WorkOS handles email delivery automatically via `sendInvitation()` API.

## Acceptance Criteria

### Team List

- [ ] Team nav item visible only with `team:read` permission
- [ ] Team list displays all org members from `studioAuth` provider
- [ ] Search works
- [ ] Role filter works
- [ ] Pagination works
- [ ] Clicking member goes to detail page
- [ ] Responsive design
- [ ] Accessible (keyboard nav, screen readers)

### Invite Flow

- [ ] "Invite" button visible only with `team:write` permission
- [ ] Modal opens with email input and role selector
- [ ] Submitting calls `/api/auth/team/invite`
- [ ] Success shows toast notification
- [ ] Error shows error message in modal
- [ ] Invalid email shows validation error

## Files to Create/Modify

- `packages/playground/src/pages/team/index.tsx` (new)
- `packages/playground-ui/src/domains/team/` (new domain)
- `packages/playground-ui/src/lib/nav/nav-items.tsx` (add Team with `requiredPermission: 'team:read'`)
- `packages/server/src/server/handlers/auth.ts` (add endpoint)
- `packages/core/src/auth/ee/defaults/roles.ts` (add `team:read` to default roles)

## Dependencies

- 02-request-routing
- 03-iuserlisting-interface
- 04-workos-userlisting

## Blocks

- 06-team-member-detail
