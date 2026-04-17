# Architecture

**Analysis Date:** 2026-04-13

## Pattern Overview

**Overall:** Monorepo — single-tenant self-hosted AI agent orchestration platform

**Key Characteristics:**
- Express server (`server/`) serves a REST API and optionally hosts the Vite-built React SPA (`ui/`)
- Database-centric: all agent state persisted in PostgreSQL (embedded or external); Drizzle ORM in `packages/db`
- Adapter pattern: pluggable AI coding-agent backends (Claude, Codex, Gemini, Cursor, OpenCode, OpenClaw, Pi)
- Plugin system: third-party plugins run in isolated workers managed by the plugin host services layer
- Real-time: WebSocket server (`server/src/realtime/live-events-ws.ts`) pushes events to connected boards
- Two deployment modes: `local_trusted` (loopback, no auth) and `authenticated` (BetterAuth, public-ready)

## Layers

**Shared Types / Utilities:**
- Purpose: Cross-cutting enums, types, validators, telemetry helpers
- Location: `packages/shared/src/`
- Contains: `types/`, `validators/`, `telemetry/`, constants, project/routine helpers
- Depends on: nothing internal
- Used by: server, ui, cli, adapters

**Database:**
- Purpose: Drizzle ORM schema, migrations, embedded-postgres helpers, backup utilities
- Location: `packages/db/src/`
- Contains: `schema/`, `migrations/`, `client.ts`, `migrate.ts`, `backup-lib.ts`, `migration-runtime.ts`
- Depends on: `packages/shared`
- Used by: server, cli

**Adapter Utils:**
- Purpose: Abstract interface all agent adapters implement; session management, billing, log redaction
- Location: `packages/adapter-utils/src/`
- Contains: `types.ts`, `billing.ts`, `server-utils.ts`, `session-compaction.ts`
- Depends on: `packages/shared`
- Used by: all adapter packages, server adapter registry

**Adapter Packages:**
- Purpose: AI-agent-specific execution drivers; each exposes `execute`, `testEnvironment`, `sessionCodec`, `listModels`, `listSkills`, `syncSkills`
- Location: `packages/adapters/{claude-local,codex-local,cursor-local,gemini-local,opencode-local,openclaw-gateway,pi-local}/`
- Each contains: `src/server/` (server-side execution), `src/ui/` (React config components), `src/cli/` (CLI helpers), `src/index.ts` (shared metadata)
- Depends on: `packages/adapter-utils`, `packages/shared`
- Used by: `server/src/adapters/registry.ts`

**Plugin SDK:**
- Purpose: Public API for plugin authors; host-client RPC protocol, worker bootstrapping, dev tooling
- Location: `packages/plugins/sdk/src/`
- Contains: `define-plugin.ts`, `protocol.ts`, `host-client-factory.ts`, `worker-rpc-host.ts`, `types.ts`, `ui/`, `dev-server.ts`, `dev-cli.ts`
- Depends on: `packages/shared`
- Used by: `server/src/app.ts` (createHostClientHandlers), plugin packages

**MCP Server:**
- Purpose: Model Context Protocol server exposing Paperclip as an MCP tool provider
- Location: `packages/mcp-server/src/`
- Contains: `tools.ts`, `client.ts`, `stdio.ts`, `config.ts`
- Depends on: `packages/shared`, server API via HTTP
- Used by: standalone binary `paperclip-mcp-server`

**Backend Server:**
- Purpose: Express HTTP API, WebSocket live-events, plugin worker orchestration, job scheduling, config/auth bootstrap
- Location: `server/src/`
- Entry point: `server/src/index.ts` (startServer) → `server/src/app.ts` (createApp)
- Depends on: `packages/db`, `packages/shared`, `packages/adapter-utils`, all adapter packages, `packages/plugins/sdk`
- Used by: CLI (`start` command), Docker container

**Frontend UI:**
- Purpose: React SPA — board interface for managing companies, agents, issues, projects, routines, plugins
- Location: `ui/src/`
- Entry point: `ui/src/main.tsx`
- Depends on: server REST API and WebSocket
- Used by: served statically from server or via Vite dev proxy

**CLI:**
- Purpose: Local operator tooling — `paperclipai` command; onboard, doctor, configure, run, heartbeat, db-backup, worktree, plugin management
- Location: `cli/src/`
- Entry point: `cli/src/index.ts`
- Depends on: `packages/shared`, `packages/db`, server API via HTTP (`cli/src/client/`)
- Used by: end users, CI scripts

## Data Flow

**Agent Issue Execution (primary flow):**

