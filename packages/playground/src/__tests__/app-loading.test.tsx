import { cleanup, render, screen } from '@testing-library/react';
import { delay, http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import AppWrapper from '../App';
import { server } from '@/test/msw-server';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('Studio cold load', () => {
  it('shows a loading spinner while the instance probe is in flight', async () => {
    server.use(http.get('http://localhost:4111/api/auth/capabilities', () => delay('infinite')));

    render(<AppWrapper />);

    expect(await screen.findByRole('status', { name: 'Loading' })).toBeTruthy();
  });
});
