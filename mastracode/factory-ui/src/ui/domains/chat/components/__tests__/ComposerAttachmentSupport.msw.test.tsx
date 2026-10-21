import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { releaseSession, renderThread, stubPreparingSession } from './composer-session-test-fixture';

describe('composer attachment support', () => {
  it('explains that attachments are limited to images', async () => {
    const session = stubPreparingSession();
    const user = userEvent.setup();
    const { client } = renderThread();

    await releaseSession(session.finishWorkspace, client);

    const attach = screen.getByRole('button', { name: 'Attach image' });
    expect(attach).toBeEnabled();

    await user.hover(attach);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/^Images only$/);
  });
});
