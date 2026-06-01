import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the fetcher so we don't hit a real upstream server
vi.mock("../src/upstream/source-fetcher.js", () => {
  return { fetchAbapSource: vi.fn() };
});

import { fetchAbapSource } from "../src/upstream/source-fetcher.js";
import { sourceInfo } from "../src/tools/source-info.js";
import { sourceLines } from "../src/tools/source-lines.js";
import { sourceOutline } from "../src/tools/source-outline.js";
import { sourceSearch } from "../src/tools/source-search.js";

const mockedFetch = fetchAbapSource as unknown as ReturnType<typeof vi.fn>;

const SAMPLE_SOURCE = `REPORT zsample.
CLASS zcl_demo DEFINITION.
  PUBLIC SECTION.
    METHODS init.
    METHODS run.
ENDCLASS.

CLASS zcl_demo IMPLEMENTATION.
  METHOD init.
    DATA lv_x TYPE i VALUE 1.
    SELECT * FROM bkpf INTO TABLE @DATA(lt_bkpf) WHERE bukrs = '1000'.
  ENDMETHOD.
  METHOD run.
    PERFORM authenticate.
    AUTHORITY-CHECK OBJECT 'S_TCODE' ID 'TCD' FIELD 'SE38'.
  ENDMETHOD.
ENDCLASS.

FORM authenticate.
  WRITE 'Authenticated'.
ENDFORM.

INCLUDE zsample_top.
`;

beforeEach(() => {
  mockedFetch.mockReset();
  mockedFetch.mockResolvedValue(SAMPLE_SOURCE);
});

// === source_info ===

describe("source_info", () => {
  it("returns line and char counts", async () => {
    const r = await sourceInfo({ objectUrl: "x" });
    expect(r.status).toBe("success");
    expect(r.totalLines).toBeGreaterThan(15);
    expect(r.totalChars).toBe(SAMPLE_SOURCE.length);
  });

  it("counts structural elements", async () => {
    const r = await sourceInfo({ objectUrl: "x" });
    expect(r.structure.classCount).toBe(2); // DEFINITION + IMPLEMENTATION
    expect(r.structure.methodCount).toBe(2); // METHOD init, METHOD run
    expect(r.structure.formCount).toBe(1);
    expect(r.structure.includeCount).toBe(1);
  });

  it("suggestion mentions chunked tools for large sources", async () => {
    let big = "";
    for (let i = 0; i < 800; i++) big += `WRITE ${i}.\n`;
    mockedFetch.mockResolvedValue(big);
    const r = await sourceInfo({ objectUrl: "big" });
    expect(r.suggestion).toMatch(/source_lines|source_outline|source_search/);
  });

  it("suggestion mentions full read for small sources", async () => {
    mockedFetch.mockResolvedValue("REPORT zfoo.\nWRITE 'hi'.");
    const r = await sourceInfo({ objectUrl: "small" });
    expect(r.suggestion).toMatch(/safe to read fully/i);
  });

  it("counts lines correctly when source uses CRLF (real ABAP/ADT case)", async () => {
    const crlf = "REPORT zfoo.\r\nCLASS zcl_x DEFINITION.\r\nENDCLASS.\r\nFORM x.\r\nENDFORM.";
    mockedFetch.mockResolvedValue(crlf);
    const r = await sourceInfo({ objectUrl: "x" });
    expect(r.totalLines).toBe(5);
    expect(r.structure.classCount).toBe(1);
    expect(r.structure.formCount).toBe(1);
  });
});

// === source_lines ===