1. Board creates an Issue via `POST /api/issues` → `server/src/routes/issues.ts`
2. `server/src/services/issues.ts` persists to `issues` table (Drizzle, `packages/db`)
3. Heartbeat scheduler (`server/src/services/heartbeat.ts`) ticks every N ms; picks up queued issues
4. `heartbeatService.tickTimers()` calls `workspaceRuntime.realizeExecutionWorkspace()` to set up the agent's file workspace
5. Adapter registry (`server/src/adapters/registry.ts`) selects adapter (e.g., `adapter-claude-local`) and calls `execute()`
6. Adapter spawns the AI coding agent as a subprocess; streams tool calls / output back
7. Run events persisted to `heartbeatRuns` / `heartbeatRunEvents` tables; live events pushed via WebSocket to UI
8. On completion, run result written to issue comment; issue status updated

**Real-time Updates:**
1. `server/src/realtime/live-events-ws.ts` upgrades HTTP connections to WebSocket
2. `server/src/services/live-events.ts` emits typed events per company
3. `ui/src/context/LiveUpdatesProvider.tsx` subscribes and refreshes React Query caches

**Plugin Execution:**
1. Plugin loaded via `server/src/services/plugin-loader.ts` → worker spawned by `plugin-worker-manager.ts`
2. Jobs scheduled via `plugin-job-scheduler.ts` → coordinated by `plugin-job-coordinator.ts`
3. Plugin tools dispatched via `plugin-tool-dispatcher.ts`; host services provided via `plugin-host-services.ts`
4. Plugin UI served as static assets from `server/src/routes/plugin-ui-static.ts`

**State Management (UI):**
- TanStack Query for all server state (30s stale time, refetch on focus)
- React context for: company selection, live update subscriptions, sidebar, panels, dialogs, toasts, theme, editor autocomplete

## Key Abstractions

**ServerAdapterModule:**
- Purpose: The contract every AI agent adapter must implement
- Examples: `packages/adapters/claude-local/src/server/index.ts`, `packages/adapters/codex-local/src/server/index.ts`
- Pattern: `{ execute, testEnvironment, sessionCodec, listModels?, listSkills?, syncSkills?, getQuotaWindows? }`

**Db (Drizzle instance):**
- Purpose: Typed database handle passed explicitly to every service/route constructor
- Examples: all files in `server/src/services/`, `server/src/routes/`
- Pattern: `function fooService(db: Db)` — no global singletons for DB access

**DeploymentMode / DeploymentExposure:**
- Purpose: Controls auth, hostname guards, mutation guards
- Defined in: `packages/shared/src/types/`
- Used by: `server/src/index.ts`, `server/src/app.ts`, `server/src/middleware/`

## Entry Points

**Server:**
- Location: `server/src/index.ts` (`startServer`)
- Triggers: `node server/dist/index.js` (Docker), `pnpm dev:server`, CLI `start`
- Responsibilities: embedded/external postgres bootstrap, BetterAuth init, Express app creation, WebSocket setup, heartbeat + backup schedulers

**UI:**
- Location: `ui/src/main.tsx`
- Triggers: Vite dev server or static build served by Express
- Responsibilities: React root, QueryClient, context providers, router

**CLI:**
- Location: `cli/src/index.ts`
- Triggers: `paperclipai <command>`
- Responsibilities: commander.js program; delegates to per-command handlers

**MCP Server:**
- Location: `packages/mcp-server/src/stdio.ts`
- Triggers: `paperclip-mcp-server` binary
- Responsibilities: stdio MCP protocol, tool dispatch to server API

## Error Handling

**Strategy:** HTTP errors with structured JSON bodies; custom error factories at `server/src/errors.ts`

**Patterns:**
- `conflict(msg)`, `notFound(msg)`, `unprocessable(msg)` — throw typed HTTP errors from services
- Express `errorHandler` middleware (`server/src/middleware/index.ts`) catches and serializes
- Async adapter errors captured in run events; stored to DB with stack traces

## Cross-Cutting Concerns

**Logging:** `pino` logger via `server/src/middleware/logger.ts`; structured JSON; `log-redaction.ts` strips user text from logs
**Validation:** Zod schemas in `packages/shared/src/validators/`; adapter config validated via `server/src/services/plugin-config-validator.ts`
**Authentication:** `local_trusted` → implicit `local-board` principal; `authenticated` → BetterAuth (`server/src/auth/better-auth.ts`); agent API keys via JWT (`server/src/agent-auth-jwt.ts`)

---

*Architecture analysis: 2026-04-13*
