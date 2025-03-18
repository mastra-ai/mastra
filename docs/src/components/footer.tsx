import { Check, SendHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SubscribeForm } from "./subscribe-form";

export const logo = (
  <svg
    width={24}
    height={23}
    viewBox="0 0 114 34"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-[5.5rem] md:w-[7.5rem] md:h-[2rem]"
  >
    <circle
      cx="16.6532"
      cy="16.9999"
      r="14.0966"
      stroke="currentColor"
      stroke-width="1.16026"
    />
    <ellipse
      cx="16.6533"
      cy="17"
      rx="14.0966"
      ry="9.45478"
      transform="rotate(45 16.6533 17)"
      stroke="currentColor"
      stroke-width="1.16026"
    />
    <path
      d="M10.8984 17.0508H22.483"
      stroke="currentColor"
      stroke-width="1.16026"
    />
    <path
      d="M13.748 19.9932L19.6339 14.1074"
      stroke="currentColor"
      stroke-width="1.16026"
    />
    <path
      d="M19.6328 19.9932L13.747 14.1074"
      stroke="currentColor"
      stroke-width="1.16026"
    />
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M7.00863 10.796C4.56184 12.4371 3.13683 14.6416 3.13683 16.9998C3.13683 19.3579 4.56184 21.5624 7.00863 23.2035C9.45169 24.8421 12.8599 25.8744 16.6533 25.8744C20.4467 25.8744 23.8548 24.8421 26.2979 23.2035C28.7447 21.5624 30.1697 19.3579 30.1697 16.9998C30.1697 14.6416 28.7447 12.4371 26.2979 10.796C23.8548 9.15742 20.4467 8.12511 16.6533 8.12511C12.8599 8.12511 9.45169 9.15742 7.00863 10.796ZM6.36234 9.83242C9.02124 8.04906 12.6613 6.96484 16.6533 6.96484C20.6452 6.96484 24.2853 8.04906 26.9442 9.83242C29.5994 11.6133 31.33 14.1362 31.33 16.9998C31.33 19.8633 29.5994 22.3862 26.9442 24.1671C24.2853 25.9505 20.6452 27.0347 16.6533 27.0347C12.6613 27.0347 9.02124 25.9505 6.36234 24.1671C3.70718 22.3862 1.97656 19.8633 1.97656 16.9998C1.97656 14.1362 3.70718 11.6133 6.36234 9.83242Z"
      fill="currentColor"
    />
    <path
      d="M43.6244 11.5538H45.9131V14.0043C46.5373 12.178 47.9937 11.2763 49.7507 11.2763C51.554 11.2763 53.1491 12.2473 53.8195 14.2355C54.4669 12.2473 56.0851 11.2763 57.9115 11.2763C60.3158 11.2763 62.3271 12.9409 62.3271 16.4317V24.5H60.0152V16.6167C60.0152 14.6285 59.1136 13.2876 57.1948 13.2876C55.1142 13.2876 54.1432 14.8366 54.1432 16.9634V24.5H51.8314V16.6167C51.8314 14.6285 50.9298 13.2876 48.9878 13.2876C46.9072 13.2876 45.9362 14.8366 45.9362 16.9634V24.5H43.6244V11.5538ZM64.4285 21.2866C64.4285 19.5296 65.5613 18.2118 67.6188 17.5645L71.9651 16.1543C71.8495 14.1661 70.9016 13.3801 69.029 13.3801C67.9425 13.3801 66.7634 13.6344 65.0758 14.2817V12.0624C66.5323 11.6 67.9656 11.2763 69.3064 11.2763C72.7511 11.2763 74.2769 13.4263 74.2769 16.5242V24.5H72.0113V22.6043C71.2946 23.9452 69.9075 24.7774 68.1968 24.7774C65.8387 24.7774 64.4285 23.2516 64.4285 21.2866ZM66.7634 21.1016C66.7634 22.1419 67.5957 22.928 68.8672 22.928C70.4392 22.928 71.9651 21.7489 71.9651 19.9919V18.05L68.5204 19.1597C67.3183 19.5296 66.7634 20.2231 66.7634 21.1016ZM79.9317 24.7774C79.0069 24.7774 77.9204 24.6156 76.6257 24.107V21.9108C77.8741 22.4656 79.0069 22.7199 79.9317 22.7199C81.4112 22.7199 82.0585 21.9801 82.0585 21.0554C82.0585 19.9919 81.2032 19.5527 79.9085 18.9516C78.2671 18.1887 76.4177 17.3796 76.4177 14.9984C76.4177 12.8021 78.0128 11.2763 80.8564 11.2763C81.758 11.2763 82.8214 11.4151 84.0467 11.7849V13.9349C82.8677 13.5651 81.758 13.3339 80.8564 13.3339C79.3999 13.3339 78.7526 14.0737 78.7526 14.9521C78.7526 15.9231 79.608 16.3161 80.8795 16.9172C82.544 17.6801 84.3935 18.5586 84.3935 21.0091C84.3935 23.2516 82.7983 24.7774 79.9317 24.7774ZM91.6046 24.6387C89.0153 24.6387 87.9057 23.4134 87.9057 20.9398V13.6344H85.9406V11.5538H87.9057V8.94139L90.2175 8.27096V11.5538H93.5927V13.6344H90.2175V20.593C90.2175 22.1651 90.703 22.5118 91.9282 22.5118C92.5062 22.5118 93.0841 22.4425 93.5927 22.35V24.4538C92.9223 24.5694 92.275 24.6387 91.6046 24.6387ZM95.6857 11.5538H97.9744V14.5823C98.6679 12.571 100.263 11.3919 102.575 11.3919V13.7731C102.321 13.75 102.089 13.7269 101.835 13.7269C99.5002 13.7269 97.9975 15.1833 97.9975 18.1194V24.5H95.6857V11.5538ZM103.531 21.2866C103.531 19.5296 104.664 18.2118 106.721 17.5645L111.067 16.1543C110.952 14.1661 110.004 13.3801 108.131 13.3801C107.045 13.3801 105.866 13.6344 104.178 14.2817V12.0624C105.635 11.6 107.068 11.2763 108.409 11.2763C111.853 11.2763 113.379 13.4263 113.379 16.5242V24.5H111.114V22.6043C110.397 23.9452 109.01 24.7774 107.299 24.7774C104.941 24.7774 103.531 23.2516 103.531 21.2866ZM105.866 21.1016C105.866 22.1419 106.698 22.928 107.97 22.928C109.542 22.928 111.067 21.7489 111.067 19.9919V18.05L107.623 19.1597C106.421 19.5296 105.866 20.2231 105.866 21.1016Z"
      fill="currentColor"
    />
  </svg>
);
const links = [
  {
    text: "Docs",
    url: "/docs",
  },
  {
    text: "Book",
    url: "/book",
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
      className="flex z-30 max-w-[90rem] mx-auto px-1 bg-[#fafafa] dark:bg-[#0a0a0a] dark:border-t-[#222222] relative w-full border-t-[0.5px] flex-col items-center pt-8 lg:pt-[5rem] pb-24 md:pb-32 footer data-[state=false]:mt-8 "
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
          <div className="">
            <label
              htmlFor="email"
              className="text-[#939393] mb-0.5 mt-[1px] block text-xs"
            >
              Mastra Newsletter
            </label>
            <SubscribeForm
              idleIcon={
                <SendHorizontal className="w-4 h-4" stroke="currentColor" />
              }
              successIcon={<Check className="w-4 h-4" />}
              showLabel={false}
              inputClassName="min-w-[50px] max-w-[70%] md:min-w-[50px] pl-2 truncate md:max-w-full"
              buttonClassName="w-fit mr-auto md:w-fit h-[34px] py-0 px-3"
              className=" md:items-start gap-0 md:gap-2 mt-0 w-[200px]"
            />
          </div>
        </div>
      </div>
    </footer>
  );
};
