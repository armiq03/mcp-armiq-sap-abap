import { describe, expect, it } from "vitest";
import { splitLines } from "../src/util/lines.js";

describe("splitLines", () => {
  it("handles LF", () => {
    expect(splitLines("a\nb\nc")).toEqual(["a", "b", "c"]);
  });
  it("handles CRLF (most common for ABAP/ADT)", () => {
    expect(splitLines("a\r\nb\r\nc")).toEqual(["a", "b", "c"]);
  });
  it("handles bare CR", () => {
    expect(splitLines("a\rb\rc")).toEqual(["a", "b", "c"]);
  });
  it("handles mixed endings", () => {
    expect(splitLines("a\nb\r\nc\rd")).toEqual(["a", "b", "c", "d"]);
  });
  it("empty string returns single empty line", () => {
    expect(splitLines("")).toEqual([""]);
  });
});
