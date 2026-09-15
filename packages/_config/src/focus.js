const FOCUS_OVERRIDE_PATTERN =
  '(^|\\s)([^\\s]*:)?!?outline-(none|hidden)!?(\\s|$)|(^|\\s)[^\\s]*focus[^\\s]*:(ring|shadow)(-[^\\s]+)?(\\s|$)';

const FOCUS_OVERRIDE_MESSAGE =
  'Use shared design-system focus styles. Keep outline suppression and focus ring/shadow styling inside the design system.';

export const restrictedFocusSelectors = [
  { selector: `Literal[value=/${FOCUS_OVERRIDE_PATTERN}/]`, message: FOCUS_OVERRIDE_MESSAGE },
  { selector: `TemplateElement[value.raw=/${FOCUS_OVERRIDE_PATTERN}/]`, message: FOCUS_OVERRIDE_MESSAGE },
  {
    selector: 'Property[key.name="outline"]:matches([value.value="none"], [value.value=0])',
    message: FOCUS_OVERRIDE_MESSAGE,
  },
];
