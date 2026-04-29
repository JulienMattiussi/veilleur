import { describe, it, expect } from "vitest";
import { extractLinks } from "@/lib/link-extractor";
import type { DiscordMessage } from "@/lib/discord";

function makeMessage(content: string, id = "1"): DiscordMessage {
  return { id, content, timestamp: "2024-01-01T00:00:00.000Z", author: { username: "testuser" } };
}

describe("extractLinks", () => {
  it("extracts a plain URL from message content", () => {
    const links = extractLinks([makeMessage("Check this out: https://example.com/article")]);
    expect(links).toHaveLength(1);
    expect(links[0]!.url).toBe("https://example.com/article");
  });

  it("captures the message text as context", () => {
    const links = extractLinks([makeMessage("Great article on Rust: https://example.com")]);
    expect(links[0]!.context).toBe("Great article on Rust:");
  });

  it("returns empty context when message has only a URL", () => {
    const links = extractLinks([makeMessage("https://example.com")]);
    expect(links[0]!.context).toBe("");
  });

  it("deduplicates identical URLs across messages", () => {
    const msgs = [
      makeMessage("https://example.com", "1"),
      makeMessage("https://example.com", "2"),
    ];
    expect(extractLinks(msgs)).toHaveLength(1);
  });

  it("strips trailing punctuation from URLs", () => {
    const links = extractLinks([makeMessage("See https://example.com/page.")]);
    expect(links[0]!.url).toBe("https://example.com/page");
  });

  it("ignores Discord CDN and tenor URLs", () => {
    const links = extractLinks([
      makeMessage("https://cdn.discordapp.com/attachments/123/file.png"),
      makeMessage("https://tenor.com/view/gif"),
    ]);
    expect(links).toHaveLength(0);
  });

  it("returns author and timestamp from the source message", () => {
    const msg: DiscordMessage = {
      id: "42",
      content: "https://blog.example.com",
      timestamp: "2024-06-01T12:00:00.000Z",
      author: { username: "alice" },
    };
    const [link] = extractLinks([msg]);
    expect(link?.author).toBe("alice");
    expect(link?.timestamp).toBe("2024-06-01T12:00:00.000Z");
  });
});
