export default async function loadTranslations(locale: string) {
  const translations = await import(`../public/locales/${locale}.json`);
  return translations.default;
}
