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

/** Adds a custom OpenAI-compatible endpoint at one scope, or edits one saved there. */
export function CustomProviderDialog({
  provider,
  credentialScope,
  requestScope,
  onClose,
}: {
  /** The endpoint to edit. Absent to add one. */
  provider: CustomProviderInfo | undefined;
  credentialScope: CredentialScope;
  requestScope: CredentialScope | undefined;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{provider ? `Edit ${provider.name}` : 'Add custom endpoint'}</DialogTitle>
          <DialogDescription>Any OpenAI-compatible API. {SCOPE_AUDIENCE[credentialScope]}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <CustomProviderForm
            provider={provider}
            scope={requestScope}
            framed={false}
            onCancel={onClose}
            onSaved={onClose}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
