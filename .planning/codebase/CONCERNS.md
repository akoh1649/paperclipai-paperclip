# Codebase Concerns

**Analysis Date:** 2026-04-13

---

## Tech Debt

**Repeated `db as any` casts in server entry point:**
- Issue: The top-level `db` instance is cast to `any` 9 times in `server/src/index.ts` (lines ~468, 496, 500, 520, 523, 558, 563, 577, 578). This defeats type safety across the entire service initialization path.
- Files: `server/src/index.ts`
- Impact: Type errors in DB-consuming services are silenced at the boundary that constructs them. Drizzle schema changes will not surface a compile error for these callsites.
- Fix approach: Derive a typed `Db` alias from the drizzle client return type and replace `db as any` with that alias throughout.

**`buildInvocationEnvForLogs` fallback shim:**
- Issue: `server/src/adapters/utils.ts:41` carries a TODO acknowledging that `@paperclipai/adapter-utils` may not export `buildInvocationEnvForLogs`. The code does a runtime duck-type check and falls back to a local implementation.
- Files: `server/src/adapters/utils.ts` (lines 37–54)
- Impact: If the adapter package is updated without surfacing the export, the fallback silently activates with no test signal.
- Fix approach: Ensure the canonical export exists in `@paperclipai/adapter-utils` and remove the shim.

**Hardcoded `claude_local` adapter fallback in company import TUI:**
- Issue: `cli/src/commands/client/company.ts:383–384` has a TODO noting that adapter selection is not yet implemented in the import TUI and the adapter type is hardcoded to `"claude_local"`.
- Files: `cli/src/commands/client/company.ts` (line 383)
- Impact: Users importing a company whose agent uses a different adapter will silently get a claude_local agent instead.
- Fix approach: Implement adapter selection in the import TUI before removing the fallback.

**Legacy `promptTemplate.legacy.md` virtual file system:**
- Issue: `server/src/services/agent-instructions.ts` still contains a `LEGACY_PROMPT_TEMPLATE_PATH` constant and handles it in multiple special-case branches (lines 337, 472, 610, 641). The type definition also carries a `deprecated: boolean` field.
- Files: `server/src/services/agent-instructions.ts`
- Impact: Maintenance burden. Any refactor of the instructions bundle system must account for these legacy branches.
- Fix approach: Add a migration that converts remaining agents using the legacy file, then remove the special-case code.

**`bootstrapPromptTemplate` kept for backward compatibility in portability:**
- Issue: `server/src/services/company-portability.ts:1597` and `4063` explicitly preserve and then delete `bootstrapPromptTemplate`, a deprecated field, during import/export.
- Files: `server/src/services/company-portability.ts`
- Impact: Export/import code must remain aware of the deprecated field indefinitely until old exports are no longer supported.
- Fix approach: Introduce a portability schema version bump that drops the field.

---

## Security Considerations

**Node.js `vm` module sandbox is not a security boundary:**
- Risk: `server/src/services/plugin-runtime-sandbox.ts` uses `node:vm` (`vm.createContext`, `vm.Script.runInContext`) to sandbox plugin worker code. Node's `vm` module is explicitly documented as not a security sandbox — a malicious plugin can escape the context via prototype chain manipulation or by accessing shared built-in constructors (e.g., `{}.constructor.constructor('return process')()`).
- Files: `server/src/services/plugin-runtime-sandbox.ts` (lines 84–165)
- Current mitigation: The sandbox restricts file-system imports outside the plugin root and enforces an allow-list for bare module specifiers. It also applies an execution timeout. These are meaningful guardrails but do not prevent a determined escape.
- Recommendations: For untrusted plugins, run the worker in a separate process (worker_threads or child_process with restricted permissions) rather than relying on vm isolation. The existing `docker/untrusted-review/` Docker setup suggests this concern is known but the primary in-process path remains vm-only.
- Priority: **High**

**`process.exit(2)` inside a route handler (inline script example):**
- Risk: `server/src/routes/access.ts:1177` contains `process.exit(2)` — however, reading context this is inside a code-comment example snippet intended for operators, not live route logic. Confirmed to be documentation, not execution path.
- Files: `server/src/routes/access.ts` (line 1177)
- Priority: **Low** (false positive, but worth verifying on each update to the file)

