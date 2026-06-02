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

  it("unwraps the MCP envelope and decodes real newlines (regression: totalLines=1)", () => {
    // Upstream returns its MCP envelope serialized as JSON, with the {status,source}
    // JSON nested inside content[].text. The bug left escaped "\n" literals in place.
    const src = Array.from({ length: 2000 }, (_, i) => `  WRITE: / ${i}.`).join("\n");
    const inner = JSON.stringify({ status: "success", source: src });
    const envelope = JSON.stringify({ content: [{ type: "text", text: inner }] });
    const out = extractSourceField(envelope);
    expect(out).toBe(src);
    expect(out.includes("\n")).toBe(true);
    expect(out.split("\n").length).toBe(2000);
  });
});
