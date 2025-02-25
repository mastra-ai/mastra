/* eslint-disable react-hooks/rules-of-hooks */
import { DocsThemeConfig, useConfig } from "nextra-theme-docs";

import { useRouter } from "next/router";

import { OperatorsTable } from "./src/components/operators-table";
import { PropertiesTable } from "./src/components/properties-table";
import { TableOfContents } from "./src/components/toc";
import { GithubStarCount } from "@/components/github-star-count";

const logo = (
  <svg
    width="100"
    height="36"
    viewBox="0 0 119 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="18.0002"
      cy="18.0002"
      r="15.2365"
      stroke="currentColor"
      strokeWidth="1.25409"
    />
    <ellipse
      cx="18.0008"
      cy="18"
      rx="15.2365"
      ry="10.2193"
      transform="rotate(45 18.0008 18)"
      stroke="currentColor"
      strokeWidth="1.25409"
    />
    <path
      d="M11.7793 18.0547H24.3007"
      stroke="currentColor"
      strokeWidth="1.25409"
    />
    <path
      d="M14.8574 21.2354L21.2192 14.8736"
      stroke="currentColor"
      strokeWidth="1.25409"
    />
    <path
      d="M21.2207 21.2354L14.8589 14.8736"
      stroke="currentColor"
      strokeWidth="1.25409"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7.57571 11.2943C4.93105 13.0681 3.39081 15.4508 3.39081 17.9997C3.39081 20.5486 4.93105 22.9313 7.57571 24.7051C10.2163 26.4762 13.9001 27.592 18.0003 27.592C22.1004 27.592 25.7842 26.4762 28.4248 24.7051C31.0695 22.9313 32.6097 20.5486 32.6097 17.9997C32.6097 15.4508 31.0695 13.0681 28.4248 11.2943C25.7842 9.5232 22.1004 8.40741 18.0003 8.40741C13.9001 8.40741 10.2163 9.5232 7.57571 11.2943ZM6.87715 10.2528C9.75106 8.32521 13.6855 7.15332 18.0003 7.15332C22.315 7.15332 26.2495 8.32521 29.1234 10.2528C31.9932 12.1776 33.8638 14.9046 33.8638 17.9997C33.8638 21.0948 31.9932 23.8218 29.1234 25.7466C26.2495 27.6742 22.315 28.8461 18.0003 28.8461C13.6855 28.8461 9.75106 27.6742 6.87715 25.7466C4.00728 23.8218 2.13672 21.0948 2.13672 17.9997C2.13672 14.9046 4.00728 12.1776 6.87715 10.2528Z"
      fill="currentColor"
    />
    <path
      d="M46.56 11.56H48.48V14.152C49.128 12.208 50.616 11.272 52.488 11.272C54.408 11.272 56.136 12.304 56.808 14.488C57.432 12.328 59.136 11.272 61.128 11.272C63.624 11.272 65.76 13 65.76 16.72V25H63.84V16.72C63.84 14.488 62.808 12.976 60.624 12.976C58.224 12.976 57.12 14.776 57.12 17.2V25H55.2V16.72C55.2 14.488 54.168 12.976 51.984 12.976C49.584 12.976 48.48 14.776 48.48 17.2V25H46.56V11.56ZM68.2022 21.688C68.2022 19.936 69.3062 18.568 71.4422 17.896L76.1462 16.408C76.0742 13.936 74.9462 13 72.8342 13C71.7062 13 70.5542 13.264 68.8502 13.936V12.088C70.2902 11.608 71.7302 11.272 73.0742 11.272C76.4822 11.272 78.0662 13.432 78.0662 16.6V25H76.1462V22.936C75.4262 24.376 73.9622 25.288 72.1142 25.288C69.6662 25.288 68.2022 23.704 68.2022 21.688ZM70.1222 21.592C70.1222 22.768 71.0582 23.68 72.5222 23.68C74.3222 23.68 76.1462 22.336 76.1462 20.32V18.112L72.0422 19.408C70.6982 19.84 70.1222 20.656 70.1222 21.592ZM84.0589 25.288C83.0989 25.288 81.9949 25.096 80.6989 24.52V22.696C81.9469 23.296 83.0749 23.56 84.0589 23.56C85.8349 23.56 86.6269 22.648 86.6269 21.52C86.6269 20.248 85.6189 19.744 84.2029 19.072C82.4989 18.256 80.5309 17.416 80.5309 14.992C80.5309 12.784 82.1389 11.272 84.9949 11.272C85.9069 11.272 86.9629 11.416 88.1869 11.8V13.552C87.0109 13.216 85.9309 13 84.9949 13C83.2429 13 82.4509 13.888 82.4509 14.968C82.4509 16.144 83.4589 16.576 84.8509 17.248C86.5789 18.064 88.5469 18.976 88.5469 21.496C88.5469 23.752 86.9389 25.288 84.0589 25.288ZM96.1318 25.168C93.6118 25.168 92.3878 23.944 92.3878 21.52V13.288H90.3478V11.56H92.3878V8.728L94.3078 8.128V11.56H98.0278V13.288H94.3078V21.208C94.3078 23.08 94.8838 23.44 96.2518 23.44C96.8758 23.44 97.4998 23.368 98.0278 23.272V25C97.3558 25.096 96.7558 25.168 96.1318 25.168ZM100.419 11.56H102.339V14.752C103.011 12.64 104.811 11.416 107.139 11.416V13.336C106.971 13.312 106.827 13.312 106.659 13.312C104.163 13.312 102.339 14.92 102.339 18.16V25H100.419V11.56ZM108.21 21.688C108.21 19.936 109.314 18.568 111.45 17.896L116.154 16.408C116.082 13.936 114.954 13 112.842 13C111.714 13 110.562 13.264 108.858 13.936V12.088C110.298 11.608 111.738 11.272 113.082 11.272C116.49 11.272 118.074 13.432 118.074 16.6V25H116.154V22.936C115.434 24.376 113.97 25.288 112.122 25.288C109.674 25.288 108.21 23.704 108.21 21.688ZM110.13 21.592C110.13 22.768 111.066 23.68 112.53 23.68C114.33 23.68 116.154 22.336 116.154 20.32V18.112L112.05 19.408C110.706 19.84 110.13 20.656 110.13 21.592Z"
      fill="currentColor"
    />
  </svg>
);

