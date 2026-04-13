# Testing Patterns

**Analysis Date:** 2026-04-13

## Test Framework

**Unit/Integration Runner:**
- Vitest `^3.0.5`
- Root config: `vitest.config.ts` (workspace mode)

**E2E Runner:**
- Playwright `^1.58.2`
- E2E config: `tests/e2e/playwright.config.ts`
- Release smoke config: `tests/release-smoke/playwright.config.ts`

**Assertion Library:**
- Vitest built-in (`expect`, `toMatchObject`, `toEqual`, `toThrow`, `toHaveBeenCalledWith`)

**Run Commands:**
```bash
pnpm test           # Vitest watch mode (all workspace projects)
pnpm test:run       # Vitest one-shot (used in CI)
pnpm test:e2e       # Playwright E2E tests
pnpm test:e2e:headed   # Playwright with visible browser
pnpm test:release-smoke  # Release smoke tests
```

## Workspace Test Projects

The root `vitest.config.ts` uses Vitest workspace mode and references these projects:

```typescript
// vitest.config.ts
test: {
  projects: [
    "packages/db",
    "packages/adapters/codex-local",
    "packages/adapters/opencode-local",
    "server",
    "ui",
    "cli",
  ],
}
```

Each project has its own `vitest.config.ts` that sets `environment: "node"` (except UI which uses per-file overrides).

## Test File Organization

**Location:**
- Unit/integration tests are **co-located** with source files
- E2E tests live in `tests/e2e/*.spec.ts`
- Release smoke tests live in `tests/release-smoke/*.spec.ts`

**Naming:**
- Unit tests: `[name].test.ts` or `[name].test.tsx`
- E2E tests: `[name].spec.ts`

**Structure:**
```
packages/db/src/
├── client.ts
├── client.test.ts         # co-located unit test
├── backup-lib.ts
├── backup-lib.test.ts
packages/shared/src/
├── adapter-types.ts
├── adapter-types.test.ts
ui/src/components/
├── IssuesList.tsx
├── IssuesList.test.tsx    # co-located component test
ui/src/lib/
├── company-routes.ts
├── company-routes.test.ts
tests/e2e/
├── playwright.config.ts
├── onboarding.spec.ts
├── signoff-policy.spec.ts
tests/release-smoke/
├── playwright.config.ts
└── docker-auth-onboarding.spec.ts
```

## Test Structure

**Suite Organization (unit tests):**
```typescript
import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";

describe("inferOpenAiCompatibleBiller", () => {
  it("returns openrouter when OPENROUTER_API_KEY is present", () => {
    expect(
      inferOpenAiCompatibleBiller({ OPENROUTER_API_KEY: "sk-or-123" } as NodeJS.ProcessEnv, "openai"),
    ).toBe("openrouter");
  });
});
```

**Async tests with cleanup:**
```typescript
const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});
```

**Long-running async tests use explicit timeout (third argument to `it`):**
```typescript
it(
  "applies an inserted earlier migration",
  async () => { ... },
  20_000,  // 20 second timeout
);
```

**Conditional describe for environment-dependent tests:**
```typescript
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

describeEmbeddedPostgres("applyPendingMigrations", () => { ... });
```

## UI Component Tests

**Environment override (per file):**
```typescript
// @vitest-environment jsdom
```
Placed at the top of component test files to override the default `node` environment.

**Render pattern (raw React DOM, no testing-library):**
```typescript
function renderWithQueryClient(node: ReactNode, container: HTMLDivElement) {
  const root = createRoot(container);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
  });
  return { root, queryClient };
}
```

**Setup/teardown:**
```typescript
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  mockApi.list.mockReset();
  mockApi.list.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
  container.remove();
});
```

**Async assertion retry helper (custom, no testing-library):**
```typescript
async function waitForAssertion(assertion: () => void, attempts = 20) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { assertion(); return; }
    catch (error) { lastError = error; await flush(); }
  }
  throw lastError;
}
```

**React `act` wrapping:**
```typescript
await act(async () => { await Promise.resolve(); });
```

