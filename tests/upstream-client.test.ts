import { describe, expect, it } from "vitest";
import { extractSourceField } from "../src/upstream/client.js";

describe("extractSourceField", () => {
  it("extracts source from JSON envelope", () => {
    const raw = JSON.stringify({ status: "success", source: "REPORT zfoo." });
    expect(extractSourceField(raw)).toBe("REPORT zfoo.");
  });

  it("returns raw text if not JSON", () => {
    const raw = "REPORT zfoo. WRITE 'hi'.";
    expect(extractSourceField(raw)).toBe(raw);
  });

  it("returns raw text if JSON has no source field", () => {
    const raw = JSON.stringify({ status: "success", other: "x" });
    expect(extractSourceField(raw)).toBe(raw);
  });

  it("preserves newlines in extracted source", () => {
    const src = "REPORT zfoo.\nWRITE 'hi'.\nENDIF.";
    const raw = JSON.stringify({ status: "success", source: src });
    expect(extractSourceField(raw)).toBe(src);
  });
});
