---
'@mastra/playground-ui': patch
---

Added `ActivityStretchLine` under `@mastra/playground-ui/domains/chat/activity`. It shows a stretch of tool calls and thoughts as one line. While live, the line reads the call that is running; once settled, it summarises what the calls did and how long they took. Opening it lists the calls and thoughts. The app supplies each call's row and body, so tools keep their own look.

```tsx
<ActivityDisclosureProvider>
  <ActivityStretchLine
    live={false}
    elapsedMs={72_400}
    members={[
      { kind: 'thought', key: 'r1', content: { text: 'Checking the build first.' } },
      {
        kind: 'call',
        key: 'c1',
        toolName: 'execute_command',
        args: { command: 'pnpm build' },
        status: 'done',
        row,
        body,
      },
    ]}
  />
</ActivityDisclosureProvider>
```

`ActivityDisclosureProvider` remembers what the reader opened, and where they scrolled in a list of calls, so a line keeps both when it mounts again. `useActivityRow(key)` lets an app-drawn row join that state.

Also added a few building blocks the line uses:

- `toolPhrases(label)`: the live, done and summary wording for a tool kind.
- `ReasoningText` and `hasReasoningText`: reasoning prose with the redaction notice.
- `formatMoment`: "Today at 14:02"-style timestamps.
- `ActivityTimedTrigger`: a trigger that shows when the work began.
