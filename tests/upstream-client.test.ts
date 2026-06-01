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

  it("recovers source with real newlines from a TRUNCATED JSON envelope", () => {
    // Regression: large objects arrive truncated, JSON.parse fails. The old code returned
    // the raw JSON (escaped \n literals) -> splitLines saw 1 line. Now we extract + decode.
    const src = Array.from({ length: 2000 }, (_, i) => `  WRITE: / ${i}.`).join("\n");
    const full = JSON.stringify({ status: "success", source: src });
    const truncated = full.slice(0, full.length - 30); // chop the closing quote/brace
    const out = extractSourceField(truncated);
    expect(out.includes("\n")).toBe(true); // real LF, not literal "\\n"
    expect(out.split("\n").length).toBeGreaterThan(1900);
    expect(out.startsWith("  WRITE: / 0.")).toBe(true);
  });
});
