import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { releaseSession, renderThread, stubPreparingSession } from './composer-session-test-fixture';

describe('composer attachment support', () => {
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
});
