"use client";
import { useThemeConfig } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { useEffect, useState } from "react";

const useThemeDetector = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Initial check
    setIsDark(document.documentElement.classList.contains("dark"));

    // Create observer to watch for class changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          setIsDark(document.documentElement.classList.contains("dark"));
        }
      });
    });

    // Start observing
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return isDark;
};

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
