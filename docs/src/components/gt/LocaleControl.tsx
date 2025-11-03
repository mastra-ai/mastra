import { useAlternatePageUtils } from "@docusaurus/theme-common/internal";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@site/src/components/ui/select";
import { useLocaleSelector } from "gt-react";

/*
This component is used to display a language selector in the navbar.
It uses locales from the Docusaurus i18n configuration and the gt-react library
to display each locale's native name. Leaving simple styling so it can be easily overridden.
*/
export default function LocaleControl({ className, size = "default" }: { className: string, size?: "sm" | "default"}) {
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

  // Get the current locale's native name for display
  const currentLocaleProps = getLocaleProperties(docusaurusLocale);

  return (
    <Select value={docusaurusLocale || ""} onValueChange={onChange}>
      <SelectTrigger aria-label="Change language" size={size} className={className}>
        <SelectValue>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" 
          ><path fill="currentColor" d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"></path></svg>
          {currentLocaleProps.nativeNameWithRegionCode}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {locales.map((loc) => {
          // Return the native name for the locale
          const props = getLocaleProperties(loc);
          return (
            <SelectItem key={loc} value={loc}>
              {props.nativeNameWithRegionCode}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
