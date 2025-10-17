import { Callout } from "nextra/components";

export const NetworkCallout = () => {
  return (
    <Callout type="important">
      <b>Experimental Feature</b>
      <p className="mt-1 mb-2">
        .network() is an experimental method and is only compatible with AI SDK
        v5 models.
      </p>
      <p>.network() requires Mastra memory to be configured.</p>
    </Callout>
  );
};
