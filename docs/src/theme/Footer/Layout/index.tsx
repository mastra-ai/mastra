import type { Props } from "@theme/Footer/Layout";
import { type ReactNode } from "react";
import { Logo } from "../../Navbar/logo";

export default function FooterLayout({ links, copyright }: Props): ReactNode {
  return (
    <footer className="border-t-[0.5px] hidden border-(--border) pt-8  pb-24 md:pb-6">
      <div className="max-w-(--ifm-container-width) mx-auto w-full px-4 md:px-0">
        <div className="flex flex-col md:flex-row justify-between">
          <Logo />
          <div className="container-fluid">{links}</div>
        </div>
        {copyright && <div className="text-left">{copyright}</div>}
      </div>
    </footer>
  );
}
