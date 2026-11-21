import { Button } from '@mastra/playground-ui/components/Button';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@mastra/playground-ui/components/Drawer';
import { providerDisplayName } from '@mastra/factory/provider-display-name';

import type { ProviderInfo } from '../../../../../api/types';
import { useSidePanelDrawer } from '../../../../lib/hooks/useSidePanelDrawer';
import { ProviderOptionRow } from '../models/providers/ProviderRows';

interface SpeechToTextProviderOption {
  provider: ProviderInfo;
  connectedAs: string | undefined;
}

export function AddSpeechToTextKeyDrawer({
  open,
  options,
  onAddKey,
  onClose,
}: {
  open: boolean;
  options: SpeechToTextProviderOption[];
  onAddKey: (provider: ProviderInfo) => void;
  onClose: () => void;
}) {
  const sidePanel = useSidePanelDrawer();
  return (
    <Drawer
      {...sidePanel}
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) onClose();
      }}
    >
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Add provider</DrawerTitle>
          <DrawerDescription>Subscription sign-ins can't transcribe audio.</DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex min-h-0 flex-col gap-3">
          <ul className="border-border divide-border min-h-0 divide-y overflow-y-auto rounded-lg border">
            {options.map(({ provider, connectedAs }) => {
              const displayName = providerDisplayName(provider.provider);
              return (
                <ProviderOptionRow key={provider.provider} provider={provider.provider} label={connectedAs}>
                  <Button size="sm" aria-label={`Add API key for ${displayName}`} onClick={() => onAddKey(provider)}>
                    API key
                  </Button>
                </ProviderOptionRow>
              );
            })}
          </ul>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
