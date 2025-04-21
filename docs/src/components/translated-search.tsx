"use client";
import { Search } from "nextra/components";
import { useGT } from "gt-next/client";

export const TranslatedSearch = () => {
  const t = useGT();
  return <Search placeholder={t("Search documentation...")} />;
};
