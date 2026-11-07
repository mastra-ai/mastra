import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { pickImage, releaseSession, renderThread, stubPreparingSession } from './composer-session-test-fixture';

describe('composer attachment support', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('offers photos and files from the attach menu, and only accepts images', async () => {
    const session = stubPreparingSession();
    const user = userEvent.setup();
    const { client } = renderThread();

    await releaseSession(session.finishWorkspace, client);

    const attach = screen.getByRole('button', { name: 'Attach images' });
    expect(attach).toBeEnabled();

    await user.click(attach);
    expect(await screen.findByRole('menuitem', { name: 'Photos' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Files' })).toBeInTheDocument();
    expect(screen.getByLabelText('Photos')).toHaveAttribute('accept', 'image/*');
    expect(screen.getByLabelText('Files')).toHaveAttribute('accept', 'image/*');
  });

  it('says so when a picked image cannot be read, and attaches nothing', async () => {
    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
      this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>);
    });
    const session = stubPreparingSession();
    const user = userEvent.setup();
    const { client } = renderThread();
    render(<Toaster />);

    await releaseSession(session.finishWorkspace, client);
    await pickImage(user, new File(['png'], 'shot.png', { type: 'image/png' }));

    expect(await screen.findByText("Couldn't read an image. Try attaching it again.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove shot.png' })).not.toBeInTheDocument();
  });
});
