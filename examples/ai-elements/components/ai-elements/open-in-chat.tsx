import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ChevronDownIcon,
  ExternalLinkIcon,
  MessageCircleIcon,
} from "lucide-react";
import { type ComponentProps, createContext, useContext } from "react";

const providers = {
  github: {
    title: "Open in GitHub",
    createUrl: (url: string) => url,
    icon: (
      <svg fill="currentColor" role="img" viewBox="0 0 24 24">
        <title>GitHub</title>
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    ),
  },
  scira: {
    title: "Open in Scira",
    createUrl: (q: string) =>
      `https://scira.ai/?${new URLSearchParams({
        q,
      })}`,
    icon: (
      <svg
        fill="none"
        height="934"
        viewBox="0 0 910 934"
        width="910"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>Scira AI</title>
        <path
          d="M647.664 197.775C569.13 189.049 525.5 145.419 516.774 66.8849C508.048 145.419 464.418 189.049 385.884 197.775C464.418 206.501 508.048 250.131 516.774 328.665C525.5 250.131 569.13 206.501 647.664 197.775Z"
          fill="currentColor"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="8"
        />
        <path
          d="M516.774 304.217C510.299 275.491 498.208 252.087 480.335 234.214C462.462 216.341 439.058 204.251 410.333 197.775C439.059 191.3 462.462 179.209 480.335 161.336C498.208 143.463 510.299 120.06 516.774 91.334C523.25 120.059 535.34 143.463 553.213 161.336C571.086 179.209 594.49 191.3 623.216 197.775C594.49 204.251 571.086 216.341 553.213 234.214C535.34 252.087 523.25 275.491 516.774 304.217Z"
          fill="currentColor"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="8"
        />
        <path
          d="M857.5 508.116C763.259 497.644 710.903 445.288 700.432 351.047C689.961 445.288 637.605 497.644 543.364 508.116C637.605 518.587 689.961 570.943 700.432 665.184C710.903 570.943 763.259 518.587 857.5 508.116Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="20"
        />
        <path
          d="M700.432 615.957C691.848 589.05 678.575 566.357 660.383 548.165C642.191 529.973 619.499 516.7 592.593 508.116C619.499 499.533 642.191 486.258 660.383 468.066C678.575 449.874 691.848 427.181 700.432 400.274C709.015 427.181 722.289 449.874 740.481 468.066C758.673 486.258 781.365 499.533 808.271 508.116C781.365 516.7 758.673 529.973 740.481 548.165C722.289 566.357 709.015 589.05 700.432 615.957Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="20"
        />
        <path
          d="M889.949 121.237C831.049 114.692 798.326 81.9698 791.782 23.0692C785.237 81.9698 752.515 114.692 693.614 121.237C752.515 127.781 785.237 160.504 791.782 219.404C798.326 160.504 831.049 127.781 889.949 121.237Z"
          fill="currentColor"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="8"
        />
        <path
          d="M791.782 196.795C786.697 176.937 777.869 160.567 765.16 147.858C752.452 135.15 736.082 126.322 716.226 121.237C736.082 116.152 752.452 107.324 765.16 94.6152C777.869 81.9065 786.697 65.5368 791.782 45.6797C796.867 65.5367 805.695 81.9066 818.403 94.6152C831.112 107.324 847.481 116.152 867.338 121.237C847.481 126.322 831.112 135.15 818.403 147.858C805.694 160.567 796.867 176.937 791.782 196.795Z"
          fill="currentColor"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="8"
        />
        <path
          d="M760.632 764.337C720.719 814.616 669.835 855.1 611.872 882.692C553.91 910.285 490.404 924.255 426.213 923.533C362.022 922.812 298.846 907.419 241.518 878.531C184.19 849.643 134.228 808.026 95.4548 756.863C56.6815 705.7 30.1238 646.346 17.8129 583.343C5.50207 520.339 7.76433 455.354 24.4266 393.359C41.089 331.364 71.7099 274.001 113.947 225.658C156.184 177.315 208.919 139.273 268.117 114.442"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="30"
        />
      </svg>
    ),
  },
  chatgpt: {
    title: "Open in ChatGPT",
    createUrl: (prompt: string) =>
      `https://chatgpt.com/?${new URLSearchParams({
        hints: "search",
        prompt,
      })}`,
    icon: (
      <svg
        fill="currentColor"
        role="img"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>OpenAI</title>
        <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
      </svg>
    ),
  },
  claude: {
    title: "Open in Claude",
    createUrl: (q: string) =>
      `https://claude.ai/new?${new URLSearchParams({
        q,
      })}`,
    icon: (
      <svg
        fill="currentColor"
        role="img"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>Anthropic</title>
        <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
      </svg>
    ),
  },
  t3: {
    title: "Open in T3 Chat",
    createUrl: (q: string) =>
      `https://t3.chat/new?${new URLSearchParams({
        q,
      })}`,
    icon: <MessageCircleIcon />,
  },
  v0: {
    title: "Open in V0",
    createUrl: (q: string) =>
      `https://v0.app?${new URLSearchParams({
        q,
      })}`,
    icon: (
      <svg
        fill="currentColor"
        viewBox="0 0 147 70"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>V0</title>
        <path d="M56 50.2031V14H70V60.1562C70 65.5928 65.5928 70 60.1562 70C57.5605 70 54.9982 68.9992 53.1562 67.1573L0 14H19.7969L56 50.2031Z" />
        <path d="M147 56H133V23.9531L100.953 56H133V70H96.6875C85.8144 70 77 61.1856 77 50.3125V14H91V46.1562L123.156 14H91V0H127.312C138.186 0 147 8.81439 147 19.6875V56Z" />
      </svg>
    ),
  },
};

