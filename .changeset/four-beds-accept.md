---
'@mastra/playground-ui': minor
---

Everything an agent does in a chat now renders on one `Activity` line: tool calls, reasoning, signals, notifications, skills and plain "working" rows. A body is optional, and without one the line looks the same with no chevron, so a step that returns nothing reads like one that does.

```tsx
import { ActivityItem } from '@mastra/playground-ui/components/ai/activity';

<ActivityItem icon={<Sparkles aria-hidden />} label="Thinking" status="running" aria-label="Thinking" />;

<ActivityItem icon={<FileText aria-hidden />} label="Read file" detail="src/agent.ts" aria-label="Tool: view">
  <ToolCallOutput text={output} />
</ActivityItem>;
```

**The `ToolCall` shell is renamed to `Activity`**

The compound parts moved to `components/ai/activity` under new names: `ToolCall*` becomes `Activity*`, `ToolCallPresentedHeader` becomes `ActivityHeadline`, and `ToolCallStatus` becomes `ActivityStatus`. `ActivityHeadline` takes its icon as an element instead of a component. The tool-specific blocks stay in `components/ai/tool-call`: `ToolCallArguments`, `ToolCallOutput`, `ToolCallCommand`, `ToolCallGroup` and `presentTool`.

```tsx
// Before
import { ToolCall, ToolCallTrigger, ToolCallPresentedHeader, ToolCallContent } from '@mastra/playground-ui/components/ai/tool-call';

<ToolCall status={status}>
  <ToolCallTrigger>
    <ToolCallPresentedHeader icon={Search} label={label} detail={detail} />
  </ToolCallTrigger>
  <ToolCallContent>{body}</ToolCallContent>
</ToolCall>;

// After
import { Activity, ActivityTrigger, ActivityHeadline, ActivityContent } from '@mastra/playground-ui/components/ai/activity';

<Activity status={status}>
  <ActivityTrigger>
    <ActivityHeadline icon={<Search aria-hidden />} label={label} detail={detail} />
  </ActivityTrigger>
  <ActivityContent>{body}</ActivityContent>
</Activity>;
```

The screen-reader status text is now "Running" or "Failed" instead of "Tool call running" or "Tool call failed", because the line is no longer only for tools.

**Signals, notifications and skills are `Activity` presets**

`components/ai/chat-event` is removed. Its presets moved into `components/ai/activity` and are named after the line they draw: `ChatSignal` is now `SignalActivity`, `ChatNotification` is now `NotificationActivity` and `ChatSkill` is now `SkillActivity`. Each one picks the icon, badges and body for one kind of event over `ActivityItem`.

The card presentation of signals and the notice presentation of notifications are removed along with their `variant` prop. A notification's priority is now a coloured badge on the line: urgent is red, high is orange, medium is blue. Its status and pending count are badges beside it. A system reminder names its path as the detail of the line.

```tsx
// Before
import { ChatNotification } from '@mastra/playground-ui/components/ai/chat-event';

<ChatNotification variant="notice" label="github / issue-opened" message={message} priority="high" />;

// After
import { NotificationActivity } from '@mastra/playground-ui/components/ai/activity';

<NotificationActivity label="github / issue-opened" message={message} priority="high" />;
```

`ReasoningStreamingLine` is removed. `Reasoning` covers the waiting state itself: while it streams with no text yet, it shows a busy "Reasoning" line with no disclosure.

**A line only folds when its body says more than the line**

A short single-line message fits in the preview, so opening a disclosure used to reveal a copy of the line above it. Such a line now has no disclosure and wraps its detail instead of clipping it, so a narrow transcript never hides the end of a sentence it offers no way to open. Because folding is now the exception, a line that folds shows a dimmed chevron at rest instead of only on hover.

The same rule covers a composed `Activity`: pass `foldable={false}` when there is nothing to open, and the line drops its disclosure button and its empty body. A tool call with no arguments, no output and no result is one example. `hasToolArguments` tells you whether `ToolCallArguments` would render anything.

```tsx
import { Activity, ActivityContent, ActivityHeadline, ActivityTrigger } from '@mastra/playground-ui/components/ai/activity';
import { hasToolArguments, ToolCallArguments } from '@mastra/playground-ui/components/ai/tool-call';

const foldable = hasToolArguments({ toolName, args }) || output !== undefined;

<Activity foldable={foldable} status={status}>
  <ActivityTrigger>
    <ActivityHeadline icon={<Search aria-hidden />} label={label} detail={detail} />
  </ActivityTrigger>
  <ActivityContent>
    <ToolCallArguments toolName={toolName} args={args} />
  </ActivityContent>
</Activity>;
```

A line that gains a body as its arguments stream in keeps its headline mounted: its shimmer does not restart, its detail does not fade in again, and the chevron fades into a slot that was already reserved, so the text does not shift sideways.

**`ChatTimeGap` is replaced by `TranscriptDivider`**

The transcript separator is a `role="separator"` rule, not an event, and it no longer parses a time string. It takes the label and, separately, the timestamp that belongs in `title`, and renders nothing when the label is empty.

```tsx
// Before
import { ChatTimeGap } from '@mastra/playground-ui/components/ai/chat-event';

<ChatTimeGap text="24 minutes later — Sep 17, 2026, 2:24 PM" />;

// After
import { TranscriptDivider } from '@mastra/playground-ui/components/ai/transcript-divider';

<TranscriptDivider label="24 minutes later" title="Sep 17, 2026, 2:24 PM" />;
```

`SignalActivity` and `NotificationActivity` no longer set their own width or vertical margin, so the caller places them.
