// src/browser.ts
function inBrowser() {
  return typeof window !== "undefined";
}
var botAgents = [
  "bot",
  "spider",
  "crawl",
  "APIs-Google",
  "AdsBot",
  "Googlebot",
  "mediapartners",
  "Google Favicon",
  "FeedFetcher",
  "Google-Read-Aloud",
  "DuplexWeb-Google",
  "googleweblight",
  "bing",
  "yandex",
  "baidu",
  "duckduck",
  "yahoo",
  "ecosia",
  "ia_archiver",
  "facebook",
  "instagram",
  "pinterest",
  "reddit",
  "slack",
  "twitter",
  "whatsapp",
  "youtube",
  "semrush"
];
var botAgentRegex = new RegExp(botAgents.join("|"), "i");
function userAgentIsRobot(userAgent) {
  return !userAgent ? false : botAgentRegex.test(userAgent);
}
function isValidBrowser() {
  const navigator = inBrowser() ? window?.navigator : null;
  if (!navigator) {
    return false;
  }
  return !userAgentIsRobot(navigator?.userAgent) && !navigator?.webdriver;
}
function isBrowserOnline() {
  const navigator = inBrowser() ? window?.navigator : null;
  if (!navigator) {
    return false;
  }
  const isNavigatorOnline = navigator?.onLine;
  const isExperimentalConnectionOnline = navigator?.connection?.rtt !== 0 && navigator?.connection?.downlink !== 0;
  return isExperimentalConnectionOnline && isNavigatorOnline;
}
function isValidBrowserOnline() {
  return isBrowserOnline() && isValidBrowser();
}

export {
  inBrowser,
  userAgentIsRobot,
  isValidBrowser,
  isBrowserOnline,
  isValidBrowserOnline
};
//# sourceMappingURL=chunk-JKSAJ6AV.mjs.map