**Note:** The UI does NOT use `@testing-library/react`. It uses `react-dom/client` directly with `createRoot`, manual DOM traversal (`container.querySelector`, `document.body.querySelectorAll`), and native DOM event dispatching.

## Mocking

**Framework:** Vitest's built-in `vi.mock` and `vi.fn()`

**Module mock pattern:**
```typescript
// Hoist mock state so it can be referenced inside vi.mock factories
const companyState = vi.hoisted(() => ({ selectedCompanyId: "company-1" }));
const mockIssuesApi = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => companyState,
}));

vi.mock("../api/issues", () => ({
  issuesApi: mockIssuesApi,
}));
```

**Child component mocking:**
```typescript
vi.mock("./IssueRow", () => ({
  IssueRow: ({ issue }: { issue: Issue }) => (
    <div data-testid="issue-row"><span>{issue.title}</span></div>
  ),
}));
```

**Timer mocking:**
```typescript
vi.useFakeTimers();
vi.advanceTimersByTime(149);
vi.useRealTimers(); // restored in afterEach
```

**What to Mock:**
- API modules (`../api/issues`, `../api/auth`)
- Context hooks (`../context/CompanyContext`)
- Complex child components that are tested separately

**What NOT to Mock:**
- The module under test
- Utility/lib functions used by the component (test those indirectly)

## Fixtures and Factories

**Factory pattern for test entities:**
```typescript
function createIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "issue-1",
    identifier: "PAP-1",
    companyId: "company-1",
    title: "Issue title",
    status: "todo",
    priority: "medium",
    createdAt: new Date("2026-04-07T00:00:00.000Z"),
    updatedAt: new Date("2026-04-07T00:00:00.000Z"),
    // ... all required fields with defaults
    ...overrides,
  };
}
```

**Shared fixture files:**
- `ui/src/fixtures/issueChatUxFixtures.ts` — chat UX test data
- `ui/src/fixtures/runTranscriptFixtures.ts` — run transcript test data

**Location:**
- Inline factory functions defined at the top of test files
- Shared fixtures in `ui/src/fixtures/`

## E2E Testing

**Framework:** Playwright with Chromium only

**Config** (`tests/e2e/playwright.config.ts`):
- `timeout: 60_000` per test
- `retries: 0`
- Screenshots on failure only
- Trace on first retry
- `webServer` directive starts `pnpm paperclipai run` on port 3199 before tests
- `reuseExistingServer: !process.env.CI` (local dev reuses; CI always starts fresh)

**Pattern:**
```typescript
import { test, expect } from "@playwright/test";

test.describe("Onboarding wizard", () => {
  test("completes full wizard flow", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page.locator("h3", { hasText: "Name your company" })).toBeVisible({ timeout: 5_000 });
    // ...
  });
});
```

**LLM gating:**
```typescript
const SKIP_LLM = process.env.PAPERCLIP_E2E_SKIP_LLM !== "false";
// CI sets PAPERCLIP_E2E_SKIP_LLM=true — no real LLM calls in CI
```

**Artifacts:**
- Playwright report uploaded to GitHub Actions artifact `playwright-report` (14-day retention)
- Output directory: `tests/e2e/playwright-report/` and `tests/e2e/test-results/`

## Coverage

**Requirements:** None enforced — no coverage thresholds configured

**View Coverage:**
```bash
# No dedicated coverage script; use vitest directly:
pnpm vitest run --coverage
```

## CI Integration

**PR workflow** (`.github/workflows/pr.yml`):
- `verify` job (needs `policy` to pass):
  1. `pnpm -r typecheck`
  2. `pnpm test:run` (all Vitest projects)
  3. `pnpm build`
  4. Release canary dry run
- `e2e` job (needs `policy` to pass, runs in parallel with `verify`):
  1. `pnpm build`
  2. Playwright install (Chromium only)
  3. Generate Paperclip config for `local_trusted` mode
  4. `pnpm run test:e2e` with `PAPERCLIP_E2E_SKIP_LLM=true`
- Timeout: `verify` = 20 min, `e2e` = 30 min
- Concurrency: cancel-in-progress for same PR number

---

*Testing analysis: 2026-04-13*
