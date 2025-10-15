export function getSearchPlaceholder(locale: string) {
  switch (locale) {
    case "ja":
      return "何を探していますか?";
    default:
      return "What are you searching for?";
  }
}
