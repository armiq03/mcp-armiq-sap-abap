import { describe, expect, it } from "vitest";
import { SourceCache } from "../src/cache/source-cache.js";

describe("SourceCache", () => {
  it("returns undefined when key missing", () => {
    const c = new SourceCache();
    expect(c.get("absent")).toBeUndefined();
  });

  it("stores and retrieves a value", () => {
    const c = new SourceCache();
    c.set("k", "value");
    expect(c.get("k")).toBe("value");
    expect(c.size()).toBe(1);
  });

  it("expires after TTL", async () => {
    const c = new SourceCache(20); // 20ms
    c.set("k", "value");
    await new Promise((r) => setTimeout(r, 40));
    expect(c.get("k")).toBeUndefined();
  });

  it("invalidate removes entry", () => {
    const c = new SourceCache();
    c.set("k", "v");
    c.invalidate("k");
    expect(c.get("k")).toBeUndefined();
  });

  it("clear removes everything", () => {
    const c = new SourceCache();
    c.set("a", "1");
    c.set("b", "2");
    c.clear();
    expect(c.size()).toBe(0);
  });
});
