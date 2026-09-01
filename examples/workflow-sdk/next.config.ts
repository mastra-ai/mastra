import type { NextConfig } from 'next';
import { withWorkflow } from 'workflow/next';

const nextConfig: NextConfig = {
  // @libsql/client ships native bindings that cannot be bundled by Next.
  serverExternalPackages: ['@libsql/client', '@mastra/libsql'],
};

// withWorkflow() enables the "use workflow" / "use step" directives and
// generates the route handlers the Workflow SDK uses to drive runs.
export default withWorkflow(nextConfig);
