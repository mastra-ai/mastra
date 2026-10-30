import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { lazyPage } from '../PageSuspense';

function deferredPage() {
  let resolve: (page: () => React.JSX.Element) => void = () => {};
  const loading = new Promise<() => React.JSX.Element>(r => {
    resolve = r;
  });
  return { load: () => loading, resolve };
}

describe('a lazily loaded page', () => {
  it('shows its loader on a first visit while its code loads', async () => {
    const { load, resolve } = deferredPage();
    const Page = lazyPage(load);

    render(<Page />);
    expect(screen.getByLabelText('Loading page')).toBeInTheDocument();

    resolve(() => <h1>Thread</h1>);
    expect(await screen.findByRole('heading', { name: 'Thread' })).toBeInTheDocument();
  });

  it('renders straight away, with no loader, once preloaded', async () => {
    const { load, resolve } = deferredPage();
    const Page = lazyPage(load);

    const preloading = Page.preload();
    resolve(() => <h1>Thread</h1>);
    await preloading;

    render(<Page />);
    expect(screen.getByRole('heading', { name: 'Thread' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Loading page')).not.toBeInTheDocument();
  });
});
