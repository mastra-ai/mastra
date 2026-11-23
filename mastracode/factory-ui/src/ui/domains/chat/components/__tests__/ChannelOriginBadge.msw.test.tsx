import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChannelOriginBadge } from '../MessageSender';

describe('ChannelOriginBadge', () => {
  it('renders an unknown platform by its raw name without an icon', () => {
    render(<ChannelOriginBadge origin={{ platform: 'discord' }} />);

    expect(screen.getByLabelText('Sent from discord')).toHaveTextContent('via discord');
  });
});
