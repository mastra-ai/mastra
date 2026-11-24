---
'@mastra/playground-ui': minor
---

Copying now says so where it happens instead of in a toast. The copy icon turns into a checkmark, an open tooltip stays and reads "Copied", a labeled button reads "Copied" without changing width, and screen readers hear it. A copy the browser blocks shows in the same place.

**`useCopyToClipboard`** no longer shows toasts. It returns `status` (`idle`, `copied` or `failed`) next to `isCopied`, and `copyToClipboard` resolves to whether the value reached the clipboard. `copyMessage` and `showToast` are deprecated and do nothing; show the status in the control that copied.

```tsx
// Before
const { handleCopy } = useCopyToClipboard({ text: id, copyMessage: 'ID copied' });
<button onClick={handleCopy}><IconSquareBehindSquare1 /></button>;

// After
const { status, handleCopy } = useCopyToClipboard({ text: id });
<CopyTooltip status={status} label="Copy ID">
  <button onClick={handleCopy} aria-label="Copy ID"><CopyIcon status={status} /></button>
</CopyTooltip>;
```

**`CopyButton`** takes a label as children, and an `icon`. Its accessible name no longer changes to "Copied!". `CopyIcon`, `CopyLabel` and `CopyTooltip` are exported for custom controls.

```tsx
<CopyButton content={prompt}>Copy prompt</CopyButton>
```

**`DropdownMenu.CopyItem`** and **`ContextMenu.CopyItem`** copy from a menu: the item shows the checkmark and "Copied", then the menu closes.

```tsx
<DropdownMenu.CopyItem value={organizationId}>Copy organization ID</DropdownMenu.CopyItem>
```

`AgentHeaderActions` takes `shareStatus`; `isShareCopied` is deprecated.
