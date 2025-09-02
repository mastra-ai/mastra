import { Callout } from "nextra/components";

export const StreamVNextCallout = () => {
  return (
    <Callout type="important">
      <b>Experimental Feature</b>
      <p>
        This is a new streaming implementation with support for multiple output
        formats (including AI SDK v5). It will replace `stream()` once
        battle-tested, and the API may change as we incorporate feedback.
      </p>
    </Callout>
  );
};
