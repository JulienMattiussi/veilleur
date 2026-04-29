export const config = {
  ignoredDomains: [
    "discord.com",
    "discord.gg",
    "tenor.com",
    "giphy.com",
    "klipy.com",
    "media.discordapp.net",
    "cdn.discordapp.com",
  ],
  discord: {
    apiBase: "https://discord.com/api/v10",
    // Max pages fetched per /veille run (1 page = 100 messages)
    maxPages: 5,
    // Delay between paginated requests to stay under Discord rate limits (ms)
    pageDelayMs: 400,
    // Max retries on 429 Too Many Requests
    rateLimitRetries: 3,
  },
  report: {
    // Links per page (Discord message pagination)
    linksPerPage: 15,
    // Max links selectable for the curated list
    maxSelectedLinks: 6,
    // Discord message character limit (hard cap: 2000, we stay under)
    maxMessageLength: 1900,
    // Cache TTL in seconds
    cacheTtlSeconds: 60 * 60 * 6, // 6 hours
  },
};
