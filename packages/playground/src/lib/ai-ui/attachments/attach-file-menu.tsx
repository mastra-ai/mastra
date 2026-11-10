import { ComposerAttachMenu } from '@mastra/playground-ui/components/Composer';
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@mastra/playground-ui/components/Dialog';
import { Field, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Form } from '@mastra/playground-ui/components/Form';
import { Input } from '@mastra/playground-ui/components/Input';
import { IconChainLink1 } from '@mastra/playground-ui/icons/central/IconChainLink1';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useComposerAttachments } from './composer-attachments';

/**
 * "+" composer action: attach from the camera, photo library or files, or add a public URL.
 */
export const AttachFileMenu = () => {
  const [urlOpen, setUrlOpen] = useState(false);
  const { addFiles, addUrl } = useComposerAttachments();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const url = new FormData(e.currentTarget).get('url-attachment')?.toString().trim();
    if (!url) return;

    try {
      await addUrl(url);
      setUrlOpen(false);
    } catch {
      // Keep the dialog open so the user can correct the URL and retry.
    }
  };

  return (
    <>
      <ComposerAttachMenu
        onFiles={files => void addFiles(files)}
        size="icon-md"
        actions={[{ label: 'From a URL…', icon: <IconChainLink1 />, onSelect: () => setUrlOpen(true) }]}
      />
      <Dialog open={urlOpen} onOpenChange={setUrlOpen}>
        <DialogContent
          size="sm"
          onSubmit={event => {
            // The dialog is portaled out of the composer form in the DOM, but React still bubbles every
            // submit (including ones blocked by URL validation) through the component tree; stop it here
            // so adding a URL never sends the chat message.
            event.stopPropagation();
          }}
        >
          <Form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Attach from a URL</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Field>
                <FieldLabel>Public URL</FieldLabel>
                <Input name="url-attachment" type="url" placeholder="https://placehold.co/600x400/png" />
                <FieldError />
              </Field>
            </DialogBody>
            <DialogFooter>
              <DialogCancel>Cancel</DialogCancel>
              <DialogAction type="submit">Add</DialogAction>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
};
