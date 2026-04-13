# Codebase Structure

**Analysis Date:** 2026-04-13

## Directory Layout

```
paperclip/
├── server/                    # Express API server (pnpm workspace: @paperclipai/server)
│   └── src/
│       ├── index.ts           # startServer() entry point
│       ├── app.ts             # createApp() — Express setup, route mounting, plugin init
│       ├── config.ts          # Config interface + loadConfig()
│       ├── adapters/          # Adapter registry + per-adapter model/skill helpers
│       ├── auth/              # BetterAuth integration
│       ├── middleware/        # httpLogger, auth, boardMutationGuard, errorHandler
│       ├── realtime/          # WebSocket live-events server
│       ├── routes/            # One file per API resource (issues, agents, plugins, etc.)
│       ├── services/          # Business logic (heartbeat, workspace-runtime, costs, etc.)
│       ├── secrets/           # Secrets provider abstractions
│       ├── storage/           # Storage service (local disk / S3)
│       ├── onboarding-assets/ # Default CEO/agent markdown assets
│       └── types/             # express.d.ts augmentation
├── ui/                        # React SPA (pnpm workspace: @paperclipai/ui)
│   └── src/
│       ├── main.tsx           # React root + providers
│       ├── App.tsx            # Router + layout shell
│       ├── pages/             # One file per page/view
│       ├── components/        # Shared components (transcript/, ui/)
│       ├── api/               # TanStack Query + fetch wrappers per resource
│       ├── adapters/          # Per-adapter UI config components + registry
│       ├── context/           # React context providers (Company, LiveUpdates, etc.)
│       ├── hooks/             # Custom React hooks
│       ├── lib/               # Utilities, router wrapper
│       ├── plugins/           # Plugin bridge + launcher
│       └── fixtures/          # Test fixtures
├── cli/                       # paperclipai CLI (pnpm workspace: @paperclipai/cli)
│   └── src/
│       ├── index.ts           # commander.js entry point
│       ├── commands/          # One file per CLI command (onboard, doctor, run, etc.)
│       ├── commands/client/   # API-client-backed subcommands (issue, agent, company, etc.)
│       ├── adapters/          # CLI adapter helpers (http, process)
│       ├── checks/            # Environment checks
│       ├── client/            # HTTP client for server API
│       ├── config/            # Config file helpers
│       ├── prompts/           # Interactive prompts
│       └── utils/             # CLI utilities
├── packages/
│   ├── shared/                # @paperclipai/shared — types, validators, telemetry, constants
│   │   └── src/
│   │       ├── types/         # Core domain types (DeploymentMode, BillingType, etc.)
│   │       ├── validators/    # Zod schemas
│   │       └── telemetry/     # Telemetry helpers
│   ├── db/                    # @paperclipai/db — Drizzle ORM, migrations, embedded-postgres
│   │   └── src/
│   │       ├── schema/        # Drizzle table definitions
│   │       ├── migrations/    # SQL migration files
│   │       ├── client.ts      # createDb()
│   │       ├── migrate.ts     # applyPendingMigrations, inspectMigrations
│   │       └── backup-lib.ts  # runDatabaseBackup, retention pruning
│   ├── adapter-utils/         # @paperclipai/adapter-utils — shared adapter contract + utils
│   │   └── src/
│   │       ├── types.ts       # ServerAdapterModule interface, AdapterExecutionResult, etc.
│   │       ├── billing.ts     # Token billing helpers
│   │       ├── server-utils.ts
│   │       └── session-compaction.ts
│   ├── adapters/              # Per-adapter packages (one per AI agent backend)
│   │   ├── claude-local/      # @paperclipai/adapter-claude-local
│   │   ├── codex-local/       # @paperclipai/adapter-codex-local
│   │   ├── cursor-local/      # @paperclipai/adapter-cursor-local
│   │   ├── gemini-local/      # @paperclipai/adapter-gemini-local
│   │   ├── opencode-local/    # @paperclipai/adapter-opencode-local
│   │   ├── openclaw-gateway/  # @paperclipai/adapter-openclaw-gateway (remote gateway)
│   │   └── pi-local/          # @paperclipai/adapter-pi-local
│   ├── plugins/
│   │   ├── sdk/               # @paperclipai/plugin-sdk — plugin author API
│   │   │   └── src/
│   │   │       ├── define-plugin.ts
│   │   │       ├── protocol.ts
│   │   │       ├── host-client-factory.ts
│   │   │       ├── worker-rpc-host.ts
│   │   │       └── ui/
│   │   ├── create-paperclip-plugin/  # Plugin scaffolding tool
│   │   └── examples/          # Example plugins (hello-world, kitchen-sink)
│   └── mcp-server/            # @paperclipai/mcp-server — MCP protocol bridge
│       └── src/
│           ├── stdio.ts       # Binary entry point
│           ├── tools.ts       # MCP tool definitions
│           └── client.ts      # HTTP client wrapping server API
├── docker/                    # Docker compose configs and helper scripts
│   ├── openclaw-smoke/        # OpenClaw smoke test compose
│   ├── quadlet/               # Podman quadlet unit files
│   └── untrusted-review/      # Untrusted-review sidecar
├── tests/
│   ├── e2e/                   # Playwright end-to-end tests
│   └── release-smoke/         # Release smoke tests (Playwright)
├── evals/
│   └── promptfoo/             # promptfoo eval suites (prompts + tests)
├── scripts/                   # Shell scripts: release, backup, smoke, dev-runner, dev-service
├── patches/                   # pnpm patches (embedded-postgres, hermes-paperclip-adapter)
├── doc/                       # Internal planning docs, specs, plans
├── docs/                      # Public Mintlify documentation site
├── skills/                    # Claude skill definitions for Paperclip agents
├── .agents/                   # Agent skill definitions (company-creator, pr-report, etc.)
├── .claude/                   # Claude Code skills (design-guide)
├── .planning/                 # GSD planning documents (codebase/, phases, etc.)
├── releases/                  # Release artifacts / changelog entries
├── report/                    # Generated reports
├── data/                      # Persistent data (secrets/)
├── Dockerfile                 # Multi-stage: base → deps → build → production
├── pnpm-workspace.yaml        # Workspace roots
├── tsconfig.base.json         # Shared TS base config
├── vitest.config.ts           # Root Vitest config
└── package.json               # Root scripts, devDependencies, pnpm patches
```