**No HTTP-level rate limiting on public API routes:**
- Risk: The codebase implements a rate limiter only for plugin secret resolution (`server/src/services/plugin-secrets-handler.ts:230`). No general rate limiting middleware is applied to the Express router.
- Files: `server/src/app.ts`, `server/src/routes/`
- Current mitigation: Deployment behind a reverse proxy may apply rate limiting externally.
- Recommendations: Add an express rate-limit middleware for auth routes at minimum.
- Priority: **Medium**

**10 fetch calls without timeouts in server code:**
- Risk: `grep` identifies 10 `fetch(` calls in `server/src` that do not pass an `AbortSignal` or timeout. If an upstream service hangs, Node will hold the connection open indefinitely, exhausting the thread pool for long enough activity.
- Files: Scattered across `server/src/` — identify with `grep -rn "fetch(" server/src --include="*.ts" | grep -v "AbortSignal\|signal\|timeout"`.
- Recommendations: Wrap all outbound fetch calls with `AbortSignal.timeout(N)`.
- Priority: **Medium**

---

## Dependencies at Risk

**`embedded-postgres` pinned to a beta:**
- Risk: `packages/db/package.json` pins `embedded-postgres` at `^18.1.0-beta.16`. Beta packages may have breaking changes between patch releases that are not semver-guaranteed.
- Impact: DB startup failures or silent behavioral changes on `pnpm update`.
- Migration plan: Upgrade to a stable release once available, or pin to an exact beta version (not `^`) to prevent unintended drift.
- Priority: **Medium**

**`better-auth` pinned to an exact minor version:**
- Risk: `server/package.json` pins `better-auth` at `1.4.18` (exact, no caret). Authentication library updates for CVEs require a manual version bump.
- Files: `server/package.json`
- Migration plan: Monitor better-auth releases for security advisories; bump regularly.
- Priority: **Medium**

---

## Fragile Areas

**`server/src/services/heartbeat.ts` — 4,533 lines:**
- Files: `server/src/services/heartbeat.ts`
- Why fragile: This is the single largest file in the codebase. It orchestrates run execution, workspace management, agent invocation, and billing in one monolith. Changes to any sub-system require understanding the full file.
- Safe modification: Look for the relevant `executeRun`, `claimRun`, or `finalizeRun` function boundary before editing. Tests in `server/src/__tests__/heartbeat-*.test.ts` (5 files) provide partial coverage but do not cover all edge cases.
- Test coverage: Partial — 5 dedicated test files exist, but the file is too large for full branch coverage.
- Priority: **Medium**

**`server/src/services/company-portability.ts` — 4,415 lines:**
- Files: `server/src/services/company-portability.ts`
- Why fragile: Export/import covers nearly every entity in the system. A missed field in either direction silently produces an incomplete company.
- Safe modification: Add new fields to both the export shape and import shape atomically. Tests in `server/src/__tests__/company-portability.test.ts` (2,355 lines) are extensive.
- Priority: **Low** (well-tested but risky by nature)

**`server/src/routes/access.ts` — 2,940 lines:**
- Files: `server/src/routes/access.ts`
- Why fragile: Mixes role management, invite flows, board claim, and permission-key logic. The `permissionKey: any` type on line 1801 is a type gap in permission enforcement.
- Safe modification: Any permission change should be accompanied by a test in the existing `server/src/__tests__/` suite.
- Priority: **Medium**

---

## Test Coverage Gaps

**UI pages: 42 pages, 2 test files (excluding test files counted as pages):**
- What's not tested: `AgentDetail.tsx` (4,120 lines), `IssueDetail.tsx` (2,299 lines), `Inbox.tsx` (2,169 lines, has test but it is snapshot/render only), `CompanyExport.tsx`, `CompanyImport.tsx`, `ProjectDetail.tsx`, and 36 other pages have no unit/integration tests.
- Files: `ui/src/pages/` — only `GoalDetail.test.tsx`, `Inbox.test.tsx`, and `Routines.test.tsx` exist.
- Risk: Business logic embedded in page components (filtering, form submission, state derivation) is entirely untested. Regressions in the most-used pages will not be caught before deployment.
- Priority: **High**

