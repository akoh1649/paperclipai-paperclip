# Coding Conventions

**Analysis Date:** 2026-04-13

## Naming Patterns

**Files:**
- `kebab-case` for all source files: `board-claim.ts`, `startup-banner.ts`, `live-events-ws.ts`
- `.test.ts` / `.test.tsx` suffix for unit test files co-located with source
- `.spec.ts` suffix for E2E/integration tests in `tests/`

**Functions and Variables:**
- `camelCase` for functions, variables, and method names
- Factory functions use `create` prefix: `createApp`, `createServer`, `createFeedbackTraceShareClientFromConfig`
- Boolean flags use `is` / `has` / `enable` prefix: `isFirstAgent`, `isCreate`, `enableRoutineVisibilityFilter`
- Async cleanup arrays use descriptive names: `cleanups: Array<() => Promise<void>>`

**Types and Interfaces:**
- `PascalCase` for all types, interfaces, and enums
- No `I` prefix for interfaces

**React Components:**
- `PascalCase` function names, same as filename: `IssuesList.tsx` exports `IssuesList`
- Props types named `[ComponentName]Props` by convention (inferred from usage)

**Imports:**
- Node builtins use `node:` protocol: `import fs from "node:fs"`, `import { createHash } from "node:crypto"`
- Internal workspace packages imported via `@paperclipai/` scope: `@paperclipai/shared`, `@paperclipai/db`
- UI path alias `@/*` maps to `ui/src/*`

## TypeScript Configuration

**Base config** (`tsconfig.base.json`):
- `target: ES2023`
- `strict: true` — enforced across all packages
- `isolatedModules: true`
- `forceConsistentCasingInFileNames: true`
- `resolveJsonModule: true`
- `module: NodeNext` / `moduleResolution: NodeNext` for server/packages

**UI config** (`ui/tsconfig.json`):
- `module: ESNext`, `moduleResolution: bundler`
- `jsx: react-jsx`
- `noEmit: true` (build handled by Vite)
- Path alias: `"@/*": ["./src/*"]`

**Monorepo structure:**
- Root `tsconfig.json` uses project references to all packages
- Each package extends `tsconfig.base.json`
- `typecheck` script runs `pnpm -r typecheck` across all packages
- `tsc -b` used in UI for composite builds

## Import Organization

**Order (inferred from source):**
1. Node built-ins (`node:fs`, `node:crypto`, `node:path`)
2. External packages (`express`, `postgres`, `drizzle-orm`, `react`)
3. Internal workspace packages (`@paperclipai/shared`, `@paperclipai/db`)
4. Local relative imports (`./app.js`, `./config.js`, `../middleware/logger.js`)

**File extensions:**
- Server and package imports include `.js` extension in import paths (NodeNext resolution): `import { createApp } from "./app.js"`
- UI imports omit extensions (bundler resolution)

## Code Style

**Formatting:**
- No `.prettierrc` or `.eslintrc` found in the repository root or packages
- Consistent style is enforced through TypeScript strict mode and CI typecheck
- `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comments appear in test files where `any` is unavoidable, indicating ESLint with `@typescript-eslint` is active (likely configured in package-level configs or via editor integration)
- `// eslint-disable-line react-hooks/exhaustive-deps` appears in UI components, indicating the `react-hooks` ESLint plugin is used

**TypeScript strictness:**
- `as any` used sparingly and suppressed with explicit `eslint-disable` — 202 uses of `as any` / `as unknown` in server src (many in route handlers and DB queries)
- `@ts-ignore` and `@ts-expect-error` almost absent (2 instances total in server)

## Error Handling

**Patterns:**
- Async functions use `try/finally` for resource cleanup (DB connections, postgres clients)
- Errors thrown as `Error` instances or domain-specific error classes (e.g., `embedded-postgres-error.ts`)
- `rejects.toThrow()` used in tests to verify constraint violations
- Server errors handled in route middleware layers

## Module Design

**Exports:**
- Named exports used throughout; no default exports in library packages
- React components use named exports: `export function IssuesList(...)`
- Server modules export factory functions or singleton instances

**Barrel Files:**
- `packages/shared/src/index.ts` acts as barrel for the shared package (imported as `@paperclipai/shared`)
- Individual packages expose a single entry point via `exports` in `package.json`

## Comments

**When to Comment:**
- JSDoc-style block comments for complex scripts (e.g., `check-forbidden-tokens.mjs` has a file-level doc block)
- Inline comments explain non-obvious behavior: WSL2 polling workaround in `vite.config.ts`
- Test files use `/** ... */` blocks to describe test scenario scope

## Pre-commit Tooling

**Forbidden token check** (`scripts/check-forbidden-tokens.mjs`):
- Scans tracked files for tokens listed in `.git/hooks/forbidden-tokens.txt`
- Also scans for the current OS username to prevent accidental personal data commits
- Run via `pnpm check:tokens`

**Lockfile policy:**
- `pnpm-lock.yaml` must NOT be committed in PRs — CI owns lockfile updates via the `chore/refresh-lockfile` branch
- Enforced in `.github/workflows/pr.yml` `policy` job

---

*Convention analysis: 2026-04-13*
