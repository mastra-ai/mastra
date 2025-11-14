import clsx from "clsx";
import React, { type ReactNode } from "react";

import type { Props } from "@theme/Admonition/Layout";

import { cn } from "@site/src/css/utils";
import {
  GithubTipIcon,
  GithubCautionIcon,
  GithubNoteIcon,
  GithubWarningIcon,
  GithubImportantIcon,
} from "../icons";

const TypeToEmoji = {
  note: <GithubTipIcon />,
  danger: <GithubCautionIcon />,
  info: <GithubNoteIcon />,
  warning: <GithubWarningIcon />,
  tip: <GithubImportantIcon />,
};

type CalloutType = keyof typeof TypeToEmoji;

const classes: Record<CalloutType, string> = {
  note: cn(
    "bg-green-100/50 dark:bg-green-900/30",
    "text-green-700 dark:text-green-500",
    "border-green-200 dark:border-green-800",
  ),
  danger: cn(
    "bg-red-100 dark:bg-red-900/30",
    "text-red-700 dark:text-red-500",
    "border-red-200 dark:border-red-600",
  ),
  info: cn(
    "bg-blue-50 dark:bg-blue-900/30",
    "text-blue-700 dark:text-blue-400",
    "border-blue-100 dark:border-blue-600",
  ),
  warning: cn(
    "bg-yellow-50 dark:bg-yellow-600/30",
    "text-yellow-700 dark:text-yellow-500",
    "border-yellow-200 dark:border-yellow-600",
  ),
  tip: cn(
    "bg-purple-100 dark:bg-purple-900/30",
    "text-purple-600 dark:text-purple-400",
    "border-purple-200 dark:border-purple-600",
  ),
};

function AdmonitionContainer({
  type,
  className,
  children,
}: Pick<Props, "type" | "className"> & { children: ReactNode }) {
  return (
    <div
      className={clsx(
        "mb-4 rounded-[12px] border border-(--border) flex flex-col gap-2 p-4 px-5",
        classes[type],
        className,
      )}
    >
      {children}
    </div>
  );
}

function AdmonitionIconType({ title, type }: Pick<Props, "title" | "type">) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 size-4">{TypeToEmoji[type]}</span>
      {title ? (
        <span className="text-[15px] font-mono font-semibold tracking-tight capitalize">
          {title}
        </span>
      ) : null}
    </div>
  );
}

function AdmonitionContent({ children }: Pick<Props, "children">) {
  return children ? (
    <div className="[&>p]:!mb-1 [&>:last-child]:!mb-0 text-sm">{children}</div>
  ) : null;
}

export default function AdmonitionLayout(props: Props): ReactNode {
  const { type, icon, children, title } = props;
  return (
    <AdmonitionContainer type={type} className={cn("", classes[type])}>
      {icon ? <AdmonitionIconType title={title} type={type} /> : null}
      <AdmonitionContent>{children}</AdmonitionContent>
    </AdmonitionContainer>
  );
}
