export function getSearchPlaceholder(locale: string) {
  switch (locale) {
    case "ja":
      return "ドキュメントを検索...";
    default:
      return "Search docs...";
  }
}
