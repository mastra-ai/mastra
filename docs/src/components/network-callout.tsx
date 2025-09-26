import { Callout } from "nextra/components";

export const NetworkCallout = () => {
  return (
    <Callout type="important">
      <b>Experimental Feature</b>
      <p>
        .network() leverages the experimental feature `streamVNext()` and is
        only compatible with AI SDK v5 models.
      </p>
    </Callout>
  );
};