**E2E coverage limited to 2 scenarios:**
- What's not tested: Only `onboarding.spec.ts` and `signoff-policy.spec.ts` exist in `tests/e2e/`. No E2E coverage for: issue creation, agent run execution, routine scheduling, company export/import, plugin management.
- Files: `tests/e2e/`
- Risk: Core user workflows are only validated by unit tests in isolation.
- Priority: **High**

**`react-hooks/exhaustive-deps` suppressed 10 times:**
- What's not tested: Each suppressed `useEffect` dependency array is a potential stale-closure bug. Suppressions in `IssueDetail.tsx:1357`, `CompanyExport.tsx:671,758`, `AgentConfigForm.tsx:225`, `IssuesList.tsx:260`, and others.
- Files: `ui/src/pages/IssueDetail.tsx`, `ui/src/pages/CompanyExport.tsx`, `ui/src/pages/GoalDetail.tsx`, `ui/src/pages/NewAgent.tsx`, `ui/src/components/AgentConfigForm.tsx`, `ui/src/components/IssuesList.tsx`, `ui/src/plugins/launchers.tsx`, `ui/src/plugins/bridge.ts`
- Risk: State updates do not re-run effects when dependent values change, leading to subtle UI bugs.
- Priority: **Medium**

---

## Known Issues / Unfinished Features

**Isolated workspaces behind experimental flag:**
- Problem: `enableIsolatedWorkspaces` defaults to `false` in `server/src/services/instance-settings.ts:43`. The feature is gated by `experimentalSettings` in the UI (Inbox.tsx:665). The policy logic in `server/src/services/execution-workspace-policy.ts` is complete but the feature is not GA.
- Files: `server/src/services/instance-settings.ts`, `ui/src/pages/Inbox.tsx`
- Blocks: Cannot ship isolated workspace execution to all users.
- Priority: **Medium**

**`InstanceExperimentalSettings` page exposes unstable knobs to operators:**
- Problem: `ui/src/pages/InstanceExperimentalSettings.tsx` exists as a production page. Experimental settings with no stability guarantees are operator-accessible.
- Files: `ui/src/pages/InstanceExperimentalSettings.tsx`
- Risk: Operators may enable features that are not production-ready.
- Priority: **Low**

---

## Performance Bottlenecks

**`server/src/services/heartbeat.ts` — single-file monolith with inline DB queries:**
- Problem: The heartbeat service performs DB queries inline inside the main execution loop at high frequency. There is no query result caching layer.
- Files: `server/src/services/heartbeat.ts`
- Cause: Tight coupling of execution orchestration with persistence.
- Improvement path: Extract read-heavy lookups (agent config, adapter config, budget checks) into a short-lived cache with TTL.
- Priority: **Low** (not confirmed as a production bottleneck, but architectural risk at scale)

---

## Miscellaneous Code Quality

**201 `empty catch {}` blocks across server and UI:**
- Server: 113 silent catch blocks; UI: 88 silent catch blocks.
- Files: Widespread — examples in `server/src/index.ts` (lines 189, 276, 328, 341, 363, 778), `server/src/secrets/local-encrypted-provider.ts`, `server/src/storage/local-disk-provider.ts`.
- Impact: Errors are silently discarded. Debugging production failures in these paths requires adding logging post-incident.
- Recommendation: At minimum, emit a `logger.warn` in non-trivial catch blocks.
- Priority: **Medium**

**62 `as any` / `: any` usages in production source:**
- Files: `server/src/middleware/logger.ts`, `server/src/middleware/error-handler.ts`, `server/src/index.ts`, `server/src/routes/access.ts`
- Impact: TypeScript's type safety is partially disabled for these callsites.
- Priority: **Low** (most are localized workarounds, not systemic)

---

*Concerns audit: 2026-04-13*
