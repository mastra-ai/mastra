export function getSearchPlaceholder(locale: string) {
  switch (locale) {
    case "ja":
      return "検索するかAIに尋ねる...";
    default:
      return "Search or ask AI...";
  }
}
