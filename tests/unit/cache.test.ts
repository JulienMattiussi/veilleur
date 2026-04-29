import { describe, it, expect, beforeEach } from "vitest";
import { getCachedReport, setCachedReport, getBasket, setBasket, clearBasket } from "@/lib/cache";

beforeEach(() => {
  global._localStore = undefined;
});

const report = {
  channelId: "ch1",
  period: "7j",
  generatedAt: "2024-04-01T00:00:00.000Z",
  links: [],
};

describe("getCachedReport / setCachedReport", () => {
  it("returns null when nothing is cached", async () => {
    expect(await getCachedReport("ch1", "7j")).toBeNull();
  });

  it("returns the stored report", async () => {
    await setCachedReport(report);
    const result = await getCachedReport("ch1", "7j");
    expect(result?.channelId).toBe("ch1");
    expect(result?.period).toBe("7j");
  });

  it("is keyed by channelId + period", async () => {
    await setCachedReport(report);
    expect(await getCachedReport("ch1", "30j")).toBeNull();
    expect(await getCachedReport("ch2", "7j")).toBeNull();
  });
});

describe("getBasket / setBasket / clearBasket", () => {
  it("returns empty array when no basket exists", async () => {
    expect(await getBasket("ch1", "7j", "user1")).toEqual([]);
  });

  it("stores and retrieves indices", async () => {
    await setBasket("ch1", "7j", "user1", [0, 3, 7]);
    expect(await getBasket("ch1", "7j", "user1")).toEqual([0, 3, 7]);
  });

  it("is keyed by userId - different users have independent baskets", async () => {
    await setBasket("ch1", "7j", "user1", [1, 2]);
    expect(await getBasket("ch1", "7j", "user2")).toEqual([]);
  });

  it("clearBasket removes the stored indices", async () => {
    await setBasket("ch1", "7j", "user1", [0, 1]);
    await clearBasket("ch1", "7j", "user1");
    expect(await getBasket("ch1", "7j", "user1")).toEqual([]);
  });

  it("setBasket replaces previous value", async () => {
    await setBasket("ch1", "7j", "user1", [0, 1]);
    await setBasket("ch1", "7j", "user1", [5, 6]);
    expect(await getBasket("ch1", "7j", "user1")).toEqual([5, 6]);
  });
});
