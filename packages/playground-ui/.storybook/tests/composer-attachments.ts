import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test';

export async function verifyMixedAttachments({ canvasElement }: { canvasElement: HTMLElement }) {
  const canvas = within(canvasElement);
  const attachments = canvas.getByRole('region', { name: 'Draft attachments' });
  const previews = Array.from(attachments.children);
  const thumbnailHeight = previews[0]?.getBoundingClientRect().height;
  const thumbnailStyle = previews[0] && getComputedStyle(previews[0]);

  const scrollArea = attachments.closest('[data-slot="composer-attachment-scroll-area"]');
  if (!scrollArea || !previews[0]) throw new Error('Missing attachment scroll area');
  const areaRect = scrollArea.getBoundingClientRect();
  const firstCardRect = previews[0].getBoundingClientRect();
  // Visible scrollbars must overlay the gutter rather than add height beneath the cards.
  await expect(firstCardRect.top - areaRect.top).toBe(8);
  await expect(areaRect.bottom - firstCardRect.bottom).toBe(8);

  await expect(thumbnailHeight).toBeGreaterThan(0);
  for (const preview of previews) {
    await expect(preview?.getBoundingClientRect().height).toBe(thumbnailHeight);
    const style = getComputedStyle(preview);
    await expect(preview).toHaveTextContent(preview.getAttribute('title') ?? '');
    await expect(style.borderRadius).toBe(thumbnailStyle?.borderRadius);
    await expect(parseFloat(style.borderRadius)).toBeLessThan((thumbnailHeight ?? 0) / 2);
    await expect(style.backgroundColor).toBe(thumbnailStyle?.backgroundColor);
    await expect(style.boxShadow).toBe(thumbnailStyle?.boxShadow);
    const cover = preview.querySelector('[data-slot="composer-attachment-cover"]');
    const control = cover?.querySelector('button, a');
    if (control) {
      await expect(control.getBoundingClientRect().height).toBe(thumbnailHeight);
      await expect(getComputedStyle(control).borderRadius).toBe(style.borderRadius);
      await expect(getComputedStyle(control).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    }
  }

  const actionButtons = canvas.getAllByRole('button', { name: /^(Remove |Actions for )/ });
  for (const button of actionButtons) {
    const card = button.closest('[data-slot="composer-attachment"]');
    if (!card || !button.parentElement) throw new Error('Missing attachment action column');
    const positionedElement = button.hasAttribute('aria-haspopup') ? button : button.parentElement;
    const inset = parseFloat(getComputedStyle(positionedElement).right);
    await expect(parseFloat(getComputedStyle(button).borderRadius) + inset).toBe(
      parseFloat(getComputedStyle(card).borderRadius),
    );
  }
  const image = canvas.getByRole('img', { name: 'diagram.png' });
  const imageTile = image.parentElement;
  const imageCard = image.closest('[title="diagram.png"]');
  if (!imageTile || !imageCard) throw new Error('Missing image attachment');
  const tileRect = imageTile.getBoundingClientRect();
  const cardRect = imageCard.getBoundingClientRect();
  const inset = tileRect.left - cardRect.left;
  await expect(tileRect.top - cardRect.top).toBe(inset);
  await expect(cardRect.bottom - tileRect.bottom).toBe(inset);
  await expect(tileRect.width).toBe(tileRect.height);
  await expect(parseFloat(getComputedStyle(imageTile).borderTopLeftRadius) + inset).toBe(
    parseFloat(getComputedStyle(imageCard).borderTopLeftRadius),
  );
  const longFilename = canvas.getByText('review-notes-with-a-long-filename-é日本語.csv');
  await expect(longFilename.scrollWidth).toBeGreaterThan(longFilename.clientWidth);
  await expect(getComputedStyle(longFilename).textOverflow).toBe('ellipsis');
}

export async function verifyPreviewAndRemoval({ canvasElement }: { canvasElement: HTMLElement }, imageSrc: string) {
  const canvas = within(canvasElement);
  const preview = canvas.getByRole('button', { name: 'Preview diagram.png' });
  preview.focus();
  await userEvent.keyboard('{Enter}');
  const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
  await expect(within(dialog).getByRole('img')).toHaveAttribute('src', imageSrc);
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(preview).toHaveFocus());
  await removeAttachment(canvasElement, 'diagram.png');
  await expect(canvas.queryByRole('button', { name: 'Preview diagram.png' })).not.toBeInTheDocument();
  await expect(canvas.getByRole('button', { name: /Preview review-notes/ })).toBeVisible();
  const textPreview = canvas.getByRole('button', { name: /Preview review-notes/ });
  textPreview.focus();
  await userEvent.keyboard('{Enter}');
  const textDialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
  await expect(textDialog).toHaveTextContent('Zoë,12');
  await expect(textDialog).toHaveTextContent('日本語,20');
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(textPreview).toHaveFocus());
  await removeAttachment(canvasElement, 'review-notes-with-a-long-filename-é日本語.csv');
  await expect(canvas.queryByRole('button', { name: /Preview review-notes/ })).not.toBeInTheDocument();
  await expect(canvas.getByText('brief.pdf')).toBeInTheDocument();
  await expect(canvas.getByText('clip.mp4')).toBeInTheDocument();
}