const docs: DocsThemeConfig = {
  logo,
  logoLink: process.env.NEXT_PUBLIC_APP_URL,
  project: {
    link: "https://github.com/mastra-ai/mastra",
    icon: typeof window !== undefined ? GithubStarCount : null,
  },
  docsRepositoryBase: "https://github.com/mastra-ai/mastra/blob/main/docs",
  chat: {
    link: "https://discord.gg/BTYqqHKUrf",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="currentColor"
        viewBox="0 0 16 16"
        className="w-4 h-4"
      >
        <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612" />
      </svg>
    ),
  },

  head: () => {
    const config = useConfig();
    const router = useRouter();
    const domain = process.env.NEXT_PUBLIC_APP_URL;
    const { title, frontMatter } = config;
    const description = frontMatter?.description;
    const ogImage =
      frontMatter?.ogImage ||
      `${domain}/api/og/docs?title=${encodeURIComponent(title)}`;

    const ogTitle = `${title}`;
    return (
      <>
        <title>{ogTitle}</title>
        <meta property="og:title" content={ogTitle} />
        {description && <meta name="description" content={description} />}
        <link rel="canonical" href={`${domain}${router.route}`} />
        <meta property="og:image" content={ogImage} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        {description && (
          <meta name="twitter:description" content={description} />
        )}
        <meta name="twitter:image" content={ogImage} />
      </>
    );
  },
  sidebar: {
    defaultMenuCollapseLevel: 2,
  },
  components: {
    PropertiesTable: PropertiesTable as any,
    OperatorsTable: OperatorsTable as any,
  },
  toc: {
    title: "On This Page",
    component: TableOfContents,
  },
  footer: {
    component: null,
  },
  banner: {
    key: "beta-release",
    content: (
      <a href="https://nextra.site" target="_blank">
        🎉 Mastra is in beta. Read more →
      </a>
    ),
  },
};

export default docs;
