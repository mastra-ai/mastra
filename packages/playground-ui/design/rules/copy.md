# UI copy

<overview>
Product UI copy is part of the interface, and every word competes with the controls for attention. The style is plain and direct: short sentences that say what happened or what to do, with no filler, no marketing, and no reassurance except an error's verified what-is-safe line. The default is fewer words: a label, a control, and nothing else. This file decides when words are allowed, where they go, and how they read. `core.md` decides which component renders them.
</overview>

<workflow>
1. List every string the change adds or edits.
2. Run each explanatory string through the "is it needed" test. Delete what fails. Do not move it somewhere quieter.
3. Put what survives in its one correct place (the placement table).
4. Write each string with the pattern for its surface, then check it against the mechanics table.
5. For every error, walk the trees in section 5 and confirm each part its surface requires is present.
6. Reread every full sentence and cut each word that does not change what the user does.
</workflow>

<instructions>

## 1. Voice

1. **Direct.** Say the thing: `Delete production-agent?`, not `Are you sure you want to delete production-agent?`.
2. **Specific.** Name the consequence (`Requests using it will stop working.`), not a vague warning (`This may cause issues.`). Use real names and numbers (`3 environments`, not `several environments`).
3. **Calm.** No exclamation marks, `please`, or `successfully`. Errors follow section 5.
4. **Address the user as "you", in the present tense.** `Traces appear here.`, not `Traces will appear here once your agent runs.`
5. **Short full sentences, not fragments.** Descriptions, dialogs, tooltips, empty states, and errors are complete sentences with a subject, cut to the fewest words that keep it: `This deploy stopped and isn’t serving traffic.`, not `This deploy was stopped and is no longer serving traffic.` and not `Stopped. Not serving traffic.` Drop filler (`was`, `no longer`, `at this time`) and passive voice, keep the subject, and use contractions (`isn’t`, `can’t`, `you’re`). Fragments belong only to labels: status labels (`Paused`), progress (`Deploying`), buttons, titles, and success toasts.

   | Too long                                                      | Short full sentence                              | Fragment (wrong here)                     |
   | ------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------- |
   | The server is paused and no longer serving traffic.           | The server is paused.                            | Paused. Not serving traffic.              |
   | Your key is encrypted at rest and never exposed after saving. | Your key is encrypted and hidden after you save. | Encrypted at rest. Hidden after you save. |
   | This deploy was stopped and is no longer serving traffic.     | This deploy stopped and isn’t serving traffic.   | Stopped. Not serving traffic.             |

6. **No jargon for internals.** `Creating`, not `Provisioning`; `saved`, not `persisted`; `deploy`, not `rollout`.
7. **No marketing.** Never `simply`, `just`, `easily`, `seamlessly`, `powerful`, `unlock`, or `get started with`.

## 2. Is it needed

A line of explanatory text earns its place only if it tells the user something the label, title, or control does not: a consequence, a constraint, a schedule or unit, a hidden cost, or why something is disabled or view-only. A line that restates a label ("Theme: Color scheme for the interface"), introduces a section, or reassures ("You can change this later") is deleted. The one exception is an error's what-is-safe line (section 5).

Default to no text. Section, row, and field descriptions are absent unless one passes the test. The page is the one exception: `PageHeader.Description` may hold one sentence saying what the page is for, because it orients the user once at the top instead of repeating on every block.

| Candidate                                                         | Verdict                                      | Why                                                                    |
| ----------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------- |
| Theme: "Color scheme for the interface."                          | cut                                          | restates the label                                                     |
| Settings section: "Stored in this browser."                       | cut                                          | introduces a section; put scope in a badge if it matters               |
| Model: "You can change the model after creating the agent."       | cut                                          | reassurance; the user picks either way                                 |
| Tools: Web search, "Searches the public web"                      | cut                                          | the name says it                                                       |
| Memory: No memory, "Each run starts fresh."                       | cut as a tooltip; keep as a menu description | alone it is obvious, but beside two harder options it tells them apart |
| Notifications: Run failures, "Emails the owners when a run fails" | cut                                          | the toggle's label is enough                                           |
| Input: "JSON matching the input schema"                           | cut                                          | the validation error says it when it matters                           |
| Observational memory: "It adds a model call every 30k tokens."    | keep                                         | hidden cost                                                            |
| Temperature: "Higher values make output more varied."             | keep                                         | the setting's meaning is not obvious                                   |
| Signing key: "Only organization owners can rotate it."            | keep                                         | explains why it is view-only                                           |
| Connect: which transport to use                                   | keep                                         | a choice users get wrong                                               |
| Page: "Agents are saved as drafts until you publish them."        | keep                                         | one sentence of page context                                           |

