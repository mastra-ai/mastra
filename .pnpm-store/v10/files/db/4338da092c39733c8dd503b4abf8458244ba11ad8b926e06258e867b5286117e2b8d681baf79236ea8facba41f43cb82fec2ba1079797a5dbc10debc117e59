// src/runtime-values.ts
var WEB3_PROVIDERS = [
  {
    provider: "metamask",
    strategy: "web3_metamask_signature",
    name: "MetaMask"
  },
  {
    provider: "base",
    strategy: "web3_base_signature",
    name: "Base"
  },
  {
    provider: "coinbase_wallet",
    strategy: "web3_coinbase_wallet_signature",
    name: "Coinbase Wallet"
  },
  {
    provider: "okx_wallet",
    strategy: "web3_okx_wallet_signature",
    name: "OKX Wallet"
  }
];
function getWeb3ProviderData(params) {
  const { provider, strategy } = params;
  if (provider) {
    return WEB3_PROVIDERS.find((p) => p.provider == provider);
  }
  return WEB3_PROVIDERS.find((p) => p.strategy == strategy);
}
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
function getOAuthProviderData(params) {
  const { provider, strategy } = params;
  if (provider) {
    return OAUTH_PROVIDERS.find((oauth_provider) => oauth_provider.provider == provider);
  }
  return OAUTH_PROVIDERS.find((oauth_provider) => oauth_provider.strategy == strategy);
}
function sortedOAuthProviders(sortingArray) {
  return OAUTH_PROVIDERS.slice().sort((a, b) => {
    let aPos = sortingArray.indexOf(a.strategy);
    if (aPos == -1) {
      aPos = Number.MAX_SAFE_INTEGER;
    }
    let bPos = sortingArray.indexOf(b.strategy);
    if (bPos == -1) {
      bPos = Number.MAX_SAFE_INTEGER;
    }
    return aPos - bPos;
  });
}
var SAML_IDPS = {
  saml_okta: {
    name: "Okta Workforce",
    logo: "okta"
  },
  saml_google: {
    name: "Google Workspace",
    logo: "google"
  },
  saml_microsoft: {
    name: "Microsoft Entra ID (Formerly AD)",
    logo: "azure"
  },
  saml_custom: {
    name: "SAML",
    logo: "saml"
  }
};
export {
  OAUTH_PROVIDERS,
  SAML_IDPS,
  WEB3_PROVIDERS,
  getOAuthProviderData,
  getWeb3ProviderData,
  sortedOAuthProviders
};
//# sourceMappingURL=index.js.map