describe("source_lines", () => {
  it("returns the requested range", async () => {
    const r = await sourceLines({ objectUrl: "x", fromLine: 1, toLine: 3 });
    expect(r.status).toBe("success");
    expect(r.fromLine).toBe(1);
    expect(r.toLine).toBe(3);
    expect(r.source.split("\n").length).toBe(3);
  });

  it("clamps toLine to total lines", async () => {
    const r = await sourceLines({ objectUrl: "x", fromLine: 1, toLine: 9999 });
    expect(r.toLine).toBe(r.totalLines);
    expect(r.hasMore).toBe(false);
  });

  it("default range is 500 lines", async () => {
    const big = Array.from({ length: 1500 }, (_, i) => `LINE ${i}`).join("\n");
    mockedFetch.mockResolvedValue(big);
    const r = await sourceLines({ objectUrl: "big" });
    expect(r.fromLine).toBe(1);
    expect(r.toLine).toBe(500);
    expect(r.hasMore).toBe(true);
  });

  it("hasMore=true when more content remains", async () => {
    const r = await sourceLines({ objectUrl: "x", fromLine: 1, toLine: 5 });
    expect(r.hasMore).toBe(true);
  });

  it("clamps fromLine to 1", async () => {
    const r = await sourceLines({ objectUrl: "x", fromLine: -10, toLine: 2 });
    expect(r.fromLine).toBe(1);
  });
});

// === source_outline ===

describe("source_outline", () => {
  it("extracts class/method/form/include entries", async () => {
    const r = await sourceOutline({ objectUrl: "x" });
    expect(r.status).toBe("success");
    const types = r.outline.map((e) => e.type);
    expect(types).toContain("class");
    expect(types).toContain("method");
    expect(types).toContain("form");
    expect(types).toContain("include");
    expect(types).toContain("program"); // REPORT
  });

  it("includes correct line numbers", async () => {
    const r = await sourceOutline({ objectUrl: "x" });
    const program = r.outline.find((e) => e.type === "program");
    expect(program?.line).toBe(1);
    const form = r.outline.find((e) => e.type === "form");
    expect(form?.text).toMatch(/^FORM /i);
  });

  it("returns empty outline for plain text", async () => {
    mockedFetch.mockResolvedValue("just\nplain\ntext\nlines.");
    const r = await sourceOutline({ objectUrl: "x" });
    expect(r.outline).toEqual([]);
  });
});

// === source_search ===

describe("source_search", () => {
  it("finds SELECT statements with context", async () => {
    const r = await sourceSearch({ objectUrl: "x", pattern: "SELECT" });
    expect(r.status).toBe("success");
    expect(r.matchCount).toBeGreaterThan(0);
    const m = r.matches[0];
    expect(m.line).toMatch(/SELECT/i);
    expect(m.before.length).toBeLessThanOrEqual(2);
    expect(m.after.length).toBeLessThanOrEqual(2);
  });

  it("is case-insensitive", async () => {
    const r1 = await sourceSearch({ objectUrl: "x", pattern: "select" });
    const r2 = await sourceSearch({ objectUrl: "x", pattern: "SELECT" });
    expect(r1.matchCount).toBe(r2.matchCount);
  });

  it("respects maxMatches and reports truncation", async () => {
    const big = Array.from({ length: 100 }, () => "WRITE 'x'.").join("\n");
    mockedFetch.mockResolvedValue(big);
    const r = await sourceSearch({ objectUrl: "x", pattern: "WRITE", maxMatches: 10 });
    expect(r.matchCount).toBe(10);
    expect(r.truncated).toBe(true);
  });

  it("rejects invalid regex with a clear error", async () => {
    await expect(sourceSearch({ objectUrl: "x", pattern: "([" })).rejects.toThrow(/Invalid regex/);
  });

  it("returns no matches and not truncated when nothing found", async () => {
    const r = await sourceSearch({ objectUrl: "x", pattern: "ZZZZNEVER" });
    expect(r.matchCount).toBe(0);
    expect(r.truncated).toBe(false);
  });

  it("handles AUTHORITY-CHECK pattern (special char)", async () => {
    const r = await sourceSearch({ objectUrl: "x", pattern: "AUTHORITY-CHECK" });
    expect(r.matchCount).toBeGreaterThan(0);
  });

  it("custom contextLines is honored", async () => {
    const r = await sourceSearch({
      objectUrl: "x",
      pattern: "SELECT",
      contextLines: 0,
    });
    expect(r.matches[0].before.length).toBe(0);
    expect(r.matches[0].after.length).toBe(0);
  });
});
