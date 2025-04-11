import { Navbar } from "nextra-theme-docs";
import { LogoWithSuffix } from "@/components/logo";
import { GithubStarCount } from "@/components/github-star-count";
import Link from "next/link";

export const Nav = () => {
  return (
    <Navbar
      logo={<LogoWithSuffix />}
      logoLink={process.env.NEXT_PUBLIC_APP_URL}
      projectIcon={<GithubStarCount />}
      projectLink="https://github.com/mastra-ai/mastra"
      chatIcon={null}
      chatLink={""}
      className="relative"
    >
      <Link
        href="/docs"
        className="px-1.5 absolute left-[130px] text-[var(--x-color-primary-600)] font-medium tracking-wider py-0.5 text-xs rounded border border-[var(--border)] uppercase"
      >
        Docs
      </Link>
    </Navbar>
  );
};
