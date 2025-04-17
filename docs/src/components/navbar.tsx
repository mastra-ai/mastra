import { GithubStarCount } from "@/components/github-star-count";

import Image from "next/image";
import Link from "next/link";
import { Navbar } from "nextra-theme-docs";
export const Nav = () => {
  return (
    <Navbar
      logo={
        <Image
          src="/logo.svg"
          alt="Mastra"
          width={24}
          height={24}
          className="w-[5.5rem] md:w-[7.5rem] md:h-[2rem]"
        />
      }
      logoLink={process.env.NEXT_PUBLIC_APP_URL}
      projectIcon={<GithubStarCount />}
      projectLink="https://github.com/mastra-ai/mastra"
      chatIcon={null}
      chatLink={""}
      className="relative"
    >
      <Link
        href="/docs"
        className="px-1.5 absolute left-[115px] md:left-[125px] text-[var(--x-color-primary-600)] font-medium tracking-wider py-0.5 text-xs rounded border border-[var(--border)] uppercase"
      >
        Docs
      </Link>
    </Navbar>
  );
};
