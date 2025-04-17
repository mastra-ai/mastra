export function getSearchPlaceholder(locale: string) {
  switch (locale) {
    case "ja":
      return "ドキュメントを検索してください…";
    default:
      return "Search docs";
  }
}
