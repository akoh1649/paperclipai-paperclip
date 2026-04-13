# External Integrations

**Analysis Date:** 2026-04-13

## AI Agent Runtimes

Paperclip orchestrates multiple AI agent runtimes through a pluggable adapter system. Each adapter lives in `packages/adapters/` and exposes `server`, `ui`, and `cli` sub-paths.

**Claude Code (Anthropic):**
- Adapter: `@paperclipai/adapter-claude-local` at `packages/adapters/claude-local/`
- Runtime: `@anthropic-ai/claude-code` installed globally in Docker (`Dockerfile` line 58)
- Auth: Uses Claude Code's own credential store (no API key in Paperclip env)

**OpenAI Codex:**
- Adapter: `@paperclipai/adapter-codex-local` at `packages/adapters/codex-local/`
- Runtime: `@openai/codex` installed globally in Docker (`Dockerfile` line 58)
- Auth: OpenAI credentials via Codex's own config

**OpenCode:**
- Adapter: `@paperclipai/adapter-opencode-local` at `packages/adapters/opencode-local/`
- Runtime: `opencode-ai` installed globally in Docker (`Dockerfile` line 58)
- Env: `OPENCODE_ALLOW_ALL_MODELS=true` set in Docker production env
- Storage dir: `PAPERCLIP_OPENCODE_STORAGE_DIR` (default `~/.local/share/opencode`)

**Google Gemini CLI:**
- Adapter: `@paperclipai/adapter-gemini-local` at `packages/adapters/gemini-local/`
- Runtime: Gemini CLI process invoked locally

**Cursor:**
- Adapter: `@paperclipai/adapter-cursor-local` at `packages/adapters/cursor-local/`
- Runtime: Cursor installed locally by the host

**Pi (OpenAI Responses API):**
- Adapter: `@paperclipai/adapter-pi-local` at `packages/adapters/pi-local/`

**Openclaw Gateway:**
- Adapter: `@paperclipai/adapter-openclaw-gateway` at `packages/adapters/openclaw-gateway/`
- Protocol: WebSocket (`ws@8.19.0`)
- Purpose: Cloud/remote agent gateway (as opposed to local process adapters)

**Hermes (LiteLLM-based):**
- Package: `hermes-paperclip-adapter@0.2.0` (patched — `patches/hermes-paperclip-adapter@0.2.0.patch`)
- Used in: `server/src/adapters/registry.ts`
- Purpose: LiteLLM-compatible adapter for routing to various LLM providers
- Referenced by both `server` and `ui` packages

## Data Storage

**Databases:**
- PostgreSQL
  - Embedded mode: `embedded-postgres@18.1.0-beta.16` (bundled for local/single-node deployments)
  - External mode: standard PostgreSQL 17 (see `docker/docker-compose.yml`)
  - Connection env var: `DATABASE_URL`
  - Client: `postgres@3.4.5` (raw driver), `drizzle-orm@0.38.4` (ORM)
  - Schema/migrations: `packages/db/src/migrations/`
  - Config: `databaseMode` can be `"embedded-postgres"` or `"postgres"` (set in `config.json`)

**File Storage:**
- Local disk (default): base dir via `PAPERCLIP_STORAGE_LOCAL_DIR` or config
  - Implementation: `server/src/storage/local-disk-provider.ts`
- S3-compatible (optional): `@aws-sdk/client-s3@3.888.0`
  - Implementation: `server/src/storage/s3-provider.ts`
  - Env vars:
    - `PAPERCLIP_STORAGE_PROVIDER=s3`
    - `PAPERCLIP_STORAGE_S3_BUCKET` (default: `paperclip`)
    - `PAPERCLIP_STORAGE_S3_REGION` (default: `us-east-1`)
    - `PAPERCLIP_STORAGE_S3_ENDPOINT` (optional, for S3-compatible services)
    - `PAPERCLIP_STORAGE_S3_PREFIX`
    - `PAPERCLIP_STORAGE_S3_FORCE_PATH_STYLE`

**Caching:**
- None detected

## Authentication & Identity

**Auth Framework:**
- `better-auth@1.4.18`
- Implementation: `server/src/auth/better-auth.ts`
- Strategy: Email + password (sign-up can be disabled via `authDisableSignUp`)
- Backend: Drizzle adapter backed by PostgreSQL (`authUsers`, `authSessions`, `authAccounts`, `authVerifications` tables in `packages/db/`)
- Secret: `BETTER_AUTH_SECRET` env var (fallback: `PAPERCLIP_AGENT_JWT_SECRET`)
- Cookie security: `useSecureCookies` automatically disabled for HTTP-only deployments