When unsure, cut it. A missing tooltip costs a hover; an extra line costs every user every visit.

## 3. Where it goes

| What survives                                                       | Where                                                                              |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| What the page is for                                                | `PageHeader.Description`, one sentence                                             |
| Why a row or field matters, a unit, a schedule, why it is view-only | An info icon with a tooltip, right after the label (component in `page-frame.md`)  |
| What each option of a choice means                                  | The option's `description` inside the `Combobox` menu, visible only while choosing |
| What good input looks like                                          | The field's placeholder                                                            |
| What went wrong with input                                          | The field's `errorMsg`, inline                                                     |
| The consequence of a destructive action                             | Its confirmation dialog, not the row                                               |

Validation errors and destructive consequences are the only explanations that stay visible, because the user must see them without hovering.

## 4. By surface

| Surface     | Pattern                                                                                                                               | Examples                                                                                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button      | The verb alone when the title or page names the object. Keep the object only when nothing nearby names it (a toolbar or list button). | `Create`, `Delete`, `Retry`, `Save`; toolbar: `New agent`                                                                                                                                                           |
| Title       | The object, or the question being asked                                                                                               | `Delete production-agent?`, `Create license key`, `New agent`                                                                                                                                                       |
| Description | New information only, or delete it. Never restate the title.                                                                          | `Requests using it will stop working. This cannot be undone.`                                                                                                                                                       |
| Empty state | Title plus one sentence that points to the action. Never a second copy of the header's primary button.                                | `No deploys yet` / `Push to your linked branches to deploy.`                                                                                                                                                        |
| Error       | The parts section 5 requires for the surface                                                                                          | `Couldn’t load agents` / `The server at localhost:4111 returned 503. Check that it is running and try again.` / link `Troubleshoot local dev`                                                                       |
| Validation  | How to fix the input, not that it is wrong                                                                                            | `Give the agent a name, for example “Support triage”.` Never `Invalid input` or `This field is required`.                                                                                                           |
| Toast       | Success: past tense, object first, no period. Error: section 5.                                                                       | `API key created`, `Thread cloned`, `Settings saved`                                                                                                                                                                |
| Progress    | The -ing verb, no ellipsis                                                                                                            | `Deploying`, `Linking branches`, `Loading models`, `Creating` (never `Loading...` or `Loading…`)                                                                                                                    |
| Placeholder | A realistic example of good input, or `Search {things}`. Never a question, never instructions, never a restated label.                | Name `Support triage`; Instructions `You triage support tickets. Label each one by product area and urgency, reply in a short, friendly tone, and never promise refunds.`; `Search agents`; picker `Choose a model` |

A destructive confirmation is a title that asks (`Delete production-agent?`), a description that names the consequence and, only for permanent actions, `This cannot be undone.`, and a confirm button with the verb alone (`Delete`). The title already names the object.

A placeholder never replaces the label and never carries anything the user needs after typing starts, because it disappears then.

## 5. Error messages

An error is the one place where copy carries more than a label, because the user is stuck and the message is their only way forward. Every error is built from these parts, in this order:

| Part          | What it says                                                                                    | Example                                                      |
| ------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| What happened | The title: `Couldn’t {action}`, naming the object                                               | `Couldn’t deploy support-agent`                              |
| Why           | The cause in product words, mapped from the error’s code or HTTP status                         | `The build failed because package.json has no build script.` |
| What is safe  | What the failure did not touch. Only when the code guarantees it; otherwise leave the part out. | `Your previous deploy is still serving traffic.`             |
| How to fix    | The step the user takes, naming the exact control, setting, or command                          | `Add a build script and push again.`                         |
| Way out       | A link to the docs page for this failure, or to support                                         | `Troubleshoot deploys`, `Contact support`                    |

