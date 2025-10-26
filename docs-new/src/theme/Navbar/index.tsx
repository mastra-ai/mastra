import React, { type ReactNode } from 'react';
import NavbarLayout from '@theme/Navbar/Layout';
import NavbarContent from '@theme/Navbar/Content';
import { TabSwitcher } from './tab-switcher';
import { ThemeSwitcher } from '@site/src/components/theme-switcher';
import { GithubStarCount } from '@site/src/components/github-star-count';
import Link from '@docusaurus/Link';
import SearchContainer from './Search';
import { Logo } from './logo';
import { useNavbarMobileSidebar } from '@docusaurus/theme-common/internal';
import NavbarMobileSidebarToggle from '@theme/Navbar/MobileSidebar/Toggle';

function NavbarContentDesktop() {
  const mobileSidebar = useNavbarMobileSidebar();
  return (
    <>
      <div className="flex px-4 lg:px-0 border-b-[0.5px] h-[60px] border-(--border-subtle) max-w-(--ifm-container-width) mx-auto w-full items-center justify-between">
        <Link href="/docs">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="px-1.5 dark:text-(--mastra-green-accent) mb-0 w-[3.2rem] grid place-items-center h-[1.6rem] font-medium tracking-wider py-0.5 text-xs rounded-[0.44rem] border border-(--border) uppercase">
              Docs
            </span>
          </div>
        </Link>
        <SearchContainer locale="en" />
        <div className="flex gap-2 items-center">
          <div className="flex gap-4 items-center">
            <GithubStarCount />
            <div className="hidden lg:block">
              <ThemeSwitcher />
            </div>
          </div>
          <NavbarMobileSidebarToggle />
        </div>
      </div>
      <div className="hidden lg:block">
        <TabSwitcher />
      </div>
    </>
  );
}

export default function Navbar(): ReactNode {
  return (
    <NavbarLayout>
      <NavbarContentDesktop />

      {/* <NavbarContent /> */}
    </NavbarLayout>
  );
}
