import React from "react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { useAlternatePageUtils } from "@docusaurus/theme-common/internal";
import { useLocaleSelector } from "gt-react";

/*
This component is used to display a language selector in the navbar.
It uses locales from the Docusaurus i18n configuration and the gt-react library
to display each locale's native name. Leaving simple styling so it can be easily overridden.
*/
export default function LocaleControl() {
  const { i18n } = useDocusaurusContext();
  const { createUrl } = useAlternatePageUtils();
  const { getLocaleProperties } = useLocaleSelector();

  if (!i18n) return null;
  const docusaurusLocale = i18n.currentLocale;

  const { locales } = i18n;
  if (!locales?.length) return null;

  const onChange = (next: string) => {
    // Use Docusaurus helper to compute the proper alternate locale URL
    const url = createUrl({ locale: next, fullyQualified: false });
    window.location.href = url;
  };

  return (
    <select
      value={docusaurusLocale || ""}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Change language"
      className="navbar__item"
    >
      {locales.map((loc) => {
        // Return the native name for the locale
        const props = getLocaleProperties(loc);
        return (
          <option key={loc} value={loc}>
            {props.nativeNameWithRegionCode}
          </option>
        );
      })}
    </select>
  );
}
