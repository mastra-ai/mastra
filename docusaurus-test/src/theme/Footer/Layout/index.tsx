import type { Props } from '@theme/Footer/Layout';
import { type ReactNode } from 'react';

import { Logo } from '../../Navbar';

export default function FooterLayout({ style, links, logo, copyright }: Props): ReactNode {
  return (
    <footer className="border-t-[0.5px] border-(--border) pt-8  pb-24 md:pb-20">
      <div className="max-w-(--ifm-container-width) mx-auto w-full">
        <div className="flex justify-between gap-[400px]">
          <Logo />
          <div className="container container-fluid">{links}</div>
        </div>
        {copyright && <div className="mt-20 text-left">{copyright}</div>}
      </div>
    </footer>
  );
}