Pick the required parts by where the error renders:

```
Where does the error render?
├── Under one field, about its input → Validation pattern (section 4), not this one.
│   The label already says what failed, so the message is only the fix.
├── Toast → what happened + one next step: an action button (`Retry`) or a fix sentence.
│   └── Does the user need the cause to recover?
│       └── Yes → use an inline alert instead. A toast disappears in seconds and
│                 holds one line, so a cause the user must act on gets lost.
└── Inline alert (`Notice variant="destructive"`), dialog,
    or `EmptyState tone="error"` → all five parts, with what-is-safe only when true.
```

Pick the way out the same way every time:

```
Can the user fix it themselves?
├── Yes → link the docs page that covers this failure. Never the docs home:
│         a generic link is no way out.
└── No (server error, billing, account, a limit only Mastra can raise) → link support.
```

- **What is safe is verified, never assumed.** Write it only when the code path guarantees it: the request failed before writing, the transaction rolled back, the previous deploy keeps serving. Read the code before writing the line. A false reassurance is worse than none, because the user stops checking and loses work they were told was saved.
- **Why never shows the raw error.** Never render `err.message`, `error.toString()`, `String(error)`, a stack, or a raw response body. They are written for developers, leak internals, and change wording without notice. Map the error’s code or status to written copy. When the cause is unknown, state what is known (`The server returned 503.`) and never guess one.
- **Banned:** `Something went wrong`, `An error occurred`, `An unexpected error occurred`, `Unknown error`, `Oops`, and any of them with a suffix (`Something went wrong. Please try again.`). They tell the user an error happened, which the user already knows, and give them nothing to do.

| Surface      | Example                                                                                                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Toast        | `Couldn’t save settings`, with a `Retry` action                                                                                                                                                                                |
| Inline alert | Title `Couldn’t deploy support-agent`. Description `The build failed because package.json has no build script. Your previous deploy is still serving traffic. Add a build script and push again.` Link `Troubleshoot deploys`. |

Write each part by hand from the error's code or status. Never call `toast.error` with a raw message, and never hand-style a `div` as an error box; inline errors are a `Notice variant="destructive"`.

## 6. Mechanics

| Rule                   | Standard                                                                                                                                                                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Case                   | Sentence case everywhere: titles, labels, buttons, tabs, menu items, toasts. Capitals only for proper nouns.                                                                                                                                                            |
| Errors                 | Titles start with `Couldn’t`                                                                                                                                                                                                                                            |
| Irreversible actions   | `This cannot be undone.`, on permanent actions only                                                                                                                                                                                                                     |
| Terms                  | deploy · repository · API key · environment variable · docs · organization · canceled                                                                                                                                                                                   |
| Ellipses               | Only where text is shortened: CSS truncation (`truncate`) and abbreviated values such as IDs (`dpl_8f3a…`). Always the single character `…`, never `...`. Never on progress (`Loading`, not `Loading…`), placeholders (`Search agents`), or pickers (`Choose a model`). |
| Apostrophes and quotes | Curly: `’`, `“ ”`. Type them in the source string.                                                                                                                                                                                                                      |
| Dashes                 | No em dashes                                                                                                                                                                                                                                                            |
| Separators             | No dot between facts (`·`), and never `•` or a pipe. Use words and commas in a sentence, and give each fact its own element in a header, row, or list.                                                                                                                  |
| Exclamation marks      | None                                                                                                                                                                                                                                                                    |
| Periods                | On full sentences (descriptions, tooltips, empty and error sentences, an error toast’s fix sentence), not on titles, labels, buttons, success toasts, or fragments                                                                                                      |

## 7. Numbers and times

Quantities and moments are shown in a short form that scans, with the exact value one hover away.

### CompactNumber

