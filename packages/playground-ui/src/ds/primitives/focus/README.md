# Keyboard focus

Tab and Shift+Tab reveal the gradient focus indicator. Pointer and touch interaction hide it without blurring the control. Typing or moving the caret in a clicked input keeps the pointer treatment. Keyboard navigation stays active across portals and roving focus groups until the next pointer interaction.

The shared controls register one document-level listener pair and expose the input method through a root attribute. Consumers do not need a provider or wrapper, and switching input methods does not rerender the controls. Each control still needs real focus. Popup options follow the highlighted item only while the popup contains focus.

- Inputs, textareas, buttons, grouped fields, and menu items grow a fading bottom line inside the control so clipped containers preserve the cue.
- Icon buttons, checkboxes, radios, and switches use two orbiting points outside their shape.
- Sliders open a notch beside the focused thumb, including vertical and range sliders.
- Tabs use fading contours that preserve the active tab surface and contained-tab corners.
- Table selection marks the row with two fading lines. Other controls in a row keep their own indicators.

Borders, invalid state, selection, and checked state remain independent of keyboard focus. Reduced motion removes transitions. Forced colors uses system Highlight outlines instead of gradients.

In Storybook, open **Foundations / Keyboard focus / Gradient Lines**, or **Keyboard Focus** under each component. Click any control and then use Tab or Shift+Tab. Use arrows in tabs, radio groups, sliders and menus; use Space to toggle selections. Nothing is automatically focused.

`useKeyboardNavigation` owns its listeners and root attribute for as long as at least one shared control is mounted. CSS recipes used without a component subscription fall back to native `:focus-visible`; the shared controls additionally distinguish pointer editing in text inputs.
