"use client";

import { ComponentType, type FC } from "react";
import type { SyntaxHighlighterProps as SHP } from "react-syntax-highlighter";
import type { SyntaxHighlighterProps } from "@assistant-ui/react-markdown";

export const makeMakeSyntaxHighlighter =
  (SyntaxHighlighter: ComponentType<SHP>) =>
  (config: Omit<SHP, "language" | "children">) => {
    const PrismSyntaxHighlighter: FC<SyntaxHighlighterProps> = ({
      components: { Pre, Code },
      language,
      code,
    }) => {
      return (
        <SyntaxHighlighter
          PreTag={Pre}
          CodeTag={Code}
          {...config}
          language={language}
        >
          {code}
        </SyntaxHighlighter>
      );
    };

    PrismSyntaxHighlighter.displayName = "PrismSyntaxHighlighter";

    return PrismSyntaxHighlighter;
  };
