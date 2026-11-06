# Interface guidelines

<overview>
Behavior every screen shares, and how a component's props are shaped. The other files in this folder win on anything they decide.
</overview>

<instructions>

## Behavior

- **URL is state.** Filters, tabs, sort, search, pagination, and open panels live in the URL, so refresh, share, and Back work. One of these in `useState` is a defect.
- **Unsaved changes warn** before navigation throws them away.
- **Destructive actions confirm or offer Undo.** Never neither.
- **Spinners don't flicker.** Show after 150–300ms, then stay at least 300–500ms. `<Suspense>` does both.
- **Truncated text is recoverable** through a tooltip or an expanded view.
- **Routine updates use `role="status"`;** `role="alert"` interrupts, so it is for urgent errors only.

## Component props

- **No repeated context.** `<Dialog open onOpenChange>`, never `dialogOpen`. The component name already says what the prop is about.
- **Derive before adding a boolean.** No `onClose` means not closable, so `isClosable` doesn't exist. Each extra boolean doubles the states a caller has to reason about.
- **Exclusive booleans are one enum.** `variant="primary"`, never `isPrimary` and `isSecondary`, so the impossible pair can't be written.
- **Items are children, not a `data` array,** so each item takes any prop without the parent forwarding it. Never register children with `Children.map` and `cloneElement`; it breaks when items mount, unmount, or reorder. Build on the primitive library's collection instead.
- **Pointer-rate values skip state.** Drag, resize, and cursor positions nothing else renders from are written to the element through a ref in the handler.

</instructions>