## Directory Purposes

**`server/src/routes/`:**
- Purpose: Thin Express route handlers; validate request, call service, return JSON
- Contains: One `.ts` file per resource domain (agents, issues, companies, plugins, adapters, secrets, etc.)
- Key files: `server/src/routes/issues.ts`, `server/src/routes/agents.ts`, `server/src/routes/plugins.ts`

**`server/src/services/`:**
- Purpose: All business logic; stateless service factories receiving `db: Db` as their first argument
- Contains: `heartbeat.ts` (run lifecycle), `workspace-runtime.ts` (execution workspaces), `issues.ts`, `agents.ts`, `costs.ts`, plugin host services (20+ files)
- Key files: `server/src/services/heartbeat.ts`, `server/src/services/workspace-runtime.ts`

**`server/src/adapters/`:**
- Purpose: Server-side adapter registry; loads all built-in adapters at startup; exposes `getServerAdapter()`, `registerServerAdapter()`
- Key files: `server/src/adapters/registry.ts`, `server/src/adapters/index.ts`

**`packages/db/src/schema/`:**
- Purpose: Drizzle table definitions — the source of truth for DB schema
- All table objects exported from `packages/db/src/index.ts`

**`ui/src/api/`:**
- Purpose: All server communication from the frontend; TanStack Query keys + fetch functions; one file per resource
- Key files: `ui/src/api/client.ts` (base fetch), `ui/src/api/issues.ts`, `ui/src/api/agents.ts`

**`ui/src/adapters/`:**
- Purpose: Per-adapter UI registry: React config forms, metadata, transcript renderers, runtime JSON fields
- Key files: `ui/src/adapters/registry.ts`, `ui/src/adapters/index.ts`

