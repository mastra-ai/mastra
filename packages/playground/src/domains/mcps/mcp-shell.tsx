import { Outlet } from 'react-router';
import { McpNavigation } from './components/mcp-navigation';
import { FeatureShell } from '@/components/feature-shell';

export function McpShell() {
  return (
    <FeatureShell navigationId="mcps" label="MCP navigation" sidebar={<McpNavigation />}>
      <Outlet />
    </FeatureShell>
  );
}
