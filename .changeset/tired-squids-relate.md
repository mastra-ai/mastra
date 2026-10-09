---
'@mastra/playground-ui': patch
---

Fixed password managers (1Password, LastPass, Dashlane, Proton Pass) popping up their autofill on ordinary text fields, such as the dataset Name field. Text fields now opt out of password manager autofill by default. Bitwarden skips these fields only when its "Allow websites to exclude fields to autofill" setting is on. Pass an autofill token to opt back in on sign-in and account forms:

```tsx
<Input type="email" autoComplete="email" />
<Input type="password" autoComplete="current-password" />
```
