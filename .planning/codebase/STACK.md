# Technology Stack

**Analysis Date:** 2026-04-13

## Languages

**Primary:**
- TypeScript 5.7.3 — all source code across server, UI, CLI, and packages

**Secondary:**
- Shell scripts — release, smoke tests, Docker entrypoint (`scripts/`, `docker/`)

## Runtime

**Environment:**
- Node.js >=20 (engines field in root `package.json`)
- Docker base image: `node:lts-trixie-slim` (Debian Trixie slim)

**Package Manager:**
- pnpm 9.15.4 (set via `packageManager` field in root `package.json`)
- Lockfile: `pnpm-lock.yaml` present
- Workspace: `pnpm-workspace.yaml` (monorepo)

## Workspaces (Monorepo)

| Package | Version | Description |
|---|---|---|
| `@paperclipai/server` | 0.3.1 | Express HTTP server + WebSocket realtime layer |
| `@paperclipai/ui` | 0.3.1 | React SPA board UI |
| `paperclipai` (CLI) | 0.3.1 | CLI binary |
| `@paperclipai/db` | 0.3.1 | Drizzle ORM schema + migrations |
| `@paperclipai/shared` | 0.3.1 | Types shared across packages |
| `@paperclipai/adapter-utils` | 0.3.1 | Shared adapter utilities |
| `@paperclipai/mcp-server` | 0.1.0 | MCP protocol server (stdio transport) |
| `@paperclipai/adapter-claude-local` | 0.3.1 | Claude Code adapter |
| `@paperclipai/adapter-codex-local` | 0.3.1 | OpenAI Codex adapter |
| `@paperclipai/adapter-cursor-local` | 0.3.1 | Cursor adapter |
| `@paperclipai/adapter-gemini-local` | 0.3.1 | Gemini CLI adapter |
| `@paperclipai/adapter-openclaw-gateway` | 0.3.1 | Openclaw gateway (WebSocket-based cloud adapter) |
| `@paperclipai/adapter-opencode-local` | 0.3.1 | OpenCode adapter |
| `@paperclipai/adapter-pi-local` | 0.3.1 | Pi (OpenAI Responses API) adapter |
| `@paperclipai/plugin-sdk` | — | Plugin SDK for third-party plugin authors |

## Frameworks

**Server (HTTP):**
- Express 5.1.0 — HTTP framework (`server/package.json`)

**Frontend:**
- React 19.0.0 — UI framework (`ui/package.json`)
- React Router DOM 7.1.5 — Client-side routing (`ui/package.json`)
- Vite 6.1.0 — Dev server and bundler (`ui/package.json`, `server/package.json`)
- Tailwind CSS 4.0.7 — Utility-first CSS (`ui/package.json`)
- @assistant-ui/react 0.12.23 — Chat UI primitives (`ui/package.json`)
- @tanstack/react-query 5.90.21 — Server state management (`ui/package.json`)
- Radix UI — Accessible component primitives (`ui/package.json`)
- @dnd-kit/core 6.3.1 — Drag-and-drop (`ui/package.json`)
- MDXEditor 3.52.4 — Rich text editor (`ui/package.json`)
- Lexical 0.35.0 — Text editing framework (`ui/package.json`)
- Mermaid 11.12.0 — Diagram rendering (`ui/package.json`)

**CLI:**
- Commander 13.1.0 — CLI framework (`cli/package.json`)
- @clack/prompts 0.10.0 — Interactive prompts (`cli/package.json`)

## Database

- Drizzle ORM 0.38.4 — Type-safe query builder (`server/package.json`, `packages/db/package.json`)
- drizzle-kit 0.31.9 — Schema migrations generator (`packages/db/package.json`)
- postgres 3.4.5 — PostgreSQL client driver (`packages/db/package.json`)
- embedded-postgres 18.1.0-beta.16 — Bundled PostgreSQL for local deployments (`packages/db/package.json`, patched)

## Testing

**Unit/Integration:**
- Vitest 3.0.5 — Test runner (`package.json`, all sub-packages)
- supertest 7.0.0 — HTTP integration test helper (`server/package.json`)

**E2E:**
- Playwright 1.58.2 — Browser E2E testing (`package.json`)
  - Configs: `tests/e2e/playwright.config.ts`, `tests/release-smoke/playwright.config.ts`

**Evals:**
- promptfoo 0.103.3 — LLM eval framework (`evals/promptfoo/`)

## Build Tools

- TypeScript compiler (`tsc`) — Type checking and compilation
- esbuild 0.27.3 — CLI bundle (`cli/esbuild.config.mjs`)
- tsx 4.19.2 — TypeScript execution for dev (`server`, `cli`, `packages/db`)
- Vite 6.1.0 — UI bundle and dev server
- cross-env 10.1.0 — Cross-platform env vars in scripts

## Authentication

- better-auth 1.4.18 — Auth framework with email/password, Drizzle adapter (`server/package.json`)

## Security / Validation

- zod 3.24.2 — Schema validation (`server/package.json`, `packages/mcp-server/package.json`)
- ajv 8.18.0 + ajv-formats 3.0.1 — JSON Schema validation for plugin configs (`server/package.json`)
- dompurify 3.2.2 — HTML sanitization (`server/package.json`)

## Logging

- pino 9.6.0 — Structured JSON logging (`server/package.json`)
- pino-http 10.4.0 — HTTP request logging middleware
- pino-pretty 13.1.3 — Dev log formatting

## File / Media

- multer 2.1.1 — File upload middleware (`server/package.json`)
- sharp 0.34.5 — Image processing (`server/package.json`)

## Real-time

- ws 8.19.0 — WebSocket server (`server/package.json`, `packages/adapters/openclaw-gateway/package.json`)

## Patched Dependencies

- `embedded-postgres@18.1.0-beta.16` — Custom patch at `patches/embedded-postgres@18.1.0-beta.16.patch`
- `hermes-paperclip-adapter@0.2.0` — Custom patch at `patches/hermes-paperclip-adapter@0.2.0.patch`

## Rollup Override

- `rollup >=4.59.0` overridden via pnpm overrides (security/compat fix)

## Configuration

**Environment:**
- `.env` files loaded via `dotenv` 17.0.1
- Primary env file path resolved via `resolvePaperclipEnvPath()` (instance-specific)
- Fallback to `cwd()/.env` if different file

**Build:**
- `tsconfig.json` (root — project references)
- `tsconfig.base.json` (shared compiler options)
- `server/tsconfig.json`, `ui/tsconfig.json`, `cli/tsconfig.json`
- `ui/vite.config.*` (UI bundler)

## Platform Requirements

**Development:**
- Node.js >=20
- pnpm 9.15.4
- Docker (optional, for containerized dev)

**Production:**
- Docker (`node:lts-trixie-slim`) — primary deployment target
- Port: 3100 (default)
- Volume: `/paperclip` for persistent data

---

*Stack analysis: 2026-04-13*