**Deployment Modes:**
- `local_trusted` — no auth required (local dev)
- `authenticated` — full auth enforced (production Docker)

**Deployment Exposure:**
- `private` or `public` — controls trusted origins and CORS

**Env vars for auth:**
- `BETTER_AUTH_SECRET` — required in authenticated mode
- `PAPERCLIP_PUBLIC_URL` — used for trusted origin derivation
- `PAPERCLIP_DEPLOYMENT_MODE`
- `PAPERCLIP_DEPLOYMENT_EXPOSURE`

## Secrets Management

- Provider: `local_encrypted` (default) or configurable via `PAPERCLIP_SECRETS_PROVIDER`
- Master key file: `PAPERCLIP_SECRETS_MASTER_KEY_FILE` (defaults to instance dir)
- Strict mode: `PAPERCLIP_SECRETS_STRICT_MODE`
- Storage: `data/secrets/` directory in project root (committed as empty dir placeholder)

## MCP (Model Context Protocol)

- Package: `@paperclipai/mcp-server@0.1.0` at `packages/mcp-server/`
- SDK: `@modelcontextprotocol/sdk@1.29.0`
- Transport: stdio (binary: `paperclip-mcp-server`)
- Purpose: Exposes Paperclip APIs to MCP-compatible AI clients

## Feedback / Telemetry Export

- Optional HTTP backend for exporting run feedback/telemetry
- Env vars:
  - `PAPERCLIP_FEEDBACK_EXPORT_BACKEND_URL` (alias: `PAPERCLIP_TELEMETRY_BACKEND_URL`)
  - `PAPERCLIP_FEEDBACK_EXPORT_BACKEND_TOKEN` (alias: `PAPERCLIP_TELEMETRY_BACKEND_TOKEN`)
- Implementation: `server/src/services/feedback.ts`
- Disabled by default (`telemetryEnabled` flag in config)

## Real-time / WebSocket

- WebSocket server: `ws@8.19.0`
- Implementation: `server/src/realtime/live-events-ws.ts`
- Purpose: Live event streaming to connected UI clients

## CI/CD & Deployment

**Container:**
- Dockerfile: `/home/rhx/projects/paperclip/Dockerfile` (multi-stage: base → deps → build → production)
- Docker Compose configs:
  - `docker/docker-compose.yml` — standard deployment (separate Postgres container)
  - `docker/docker-compose.quickstart.yml` — quickstart (embedded Postgres)
  - `docker/docker-compose.untrusted-review.yml` — sandboxed untrusted review mode
- Base image: `node:lts-trixie-slim`
- Default port: 3100
- Persistent volume: `/paperclip`

**GitHub CLI:**
- `gh` CLI installed in Docker image (for agent use)
- Release scripts: `scripts/release.sh`, `scripts/create-github-release.sh`

## Evals

- `promptfoo@0.103.3` — LLM evaluation
- Config: `evals/promptfoo/`

## Plugin System

- Plugin SDK: `@paperclipai/plugin-sdk` at `packages/plugins/sdk/`
- Plugin scaffold: `packages/plugins/create-paperclip-plugin/`
- Plugin workers sandboxed — plugins do NOT receive host `process.env` (enforced in `server/src/services/plugin-worker-manager.ts`)

## Environment Variable Summary

| Variable | Purpose | Required |
|---|---|---|
| `BETTER_AUTH_SECRET` | Auth signing secret | Yes (authenticated mode) |
| `DATABASE_URL` | External PostgreSQL connection | Only in `postgres` database mode |
| `PAPERCLIP_PUBLIC_URL` | Public base URL for trusted origins | Recommended in production |
| `PAPERCLIP_DEPLOYMENT_MODE` | `local_trusted` or `authenticated` | No (default: `local_trusted`) |
| `PAPERCLIP_DEPLOYMENT_EXPOSURE` | `private` or `public` | No (default: `private`) |
| `PAPERCLIP_STORAGE_PROVIDER` | `local_disk` or `s3` | No (default: `local_disk`) |
| `PAPERCLIP_STORAGE_S3_BUCKET` | S3 bucket name | Only if S3 storage |
| `PAPERCLIP_STORAGE_S3_REGION` | S3 region | Only if S3 storage |
| `PAPERCLIP_STORAGE_S3_ENDPOINT` | S3-compatible endpoint override | No |
| `PAPERCLIP_SECRETS_PROVIDER` | Secrets backend | No |
| `PAPERCLIP_FEEDBACK_EXPORT_BACKEND_URL` | Telemetry/feedback export URL | No |
| `OPENCODE_ALLOW_ALL_MODELS` | Allow all OpenCode models | No (set in Docker) |

---

*Integration audit: 2026-04-13*