- **Use for** KPI totals, chart axis ticks, dense metric cells, and money meant to scan fast.
- **Never use for** IDs, model names, anything that is not a quantity, or counts that are already short (under 4 digits and readable). Those render as-is.
- Surface: about 3 significant digits, compact: `12310` shows `12.3K`, `6000` shows `6K`.
- Money: keep cents when the amount is small (`$4.37`); at 3 or more dollar digits, round to the dollar (`$128.40` shows `$128`).
- Hover: the exact input with separators (`12,310`, `$1,284.17`), always, through the existing `Tooltip`. The component owns the tooltip; never add a second one.
- Proportional type, not mono, even when the quantity is a duration (a `p95 latency` KPI): data visualization stays in one face.
- Pass the raw number plus an optional currency and locale. Never pass a pre-formatted string, because the tooltip needs the exact value.

### RelativeTimestamp

- **Use for** every displayed moment in time: deploys, activity, logs, created and updated.
- **Never use for** durations or ranges that are not a point in time (`3.4s`, `p95 latency`), or for labels. In "Last updated 3m", only `3m` is the component; the label stays proportional text.
- Surface: relative and monospace: `3m`, `1h`, `1d`, `2w`.
- Hover: the precise time since (counting up), the viewer's local time, and UTC. The component owns this content through the existing `Tooltip`.
- Pass a real `Date` or ISO string, plus an optional `className`. Never pass a pre-formatted string.

### Formatters

When a value renders as a string instead of through a component, format it with playground-ui. Never hand-roll `Intl.*`, `toLocaleString`, `toLocaleDateString`, `toFixed`, `date-fns`, or `dayjs` in product code, because each hand-rolled format drifts from the others on rounding, currency, and time zone.

| Value                 | Import from `@mastra/playground-ui/utils/…`                                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Money                 | `cost`: `formatCost` (`$4.37`, `<$0.01`), `formatCompactNumber` and `formatFullNumber` with `{ currency }`                                                                                           |
| Plain numbers         | `cost`: `formatCompactNumber` (`12.3K`), `formatFullNumber` (`12,310`)                                                                                                                               |
| Dates and times       | `date-format`: `formatDate(value, preset)` with `date`, `date-time`, `date-time-seconds`, `time`, `time-seconds`, or `relative-time`; `formatShortDate`, `formatDateRange`, `formatTimestampPrecise` |
| Relative time as text | `relative-time`: `formatRelativeTime`                                                                                                                                                                |
| Durations             | `duration`: `formatDuration` (`3.4s`), `formatDurationPrecise`, `formatElapsed`                                                                                                                      |

When none of these produces the needed format, extend the formatter in `playground-ui`; do not add a local one.

</instructions>

<quality-checklist>
- [ ] Every explanatory string passed the "is it needed" test; failures were deleted, not moved
- [ ] At most one page description; no section, row, or field descriptions
- [ ] Each surviving explanation is in its one place from the placement table
- [ ] Every string follows its surface pattern: verb-alone buttons, `Couldn’t` errors, past-tense success toasts, -ing progress
- [ ] Every error has the parts section 5 requires for its surface: a toast has what happened and a next step; an inline alert, dialog, or error `EmptyState` has all five, with what-is-safe only when the code guarantees it
- [ ] Every way out links the docs page for that failure or support, never the docs home
- [ ] No `Something went wrong`, `An error occurred`, `An unexpected error occurred`, `Unknown error`, `Oops`, or raw `err.message`, `String(error)`, or response body on screen
- [ ] `…` (never `...`) appears only where text is shortened: truncation and abbreviated IDs; never on progress, placeholders, or pickers; no em dashes or exclamation marks; curly apostrophes and quotes
- [ ] Explanatory text is short full sentences with a subject and contractions; fragments only on labels, status, progress, buttons, titles, and success toasts
- [ ] Sentence case; periods only on full sentences
- [ ] Terms match the list: deploy, repository, API key, environment variable, docs, organization, canceled
- [ ] No dot between facts (`·`), and never `•` or a pipe; sentences use words and commas, and each fact in a header, row, or list is its own element
- [ ] Money, numbers, dates, and durations shown as strings go through a playground-ui formatter; no `Intl`, `toLocale*`, `toFixed`, or date library in product code
- [ ] Quantities to scan use `CompactNumber` and every moment in time uses `RelativeTimestamp`, each with the exact value on hover; IDs, names, short counts, durations, and labels do not
- [ ] No `please`, `successfully`, reassurance outside an error’s verified what-is-safe line, internal jargon, or marketing words
</quality-checklist>
