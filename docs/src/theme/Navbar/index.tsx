import Link from "@docusaurus/Link";
import { GithubStarCount } from "@site/src/components/github-star-count";
import NavbarLayout from "@theme/Navbar/Layout";
import NavbarMobileSidebarToggle from "@theme/Navbar/MobileSidebar/Toggle";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { type ReactNode } from "react";
import SearchContainer, { AskAI } from "./Search";
import { Logo } from "./logo";
import { TabSwitcher } from "./tab-switcher";
import { MobileDocsDropdown } from "@site/src/components/mobile-docs-dropdown";
import { GithubCautionIcon } from "../Admonition/icons";

function AnnouncementBanner() {
  return (
    <div className="bg-yellow-50 dark:bg-yellow-600/30 text-yellow-700 dark:text-yellow-500 py-2 px-4 text-sm flex items-center justify-center">
      <div className="shrink-0 size-4 mr-4 md:mr-2">
        <GithubCautionIcon />
      </div>
      <div>
        <span className="font-semibold">
          Mastra v1 is coming in January 2026.
        </span>{" "}
        Get ahead by starting{" "}
        <a
          className="text-yellow-700! dark:text-yellow-500! underline! hover:no-underline! font-medium!"
          href="https://mastra.ai/docs/v1/getting-started/start"
        >
          new projects
        </a>{" "}
        with the beta or{" "}
        <a
          className="text-yellow-700! dark:text-yellow-500! underline! hover:no-underline! font-medium!"
          href="https://mastra.ai/guides/v1/migrations/upgrade-to-v1/overview"
        >
          upgrade
        </a>{" "}
        your existing project today.
      </div>
    </div>
  );
}

function NavbarContentDesktop() {
  const { i18n } = useDocusaurusContext();
  const locale = i18n?.currentLocale;
  return (
    <div className="flex px-4 border-b-[0.5px] h-(--ifm-navbar-height) border-(--border-subtle) mx-auto w-full items-center justify-between @container">
      <div className="flex gap-2 items-center">
        <Link href="/docs">
          <Logo />
        </Link>
        <div className="hidden @[1262px]:block">
          <TabSwitcher />
        </div>
        <div className="w-[200px] hidden @[1023px]:block @[1262px]:hidden">
          <MobileDocsDropdown />
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <div className="flex items-center">
          <div className="hidden gap-2 items-center lg:flex">
            <GithubStarCount />
          </div>
        </div>
        <div className="hidden @[798px]:block">
          <div className="flex gap-2 items-center">
            <SearchContainer locale={locale} />
            <AskAI />
          </div>
        </div>
        <NavbarMobileSidebarToggle />
      </div>
    </div>
  );
}

export default function Navbar(): ReactNode {
  return (
    <>
      <AnnouncementBanner />
      <NavbarLayout>
        <NavbarContentDesktop />
      </NavbarLayout>
    </>
  );
}
