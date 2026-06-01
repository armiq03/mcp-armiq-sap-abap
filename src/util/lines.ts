/**
 * Split text into lines, tolerant of any common line ending: LF (\n), CRLF (\r\n), or CR (\r).
 * ABAP/ADT sources arrive with \r\n on most systems and need consistent handling.
 */
export function splitLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/);
}
