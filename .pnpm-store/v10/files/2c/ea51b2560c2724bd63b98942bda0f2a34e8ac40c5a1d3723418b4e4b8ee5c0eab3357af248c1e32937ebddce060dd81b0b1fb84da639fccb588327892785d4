"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/oauth.ts
var oauth_exports = {};
__export(oauth_exports, {
  OAUTH_PROVIDERS: () => OAUTH_PROVIDERS,
  getOAuthProviderData: () => getOAuthProviderData
});
module.exports = __toCommonJS(oauth_exports);
var OAUTH_PROVIDERS = [
  {
    provider: "google",
    strategy: "oauth_google",
    name: "Google",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/google"
  },
  {
    provider: "discord",
    strategy: "oauth_discord",
    name: "Discord",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/discord"
  },
  {
    provider: "facebook",
    strategy: "oauth_facebook",
    name: "Facebook",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/facebook"
  },
  {
    provider: "twitch",
    strategy: "oauth_twitch",
    name: "Twitch",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/twitch"
  },
  {
    provider: "twitter",
    strategy: "oauth_twitter",
    name: "Twitter",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/twitter"
  },
  {
    provider: "microsoft",
    strategy: "oauth_microsoft",
    name: "Microsoft",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/microsoft"
  },
  {
    provider: "tiktok",
    strategy: "oauth_tiktok",
    name: "TikTok",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/tiktok"
  },
  {
    provider: "linkedin",
    strategy: "oauth_linkedin",
    name: "LinkedIn",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/linkedin"
  },
  {
    provider: "linkedin_oidc",
    strategy: "oauth_linkedin_oidc",
    name: "LinkedIn",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/linkedin-oidc"
  },
  {
    provider: "github",
    strategy: "oauth_github",
    name: "GitHub",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/github"
  },
  {
    provider: "gitlab",
    strategy: "oauth_gitlab",
    name: "GitLab",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/gitlab"
  },
  {
    provider: "dropbox",
    strategy: "oauth_dropbox",
    name: "Dropbox",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/dropbox"
  },
  {
    provider: "atlassian",
    strategy: "oauth_atlassian",
    name: "Atlassian",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/atlassian"
  },
  {
    provider: "bitbucket",
    strategy: "oauth_bitbucket",
    name: "Bitbucket",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/bitbucket"
  },
  {
    provider: "hubspot",
    strategy: "oauth_hubspot",
    name: "HubSpot",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/hubspot"
  },
  {
    provider: "notion",
    strategy: "oauth_notion",
    name: "Notion",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/notion"
  },
  {
    provider: "apple",
    strategy: "oauth_apple",
    name: "Apple",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/apple"
  },
  {
    provider: "line",
    strategy: "oauth_line",
    name: "LINE",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/line"
  },
  {
    provider: "instagram",
    strategy: "oauth_instagram",
    name: "Instagram",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/instagram"
  },
  {
    provider: "coinbase",
    strategy: "oauth_coinbase",
    name: "Coinbase",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/coinbase"
  },
  {
    provider: "spotify",
    strategy: "oauth_spotify",
    name: "Spotify",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/spotify"
  },
  {
    provider: "xero",
    strategy: "oauth_xero",
    name: "Xero",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/xero"
  },
  {
    provider: "box",
    strategy: "oauth_box",
    name: "Box",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/box"
  },
  {
    provider: "slack",
    strategy: "oauth_slack",
    name: "Slack",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/slack"
  },
  {
    provider: "linear",
    strategy: "oauth_linear",
    name: "Linear",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/linear"
  },
  {
    provider: "x",
    strategy: "oauth_x",
    name: "X / Twitter",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/x-twitter-v2"
  },
  {
    provider: "enstall",
    strategy: "oauth_enstall",
    name: "Enstall",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/enstall"
  },
  {
    provider: "huggingface",
    strategy: "oauth_huggingface",
    name: "Hugging Face",
    docsUrl: "https://clerk.com/docs/authentication/social-connections/huggingface"
  }
];
function getOAuthProviderData({
  provider,
  strategy
}) {
  if (provider) {
    return OAUTH_PROVIDERS.find((oauth_provider) => oauth_provider.provider == provider);
  }
  return OAUTH_PROVIDERS.find((oauth_provider) => oauth_provider.strategy == strategy);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  OAUTH_PROVIDERS,
  getOAuthProviderData
});
//# sourceMappingURL=oauth.js.map