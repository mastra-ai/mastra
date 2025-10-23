import type { Props } from '@theme/Footer/Layout';
import { type ReactNode } from 'react';

import { Logo } from '../../Navbar';

export default function FooterLayout({ style, links, logo, copyright }: Props): ReactNode {
  return (
    <footer className="border-t-[0.5px] border-(--border) pt-8  pb-24 md:pb-6">
      <div className="max-w-(--ifm-container-width) mx-auto w-full">
        <div className="flex justify-between">
          <Logo />
          <div className="container-fluid">{links}</div>
        </div>
        {copyright && <div className="text-left">{copyright}</div>}
      </div>
    </footer>
  );
}
