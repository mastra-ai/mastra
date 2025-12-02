"use client";

import { useState } from "react";

namespace useCopyToClipboard {
  export interface Options {
    copiedDuration?: number;
  }
}

export const useCopyToClipboard = ({
  copiedDuration = 3000,
}: useCopyToClipboard.Options = {}) => {
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const copyToClipboard = (value: string) => {
    if (!value) return;

    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), copiedDuration);
    });
  };

  return { isCopied, copyToClipboard };
};
