import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';

import type { CustomProviderInfo } from '../../../../../../api/types';
import { CustomProviderForm } from '../../CustomProviderForm';
import { SCOPE_AUDIENCE } from '../../provider-credential';
import type { CredentialScope } from '../../provider-credential';

/** Adds a custom OpenAI-compatible endpoint to a provider list, or edits one in it. */
export function CustomProviderDialog({
  provider,
  scope,
  onClose,
}: {
  /** The endpoint to edit. Absent to add one. */
  provider: CustomProviderInfo | undefined;
  /** The list a new endpoint is added to. An edited one stays where it is saved. */
  scope: CredentialScope;
  onClose: () => void;
}) {
  const savedAt = provider?.scope ?? scope;
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{provider ? `Edit ${provider.name}` : 'Add custom endpoint'}</DialogTitle>
          <DialogDescription>Any OpenAI-compatible API. {SCOPE_AUDIENCE[savedAt]}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <CustomProviderForm provider={provider} scope={savedAt} onCancel={onClose} onSaved={onClose} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
