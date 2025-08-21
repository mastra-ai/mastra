"use client";
import { SWRConfig } from "swr";

export const MyProvider = ({ children }: { children: React.ReactNode }) => {
  return <SWRConfig>{children}</SWRConfig>;
};
