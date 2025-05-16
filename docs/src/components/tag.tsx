"use client";
import { cn } from "@/lib/utils";
import { useThemeDetector } from "@/hooks/use-theme-detector";

type TagProps = {
  children: React.ReactNode;
} & (
  | {
      text: "new";
      showAbbr?: boolean;
    }
  | {
      text: "experimental" | "advanced" | "realtime";
      showAbbr?: true;
    }
);

export const Tag = ({ children, text, showAbbr }: TagProps) => {
  const isDark = useThemeDetector();

  // Set default showAbbr based on text type
  const defaultShowAbbr =
    text === "experimental" || text === "advanced" || text === "realtime";
  const finalShowAbbr = showAbbr ?? defaultShowAbbr;

  const tags = [
    {
      name: "new",
      abbr: "new",
      color: {
        light: {
          bg: "bg-[hsla(0,0%,93%,1)]",
          text: "text-[hsla(var(--tag-green-light),1)]",
        },
        dark: {
          bg: "bg-[hsla(var(--tag-green),0.06)]",
          text: "text-[hsla(var(--tag-green),1)]",
        },
      },
    },
    {
      name: "experimental",
      abbr: "exp.",
      color: {
        light: {
          bg: "bg-[hsla(0,0%,93%,1)]",
          text: "text-[hsla(var(--tag-purple-light),1)]",
        },
        dark: {
          bg: "bg-[hsla(var(--tag-purple),0.06)]",
          text: "text-[hsla(var(--tag-purple),1)]",
        },
      },
    },
    {
      name: "realtime",
      abbr: "rt.",
      color: {
        light: {
          bg: "bg-[hsla(0,0%,93%,1)]",
          text: "text-[hsla(var(--tag-green-light),1)]",
        },
        dark: {
          bg: "bg-[hsla(var(--tag-green),0.06)]",
          text: "text-[hsla(var(--tag-green),1)]",
        },
      },
    },
    {
      name: "advanced",
      abbr: "adv.",
      color: {
        light: {
          bg: "bg-[hsla(0,0%,93%,1)]",
          text: "text-[hsla(var(--tag-blue-light),1)]",
        },
        dark: {
          bg: "bg-[hsla(var(--tag-blue),0.06)]",
          text: "text-[hsla(var(--tag-blue),1)]",
        },
      },
    },
  ];
  const tag = tags.find((t) => t.name === text);
  const theme = isDark ? "dark" : "light";

  return (
    <span className="flex items-center gap-[0.62rem]">
      {children}
      <span
        className={cn(
          `m-tag font-medium text-xs shrink-0 px-2 pr-[0.44rem] py-0.5 rounded-md`,
          tag?.color[theme].bg,
          tag?.color[theme].text,
        )}
      >
        {finalShowAbbr ? tag?.abbr : text}
      </span>
    </span>
  );
};
