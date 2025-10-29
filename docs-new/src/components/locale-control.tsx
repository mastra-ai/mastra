import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { useAlternatePageUtils } from '@docusaurus/theme-common/internal';
import { useLocaleSelector } from 'gt-react';

export default function LocaleControl() {
  const { i18n } = useDocusaurusContext();
  const { createUrl } = useAlternatePageUtils();
  const { locales, getLocaleProperties } = useLocaleSelector();

  if (!i18n) return null;
  const docusaurusLocale = i18n.currentLocale;

  if (!locales?.length) return null;

  const onChange = (next: string) => {
    // Use Docusaurus helper to compute the proper alternate locale URL
    const url = createUrl({ locale: next, fullyQualified: false });
    window.location.href = url;
  };

  return (
    <select
      value={docusaurusLocale || ''}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Change language"
      className="navbar__item"
    >
      {locales.map((loc) => {
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
