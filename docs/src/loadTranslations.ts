export default async function loadTranslations(locale: string) {
  const translations = await import(`../i18n/locales/${locale}.json`);
  return translations.default;
}
