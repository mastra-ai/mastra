---
title: Avoid ClassName Assertions for Visual Behavior
impact: MEDIUM-HIGH
impactDescription: className assertions usually duplicate implementation strings without proving user-visible behavior, so they create brittle false confidence
tags: testing, classname, computed-style, jsdom, visual-regression
---

## Avoid ClassName Assertions for Visual Behavior

Do not assert generated `className` strings to prove visual behavior. A test like
`expect(node.className).toContain('border-border2')` usually only proves that
the source string was copied into the test. It does not prove the browser
receives the intended style, the selector wins, focus/hover state works, or the
user-visible behavior exists.

Prefer **no test** over a class-name-only test that just duplicates the
implementation. Add the test when it can fail for a real product regression.

### Preferred assertions

- User-visible behavior: text, roles, ARIA state, disabled state, keyboard flow,
  selected/current state, validation messages, navigation, or submitted data.
- Computed style in jsdom when the behavior is CSS: `getComputedStyle(element)`
  for `outline`, `borderColor`, `display`, `visibility`, `overflow`,
  `textOverflow`, `whiteSpace`, `pointerEvents`, etc.
- Actual DOM measurements when the regression is layout/overflow:
  `scrollWidth > clientWidth`, stable dimensions, or rendered height/width.
- Playwright or Storybook/browser validation when jsdom cannot model the real
  behavior: pseudo-elements, media queries, hover/focus rendering, layout engine
  differences, screenshots, or canvas/animation state.

### Good exceptions

Class assertions are acceptable when the class string is the public contract:

- A component explicitly promises to forward a caller-provided `className`.
- A class builder, CVA recipe, or Tailwind merge utility is the unit under test.
- A public slot/classNames API documents specific slot keys or passthrough
  behavior.

Even then, test the public contract, not incidental design-system tokens.

### Incorrect

```tsx
it('shows a focused border', () => {
  render(<InputGroup />);

  expect(screen.getByTestId('input-group').className).toContain('focus-within:border-neutral5/50');
});
```

This duplicates the implementation. It does not prove the focused state changes
the rendered border, or that another class does not override it.

### Correct

```tsx
it('removes the focused editor outline', () => {
  const { container } = render(<CodeEditor value="content" />);
  const editor = container.querySelector<HTMLElement>('.cm-editor');

  if (!editor) {
    throw new Error('Expected CodeMirror editor');
  }

  editor.classList.add('cm-focused');

  expect(getComputedStyle(editor).outline).toBe('none');
});
```

### Correct when layout is the behavior

```tsx
it('truncates long labels instead of expanding the row', () => {
  render(<StatusBadge label="A very long status label that must truncate" />);
  const label = screen.getByText(/very long status/);

  expect(getComputedStyle(label).overflowX).toBe('hidden');
  expect(getComputedStyle(label).textOverflow).toBe('ellipsis');
  expect(label.scrollWidth).toBeGreaterThan(label.clientWidth);
});
```

### Review smells

- `expect(element.className).toContain(...)` for a visual result.
- Tests that grep for Tailwind tokens (`bg-*`, `border-*`, `outline-*`,
  `rounded-*`, `text-*`) instead of proving rendered behavior.
- Snapshot tests whose only meaningful assertion is a class list.
- Tests that pass because a variant returned the expected class but would still
  pass if Tailwind stopped generating the utility or another selector won.
