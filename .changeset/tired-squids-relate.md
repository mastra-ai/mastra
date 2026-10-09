---
'@mastra/playground-ui': patch
---

Fixed password managers (1Password, LastPass, Bitwarden, Dashlane, Proton Pass) popping up their autofill on ordinary text fields, such as the dataset Name field. Text fields now opt out of password manager autofill by default. Pass an autofill token to opt back in on sign-in and account forms:

```tsx
<Input type="email" autoComplete="email" />
<Input type="password" autoComplete="current-password" />
```
