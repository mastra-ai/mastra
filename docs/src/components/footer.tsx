"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logo } from "./logo";

const links = [
  {
    text: "Docs",
    url: "/docs",
  },
  {
    text: "Book",
    url: "https://mastra.ai/book",
  },
  {
    text: "llms.txt",
    url: "/llms.txt",
  },
  {
    text: "llms-full.txt",
    url: "/llms-full.txt",
  },
];

const socials: Array<{
  text: string;

  url: string;
}> = [
  {
    text: "github",

    url: "https://github.com/mastra-ai/mastra",
  },
  {
    text: "discord",

    url: "https://discord.gg/BTYqqHKUrf",
  },
  {
    text: "X",

    url: "https://x.com/mastra_ai",
  },
  {
    text: "youtube",

    url: "https://www.youtube.com/@mastra-ai",
  },
];

export const Footer = () => {
  const pathname = usePathname();

  const showFooter = pathname === "/";

  return (
    <footer
      data-state={!showFooter}
      className="flex z-30 max-w-[1184px] mx-auto px-1 bg-[#fafafa] dark:bg-transparent  border-t-[var(--border)] relative w-full border-t-[0.5px] flex-col items-center pt-8 lg:pt-[5rem] pb-24 md:pb-32 footer data-[state=false]:mt-8 "
    >
      <div className="flex flex-col lg:flex-row gap-16 lg:gap-0 w-full justify-between px-6 md:px-0 md:pl-3 md:pr-4">
        <div className="flex gap-2 dark:text-white">{logo}</div>

        <div className="flex gap-10">
          <div className="flex gap-16">
            <ul className=" space-y-2 text-sm">
              <p className="text-black dark:text-white">Developers</p>
              {links.map((link) => {
                const isGithub = link.text.toLowerCase() === "github";
                return (
                  <li key={link.url}>
                    <Link
                      target={isGithub ? "_blank" : undefined}
                      href={link.url}
                      className="dark:hover:text-white hover:text-black text-[#939393] dark:text-[#939393] transition-colors"
                    >
                      {link.text}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <ul className="space-y-2 text-sm">
              <p className="text-black dark:text-white">Company</p>
              {socials.map((link) => {
                return (
                  <li key={link.url}>
                    <a
                      target="_blank"
                      href={link.url}
                      className=" text-[#939393] dark:text-[#939393] hover:text-black items-center dark:hover:text-white transition-colors capitalize group"
                    >
                      {link.text}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
};
