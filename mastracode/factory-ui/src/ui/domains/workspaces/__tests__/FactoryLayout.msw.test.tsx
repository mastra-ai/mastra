import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../e2e/ui/render';
import { FactoryLayout } from '../components/FactoryLayout';

function renderFactoryRoute() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/factory-1']}>
      <Routes>
        <Route path="/" element={<div>landing</div>} />
        <Route path="/factories/:factoryId" element={<FactoryLayout />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('FactoryLayout', () => {
  it('shows the error notice instead of bouncing to the landing route when the factories query fails', async () => {
    server.use(http.get(`${TEST_BASE_URL}/web/factory/projects`, () => new HttpResponse(null, { status: 500 })));

    const { container } = renderFactoryRoute();

    const message = await screen.findByText(/Could not load factories/);
    expect(screen.queryByText('landing')).not.toBeInTheDocument();

    // Notice is a CSS container, so a content-sized parent collapses it to one character per line.
    expect(container.querySelector('.w-full.max-w-md')).toContainElement(message);
  });
});