const OpenInContext = createContext<{ query: string } | undefined>(undefined);

const useOpenInContext = () => {
  const context = useContext(OpenInContext);
  if (!context) {
    throw new Error("OpenIn components must be used within an OpenIn provider");
  }
  return context;
};

export type OpenInProps = ComponentProps<typeof DropdownMenu> & {
  query: string;
};

export const OpenIn = ({ query, ...props }: OpenInProps) => (
  <OpenInContext.Provider value={{ query }}>
    <DropdownMenu {...props} />
  </OpenInContext.Provider>
);

export type OpenInContentProps = ComponentProps<typeof DropdownMenuContent>;

export const OpenInContent = ({ className, ...props }: OpenInContentProps) => (
  <DropdownMenuContent
    align="start"
    className={cn("w-[240px]", className)}
    {...props}
  />
);

export type OpenInItemProps = ComponentProps<typeof DropdownMenuItem>;

export const OpenInItem = (props: OpenInItemProps) => (
  <DropdownMenuItem {...props} />
);

export type OpenInLabelProps = ComponentProps<typeof DropdownMenuLabel>;

export const OpenInLabel = (props: OpenInLabelProps) => (
  <DropdownMenuLabel {...props} />
);

export type OpenInSeparatorProps = ComponentProps<typeof DropdownMenuSeparator>;

export const OpenInSeparator = (props: OpenInSeparatorProps) => (
  <DropdownMenuSeparator {...props} />
);

export type OpenInTriggerProps = ComponentProps<typeof DropdownMenuTrigger>;

export const OpenInTrigger = ({ children, ...props }: OpenInTriggerProps) => (
  <DropdownMenuTrigger {...props} asChild>
    {children ?? (
      <Button type="button" variant="outline">
        Open in chat
        <ChevronDownIcon className="ml-2 size-4" />
      </Button>
    )}
  </DropdownMenuTrigger>
);

export type OpenInChatGPTProps = ComponentProps<typeof DropdownMenuItem>;

export const OpenInChatGPT = (props: OpenInChatGPTProps) => {
  const { query } = useOpenInContext();
  return (
    <DropdownMenuItem asChild {...props}>
      <a
        className="flex items-center gap-2"
        href={providers.chatgpt.createUrl(query)}
        rel="noopener"
        target="_blank"
      >
        <span className="shrink-0">{providers.chatgpt.icon}</span>
        <span className="flex-1">{providers.chatgpt.title}</span>
        <ExternalLinkIcon className="size-4 shrink-0" />
      </a>
    </DropdownMenuItem>
  );
};

export type OpenInClaudeProps = ComponentProps<typeof DropdownMenuItem>;

export const OpenInClaude = (props: OpenInClaudeProps) => {
  const { query } = useOpenInContext();
  return (
    <DropdownMenuItem asChild {...props}>
      <a
        className="flex items-center gap-2"
        href={providers.claude.createUrl(query)}
        rel="noopener"
        target="_blank"
      >
        <span className="shrink-0">{providers.claude.icon}</span>
        <span className="flex-1">{providers.claude.title}</span>
        <ExternalLinkIcon className="size-4 shrink-0" />
      </a>
    </DropdownMenuItem>
  );
};

export type OpenInT3Props = ComponentProps<typeof DropdownMenuItem>;

export const OpenInT3 = (props: OpenInT3Props) => {
  const { query } = useOpenInContext();
  return (
    <DropdownMenuItem asChild {...props}>
      <a
        className="flex items-center gap-2"
        href={providers.t3.createUrl(query)}
        rel="noopener"
        target="_blank"
      >
        <span className="shrink-0">{providers.t3.icon}</span>
        <span className="flex-1">{providers.t3.title}</span>
        <ExternalLinkIcon className="size-4 shrink-0" />
      </a>
    </DropdownMenuItem>
  );
};

export type OpenInSciraProps = ComponentProps<typeof DropdownMenuItem>;

export const OpenInScira = (props: OpenInSciraProps) => {
  const { query } = useOpenInContext();
  return (
    <DropdownMenuItem asChild {...props}>
      <a
        className="flex items-center gap-2"
        href={providers.scira.createUrl(query)}
        rel="noopener"
        target="_blank"
      >
        <span className="shrink-0">{providers.scira.icon}</span>
        <span className="flex-1">{providers.scira.title}</span>
        <ExternalLinkIcon className="size-4 shrink-0" />
      </a>
    </DropdownMenuItem>
  );
};

export type OpenInv0Props = ComponentProps<typeof DropdownMenuItem>;

export const OpenInv0 = (props: OpenInv0Props) => {
  const { query } = useOpenInContext();
  return (
    <DropdownMenuItem asChild {...props}>
      <a
        className="flex items-center gap-2"
        href={providers.v0.createUrl(query)}
        rel="noopener"
        target="_blank"
      >
        <span className="shrink-0">{providers.v0.icon}</span>
        <span className="flex-1">{providers.v0.title}</span>
        <ExternalLinkIcon className="size-4 shrink-0" />
      </a>
    </DropdownMenuItem>
  );
};
