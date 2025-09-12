import { Callout } from "nextra/components";

export const GenerateVNextCallout = () => {
  return (
    <Callout type="important">
      <b>Experimental Feature</b>
      <p>
        This is a new generation method with support for flexible output formats
        (including AI SDK v5). It will eventually replace `generate()` and may
        change based on community feedback.
      </p>
    </Callout>
  );
};
