---
'@mastra/connect': patch
---

Fixed Discord channel connections failing with `Discord rejected the bot token: 401: Unauthorized`. The Discord bot token is now read from the connection's metadata (`botToken`, following Nango's Discord convention) instead of the OAuth credential — Discord's OAuth exchange only yields a user Bearer token, which can never authenticate as a bot. A Discord connection without `botToken` metadata is skipped with a warning telling you to store the token on the connection.
