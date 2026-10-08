import { Outlet } from 'react-router';
import { PromptBlocksNavigation } from './components/prompt-blocks-navigation';
import { FeatureShell } from '@/components/feature-shell';
import { SidebarSlotProvider } from '@/components/ui/sidebar-slot-provider';

export function PromptBlocksShell() {
  return (
    <SidebarSlotProvider>
      <FeatureShell
        navigationId="prompts"
        navigationWidth={380}
        navigationMinWidth={320}
        label="Prompt navigation"
        sidebar={<PromptBlocksNavigation />}
      >
        <Outlet />
      </FeatureShell>
    </SidebarSlotProvider>
  );
}
