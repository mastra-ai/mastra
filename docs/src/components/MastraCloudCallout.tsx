import React from "react";
import Admonition from "@theme/Admonition";
import Link from "@docusaurus/Link";

export function MastraCloudCallout() {
  return (
    <Admonition type="tip" title="Mastra Cloud">
      <p>
        Deploy and monitor your Mastra applications with{" "}
        <Link to="https://mastra.ai/cloud">Mastra Cloud</Link>. Get automated
        deployments, detailed observability, and built-in playground for testing
        agents and workflows.
      </p>
    </Admonition>
  );
}

export default MastraCloudCallout;
