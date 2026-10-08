import { SettingsHeader } from '@mastra/playground-ui/new/settings';
import type { ComponentProps } from 'react';

/**
 * A drawer section's header, as tall as an icon button whether or not it has an action, so headings
 * and the gap to their content stay put when switching tabs or when a run adds its status.
 */
export function ToolSectionHeader(props: ComponentProps<typeof SettingsHeader>) {
  return (
    <SettingsHeader
      className="min-h-control-md flex-row flex-wrap items-center justify-between gap-2 sm:flex-wrap sm:gap-2"
      {...props}
    />
  );
}
