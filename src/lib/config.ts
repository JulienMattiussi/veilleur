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
  stats: {
    // Max pages fetched per /stats run (1 page = 100 messages, ~0.5 s per page)
    maxPages: 50,
    // Period length when no start date is given
    defaultDays: 30,
    // Time zone used to interpret the dates typed by users
    timeZone: "Europe/Paris",
    // Number of entries in the top authors / top domains rankings
    topCount: 10,
    // Max length of the message excerpt shown in the list
    excerptLength: 160,
  },
};
