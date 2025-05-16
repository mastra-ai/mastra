"use client";
import { useThemeDetector } from "@/hooks/use-theme-detector";
import { Head } from "nextra/components";

export const CustomHead = () => {
  const isDark = useThemeDetector();

  const themeObj = isDark
    ? {
        hue: 143,
        saturation: 97,
        lightness: 54,
      }
    : {
        hue: 125,
        saturation: 66,
        lightness: 50,
      };
  return (
    <Head
      // primary-color
      color={themeObj}
    >
      {/* Your additional tags should be passed as `children` of `<Head>` element */}
    </Head>
  );
};
