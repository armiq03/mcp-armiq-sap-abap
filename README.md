# mcp-armiq-sap-abap

ABAP source analysis & exploration tools for Model Context Protocol clients.

This server complements [`mcp-abap-abap-adt-api`](https://github.com/marianzeis/mcp-abap-abap-adt-api)
without modifying it. The upstream server handles SAP/ADT communication; this server adds
a layer of analysis and exploration on top — chunked reading, structural outlines, regex
search, and (planned) dependency analysis, code metrics, and more.

## Why a separate server?

- The upstream package is third-party and updates frequently. We don't fork it.
- Analysis logic is pure text processing — no SAP credentials needed beyond what the
  upstream server already uses.
- Any MCP client (Claude Desktop, Eclipse SAP-MCP, IDE plugins, CI pipelines) can register
  both servers side-by-side and benefit from the combined surface.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  MCP client (Claude Desktop / Eclipse SAP-MCP / Cursor / etc.)   │
└──────────────────────────────────────────────────────────────────┘
        │  source_info / source_lines / outline / search
        ▼
┌────────────────────────────┐    ┌────────────────────────────────┐
│  mcp-armiq-sap-abap         │───►│  mcp-abap-abap-adt-api          │
│  (this server, OUR CODE)    │    │  (upstream, unmodified)         │
│  • chunked source reading   │    │  • ADT REST wrapper             │
│  • outline extraction       │    │  • getObjectSource              │
│  • regex search             │    │  • lock/unlock/transport/ATC    │
│  • TTL cache (60s)          │    │                                 │
└────────────────────────────┘    └────────────────────────────────┘
```

The upstream server is spawned automatically as a child process when this server first
needs source data. Both share the parent's environment for SAP credentials.

## Tools

### `source_info`

Returns metadata WITHOUT the source body. Use FIRST before reading large objects.

**Args**: `{ objectUrl: string }`

**Returns**: `{ totalLines, totalChars, structure: { classCount, methodCount, formCount,
functionCount, includeCount }, suggestion }`

### `source_lines`

Reads a specific line range. Default: 500 lines starting from `fromLine`.

**Args**: `{ objectUrl: string, fromLine?: number, toLine?: number }`

**Returns**: `{ source, fromLine, toLine, totalLines, hasMore }`

### `source_outline`

Returns CLASS / INTERFACE / METHOD / FORM / FUNCTION / INCLUDE / PROGRAM declarations
with their line numbers, without method bodies.

**Args**: `{ objectUrl: string }`

**Returns**: `{ totalLines, outline: Array<{ line, type, text }> }`

### `source_search`

Case-insensitive regex search with surrounding context.

**Args**: `{ objectUrl: string, pattern: string, contextLines?: number, maxMatches?: number }`

**Returns**: `{ pattern, totalLines, matchCount, truncated, matches: Array<{ lineNumber,
line, before, after }> }`

## Installation

### Via NPM (planned)

```bash
npm install -g mcp-armiq-sap-abap
```

### From source

```bash
git clone https://github.com/armiq03/mcp-armiq-sap-abap.git
cd mcp-armiq-sap-abap
npm install
npm run build
```

## Client configuration

### Claude Desktop / Cursor

```jsonc
{
  "mcpServers": {
    "abap-data": {
      "command": "npx",
      "args": ["-y", "mcp-abap-abap-adt-api"],
      "env": {
        "SAP_URL": "https://your-sap:44300",
        "SAP_USER": "...",
        "SAP_PASSWORD": "...",
        "SAP_CLIENT": "100",
        "SAP_LANGUAGE": "EN"
      }
    },
    "abap-tools": {
      "command": "npx",
      "args": ["-y", "mcp-armiq-sap-abap"],
      "env": {
        "SAP_URL": "https://your-sap:44300",
        "SAP_USER": "...",
        "SAP_PASSWORD": "...",
        "SAP_CLIENT": "100",
        "SAP_LANGUAGE": "EN"
      }
    }
  }
}
```

### Eclipse SAP-MCP plugin

Add a server template in `ServerTemplates.java` or via the in-app `Add Server` dialog.

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `UPSTREAM_COMMAND` | `npx` | Command used to spawn the upstream server |
| `UPSTREAM_ARGS` | `-y mcp-abap-abap-adt-api` | Args passed to the upstream command |
| `SAP_URL`, `SAP_USER`, `SAP_PASSWORD`, `SAP_CLIENT`, `SAP_LANGUAGE` | — | Forwarded to upstream |

## Development

```bash
npm install
npm run build      # one-shot compile
npm run dev        # tsc --watch
npm test           # vitest run
npm run test:watch # vitest in watch mode
```

The test suite uses Vitest and mocks the upstream fetcher so no SAP connection is needed
to run tests.

## Roadmap

- `dependency_graph` — CALL FUNCTION / PERFORM / class usage map
- `find_callers` / `find_callees` — cross-object reference search
- `code_metrics` — complexity, comment ratio, obsolete statements
- `lint_naming`, `lint_hardcoded_values`, `lint_select_perf`
- `find_authority_check`, `find_dynamic_calls` — security-oriented searches
- `bulk_analyze` — same operation across multiple objects in one call
- Resource URIs for analysis results (`abap://outline/<obj>`)

## License

ARMIQ License — see [LICENSE](LICENSE).

## Acknowledgments

- [`mcp-abap-abap-adt-api`](https://github.com/marianzeis/mcp-abap-abap-adt-api) by Marian Zeis
- [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic
