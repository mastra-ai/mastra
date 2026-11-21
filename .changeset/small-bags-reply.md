---
'@mastra/playground-ui': minor
---

The chat composer now stays one line until you use it, leaving more room for the conversation. Idle, it shows "+", the input, the model picker, voice and Send in a single row. Focusing the input or writing a draft (text, attachments or annotations) glides it open, giving the input its own row above the actions, and it glides back to one line when you leave it. "+" and Send stay on the same spot throughout, and the one-line composer is a full pill.

- Wrap actions that should only show in the expanded composer, such as model settings, in `ComposerActionsDetail`.
- Mark text the one-line composer should drop on small screens with `data-composer-line-hidden`, such as the model name in the picker trigger. It grows back in when the composer opens and shrinks out in place when it closes.
- Icon buttons (`icon-sm`, `icon-md`, `icon-lg`) no longer shrink in a crowded row, and on a narrow screen `ComposerActionsEnd` truncates the model name instead of wrapping onto a second row.
- `ComposerStatus` now sits after `Composer` as a footer. Opening the composer never changes it. While nothing in it would be seen (screen-reader-only text doesn't count), it gives its row back, after a short pause so status that blinks out and back doesn't move the composer. Use `ComposerStatusStart` for session context and `ComposerStatusEnd` for runtime readings.
- The composer draws its edge and depth with shadow layers only, no border: a 1px rim and soft drops that brighten and lift on hover and focus, with a top-lit gradient on the rim and a faint top glow instead of an inner line, so it never shows a double edge. `ComposerRing` no longer follows the pointer; while `busy` faint mono threads of light wander its top edge around the centre, like a quiet loader, instead of a coloured arc spinning round it. Its `tone` prop is gone: the rim no longer takes a colour, so drop `tone` from `<ComposerRing>`. `ComposerToneLabel` keeps its tones.
- New `--ease-in-out-custom` motion token (`cubic-bezier(0.77, 0, 0.175, 1)`) for things that move or change shape on screen, such as the composer opening.

```tsx
<Composer>
  <ComposerRing>
    <ComposerBox>
      <ComposerInput placeholder="Ask anything" />
      <ComposerActions>
        <ComposerActionsStart>
          <ComposerAttachMenu onFiles={addFiles} />
        </ComposerActionsStart>
        <ComposerActionsEnd>
          <ModelPicker {...pickerProps} />
          <ComposerActionsDetail>
            <ModelSettingsButton />
          </ComposerActionsDetail>
          <SendButton />
        </ComposerActionsEnd>
      </ComposerActions>
    </ComposerBox>
  </ComposerRing>
</Composer>
<ComposerStatus>
  <ComposerStatusStart>You're steering Sam's session</ComposerStatusStart>
  <ComposerStatusEnd>42 tok/s</ComposerStatusEnd>
</ComposerStatus>
```
