import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChatLayout } from '../ChatLayout';

describe('ChatLayout', () => {
  it('renders the sidebar, the header, and the main area', () => {
    render(
      <ChatLayout sidebar={<div>sidebar-slot</div>} header={<div>header-slot</div>} main={<div>main-slot</div>} />,
    );

    expect(screen.getByText('sidebar-slot')).toBeInTheDocument();
    expect(screen.getByText('header-slot')).toBeInTheDocument();
    expect(screen.getByText('main-slot')).toBeInTheDocument();
  });

  it('renders without a header', () => {
    render(<ChatLayout sidebar={<div>sidebar-slot</div>} main={<div>main-slot</div>} />);

    expect(screen.getByText('main-slot')).toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });
});
