import { Callout } from "nextra/components";

export const StreamVNextCallout = () => {
  return (
    <Callout type="important">
      <strong>Experimental API:</strong>
      <p className="x:leading-7">
        This is a new streaming implementation that supports multiple output
        formats (including AI SDK v5). It will replace{" "}
        <code className="nextra-code">.stream()</code> and may change as we
        refine the feature based on feedback.
      </p>
    </Callout>
  );
};