async function removeAttachment(canvasElement: HTMLElement, name: string) {
  const canvas = within(canvasElement);
  const remove = canvas.queryByRole('button', { name: `Remove ${name}` });
  if (remove) {
    await userEvent.click(remove);
    return;
  }
  await userEvent.click(canvas.getByRole('button', { name: `Actions for ${name}` }));
  const body = within(canvasElement.ownerDocument.body);
  await userEvent.click(await body.findByRole('menuitem', { name: 'Remove' }));
}

export async function verifyKeyboardRemoval({ canvasElement }: { canvasElement: HTMLElement }) {
  const canvas = within(canvasElement);
  const preview = canvas.getByRole('button', { name: 'Preview diagram.png' });
  const remove = canvas.queryByRole('button', { name: 'Remove diagram.png' });
  preview.focus();
  if (remove) {
    await waitFor(() => expect(getComputedStyle(remove.parentElement ?? remove).opacity).toBe('1'));
    remove.focus();
  } else {
    canvas.getByRole('button', { name: 'Actions for diagram.png' }).focus();
    await userEvent.keyboard('{Enter}');
    const body = within(canvasElement.ownerDocument.body);
    (await body.findByRole('menuitem', { name: 'Remove' })).focus();
  }
  await userEvent.keyboard('{Enter}');
  await expect(canvas.queryByRole('button', { name: 'Preview diagram.png' })).not.toBeInTheDocument();
  await expect(canvas.getByText('brief.pdf')).toBeInTheDocument();
}

export async function verifyContextMenu({ canvasElement }: { canvasElement: HTMLElement }) {
  const canvas = within(canvasElement);
  const body = within(canvasElement.ownerDocument.body);
  for (const action of canvas.getAllByRole('button', { name: /^(Remove |Edit |Actions for )/ })) {
    action.focus();
    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    await body.findByRole('menu');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(action).toHaveFocus());
    fireEvent.contextMenu(action);
    const pointerMenu = await body.findByRole('menu');
    pointerMenu.focus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(action).toHaveFocus());
  }
  const preview = canvas.getByRole('button', { name: 'Preview project-notes.txt' });
  preview.focus();
  await userEvent.keyboard('{Shift>}{F10}{/Shift}');
  await userEvent.click(await body.findByRole('menuitem', { name: 'Preview' }));
  const dialog = await body.findByRole('dialog');
  await expect(dialog).toHaveTextContent('Zoë,12');
  await waitFor(() => expect(dialog.contains(canvasElement.ownerDocument.activeElement)).toBe(true));
  await userEvent.keyboard('{Shift>}{F10}{/Shift}');
  await expect(body.queryByRole('menu')).not.toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(preview).toHaveFocus());
  await userEvent.keyboard('{Shift>}{F10}{/Shift}');
  await userEvent.click(await body.findByRole('menuitem', { name: 'Remove' }));
  await expect(canvas.queryByRole('button', { name: 'Preview project-notes.txt' })).not.toBeInTheDocument();
  await expect(canvas.getByText('archive.zip')).toBeVisible();
}

export async function verifyAttachmentSpacing({ canvasElement }: { canvasElement: HTMLElement }) {
  const canvas = within(canvasElement);
  const menuButton = canvas.queryByRole('button', { name: /^Actions for / });
  const firstAction = menuButton ?? canvas.getByRole('button', { name: /^Remove / });
  const card = firstAction.closest('[data-slot="composer-attachment"]');
  const cover = card?.querySelector('[data-slot="composer-attachment-cover"]');
  if (!card || !cover) throw new Error('Missing attachment sleeve');

  firstAction.focus();
  await waitFor(async () => {
    const bounds = card.getBoundingClientRect();
    const top = firstAction.getBoundingClientRect();
    const edit = canvas.queryByRole('button', { name: /^Edit / });
    const bottom = edit?.getBoundingClientRect() ?? top;
    const rightInset = bounds.right - top.right;
    await expect(rightInset).toBe(4);
    await expect(top.top - bounds.top).toBe(rightInset);
    await expect(bounds.bottom - bottom.bottom).toBe(rightInset);
    if (!menuButton) await expect(top.left - cover.getBoundingClientRect().right).toBe(rightInset);
    if (edit) {
      await expect(bottom.top - top.bottom).toBe(rightInset);
      await expect(bottom.height).toBe(top.height);
    } else {
      await expect(top.height).toBe(bounds.height - 2 * rightInset);
    }
  });
}

export async function verifyEditing(context: { canvasElement: HTMLElement }, onEdit: () => void) {
  await verifyAttachmentSpacing(context);
  const canvas = within(context.canvasElement);
  const edit = canvas.queryByRole('button', { name: 'Edit diagram.png' });
  if (edit) {
    await userEvent.click(edit);
  } else {
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for diagram.png' }));
    const body = within(context.canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole('menuitem', { name: 'Edit' }));
  }
  await expect(onEdit).toHaveBeenCalledOnce();

  const opener = edit ?? canvas.getByRole('button', { name: 'Actions for diagram.png' });
  opener.focus();
  await userEvent.keyboard('{Shift>}{F10}{/Shift}');
  const body = within(context.canvasElement.ownerDocument.body);
  (await body.findByRole('menuitem', { name: 'Edit' })).focus();
  await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(opener).toHaveFocus());
  await expect(onEdit).toHaveBeenCalledTimes(2);
}
