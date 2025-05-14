export function getSearchPlaceholder(locale: string) {
  switch (locale) {
    case "ja":
      // TODO: update this to `search or ask AI..` cc @kenny
      return "ドキュメントを検索してください…";
    default:
      return "Search or ask AI...";
  }
}
