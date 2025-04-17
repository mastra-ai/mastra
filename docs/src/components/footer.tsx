"use client";
import { T, Var } from "gt-next/client";
import { Check, SendHorizontal } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SubscribeForm } from "./subscribe-form";

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
  {
    text: "MCP Registry Registry",
    url: "https://mastra.ai/mcp-registry-registry",
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
    <T id="components.footer.0">
      <footer
        data-state={!showFooter}
        className="flex z-30  mx-auto bg-[#fafafa] dark:bg-transparent  border-t-[var(--border)]  relative w-full border-t-[0.5px] flex-col items-center pt-8 lg:pt-[5rem] pb-24 md:pb-32 footer data-[state=false]:mt-8 "
      >
        <div className="flex max-w-(--nextra-content-width) pl-[max(env(safe-area-inset-left),1.5rem)] pr-[max(env(safe-area-inset-right),1.5rem)] flex-col lg:flex-row gap-16 lg:gap-0 w-full justify-between">
          <div>
            <Image
              src="/logo.svg"
              alt="Mastra"
              width={24}
              height={24}
              className="w-[5.5rem] -ml-2 xl:-m-1 md:w-[7.5rem] md:h-[2rem]"
            />
            <div className="md:hidden pt-10">
              <label
                htmlFor="email"
                className="text-text-6 pb-3 block text-sm items"
              >
                Mastra Newsletter
              </label>
              <SubscribeForm
                placeholder="you@company.com"
                idleIcon={<SendHorizontal className="w-4 h-4" />}
                successIcon={<Check className="w-4 h-4" />}
                showLabel={false}
                inputClassName="min-w-[50px] max-w-full rounded-r-none md:min-w-[50px] pl-2 truncate md:max-w-full"
                buttonClassName="w-fit mr-auto rounded-l-none md:w-fit h-[34px] py-0 px-3"
                className="md:items-start flex-row items-start gap-0  md:gap-0 mt-0"
              />
            </div>
          </div>
          <div className="flex gap-10">
            <div className="flex gap-16">
              <ul className=" space-y-2 text-sm">
                <p className="text-black dark:text-white">Developers</p>
                <Var>
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
                </Var>
              </ul>
              <ul className="space-y-2 text-sm">
                <p className="text-black dark:text-white">Company</p>
                <Var>
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
                </Var>
              </ul>
            </div>
            <div className="hidden md:block xl:hidden">
              <SubscribeForm
                placeholder="you@company.com"
                idleIcon={
                  <SendHorizontal className="w-4 h-4" stroke="currentColor" />
                }
                label="Follow along with us:"
                successIcon={<Check className="w-4 h-4" />}
                inputClassName="min-w-[50px] border-[0.5px] md:mb-0 h-[34px] max-w-full rounded-r-none md:min-w-[50px] pl-2 truncate md:max-w-full"
                buttonClassName="w-fit mr-auto mt-auto rounded-l-none md:w-fit h-[34px] py-0 px-3"
                className="md:items-start flex-col items-start gap-0  md:gap-0 mt-0"
              />
            </div>
          </div>
        </div>
      </footer>
    </T>
  );
};
