import { create } from "zustand";

export type MessageUtilsState = {
  readonly isCopied: boolean;
  readonly setIsCopied: (value: boolean) => void;

  readonly isHovering: boolean;
  readonly setIsHovering: (value: boolean) => void;
};

export const makeMessageUtilsStore = () =>
  create<MessageUtilsState>((set) => {
    return {
      isCopied: false,
      setIsCopied: (value) => {
        set({ isCopied: value });
      },
      isHovering: false,
      setIsHovering: (value) => {
        set({ isHovering: value });
      },
    };
  });