## Key File Locations

**Entry Points:**
- `server/src/index.ts`: Server startup (startServer)
- `ui/src/main.tsx`: React SPA root
- `cli/src/index.ts`: CLI program root
- `packages/mcp-server/src/stdio.ts`: MCP server binary

**Configuration:**
- `server/src/config.ts`: Config interface, env var resolution
- `pnpm-workspace.yaml`: Workspace package roots
- `tsconfig.base.json`: Shared TypeScript base
- `vitest.config.ts`: Root test config
- `Dockerfile`: Production container definition

**Core Business Logic:**
- `server/src/services/heartbeat.ts`: Agent run lifecycle (enqueue → execute → complete)
- `server/src/services/workspace-runtime.ts`: Execution workspace setup and service management
- `server/src/adapters/registry.ts`: Adapter registration and lookup

**Database:**
- `packages/db/src/schema/`: All Drizzle table definitions
- `packages/db/src/client.ts`: createDb() factory
- `packages/db/src/migrate.ts`: Migration helpers

**Testing:**
- `tests/e2e/`: Playwright browser tests
- `server/src/__tests__/`: Server unit/integration tests
- `cli/src/__tests__/`: CLI tests
- `packages/db/src/*.test.ts`: DB package tests

## Naming Conventions

**Files:**
- Services: `kebab-case.ts` (e.g., `workspace-runtime.ts`, `plugin-job-scheduler.ts`)
- Routes: match resource name in kebab-case (e.g., `execution-workspaces.ts`)
- UI pages: `PascalCase.tsx` (e.g., `IssueDetail.tsx`, `AgentDetail.tsx`)
- UI API: camelCase resource name (e.g., `issues.ts`, `companySkills.ts`)

**Directories:**
- Source always under `src/` within each workspace package
- Tests in `src/__tests__/` (server/cli) or co-located as `*.test.ts` (packages)

## Where to Add New Code

**New API endpoint:**
- Route handler: `server/src/routes/{resource}.ts`
- Service logic: `server/src/services/{resource}.ts`
- Mount in: `server/src/app.ts`
- UI API wrapper: `ui/src/api/{resource}.ts`

**New DB table:**
- Schema: `packages/db/src/schema/{resource}.ts` → export from `packages/db/src/index.ts`
- Migration: add to `packages/db/src/migrations/` (numbered)

**New adapter:**
- Package: `packages/adapters/{name}-{type}/` following existing adapter structure
- Register in: `server/src/adapters/registry.ts`
- UI config: `ui/src/adapters/{name}/`
- Add to: `Dockerfile` COPY block

**New UI page:**
- Component: `ui/src/pages/{PageName}.tsx`
- Route: register in `ui/src/App.tsx`

**New shared type or validator:**
- Type: `packages/shared/src/types/`
- Validator: `packages/shared/src/validators/`
- Export from: `packages/shared/src/index.ts`

**New plugin:**
- Scaffold with: `create-paperclip-plugin` (in `packages/plugins/`)
- Reference example: `packages/plugins/examples/plugin-hello-world-example/`

## Special Directories

**`data/secrets/`:**
- Purpose: Runtime secret storage for local deployments
- Generated: Yes (at runtime)
- Committed: No

**`patches/`:**
- Purpose: pnpm patch overrides for `embedded-postgres` and `hermes-paperclip-adapter`
- Generated: No
- Committed: Yes

**`releases/`:**
- Purpose: Release changelog and artifact metadata
- Generated: Partially (by release scripts)
- Committed: Yes

**`.planning/`:**
- Purpose: GSD planning documents (codebase analysis, phase plans)
- Generated: By Claude agents
- Committed: Yes

**`server/dist/` and `ui/dist/`:**
- Purpose: Build outputs; `server/dist/index.js` is the production entry point
- Generated: Yes (`pnpm build`)
- Committed: No

---

*Structure analysis: 2026-04-13*
