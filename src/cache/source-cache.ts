/**
 * Lightweight in-process TTL cache for fetched ABAP source bodies.
 *
 * Since multiple tools (info/lines/outline/search) often run on the same object in quick
 * succession, this cache lets us fetch the source from the upstream server once and reuse
 * it across calls within a short window.
 */
interface Entry {
  source: string;
  fetchedAt: number;
}

const DEFAULT_TTL_MS = 60_000;

export class SourceCache {
  private readonly map = new Map<string, Entry>();

  constructor(private readonly ttlMs: number = DEFAULT_TTL_MS) {}

  get(key: string): string | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.fetchedAt > this.ttlMs) {
      this.map.delete(key);
      return undefined;
    }
    return entry.source;
  }

  set(key: string, source: string): void {
    this.map.set(key, { source, fetchedAt: Date.now() });
  }

  invalidate(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }
}

export const sourceCache = new SourceCache();
