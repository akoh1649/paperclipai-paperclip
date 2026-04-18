import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const issueId = "11111111-1111-4111-8111-111111111111";
const companyId = "22222222-2222-4222-8222-222222222222";
const agentId = "33333333-3333-4333-8333-333333333333";

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn(),
  assertCheckoutOwner: vi.fn(async () => ({ ok: true })),
}));

const mockMissionInitializationService = vi.hoisted(() => ({
  initialize: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  hasPermission: vi.fn(async () => false),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(async () => null),
}));

const mockLogActivity = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("../services/issues.js", () => ({
  issueService: () => mockIssueService,
}));

vi.mock("../services/mission-initialization.js", () => ({
  missionInitializationService: () => mockMissionInitializationService,
}));

vi.mock("../services/access.js", () => ({
  accessService: () => mockAccessService,
}));

vi.mock("../services/agents.js", () => ({
  agentService: () => mockAgentService,
}));

vi.mock("../services/activity-log.js", () => ({
  logActivity: mockLogActivity,
}));

function makeIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: issueId,
    companyId,
    title: "Mission candidate",
    status: "in_progress",
    assigneeAgentId: agentId,
    identifier: "PAP-1532",
    ...overrides,
  };
}

function makeInitResult(overrides: Record<string, unknown> = {}) {
  return {
    issueId,
    identifier: "PAP-1532",
    originKind: "mission",
    originId: "PAP-1532",
    billingCode: "mission:PAP-1532",
    metadataUpdated: true,
    createdDocumentKeys: ["mission-brief"],
    existingDocumentKeys: ["plan"],
    documents: [],
    commentId: "comment-1",
    ...overrides,
  };
}

async function createApp(actor: Record<string, unknown>) {
  const [{ missionRoutes }, { errorHandler }] = await Promise.all([
    vi.importActual<typeof import("../routes/missions.js")>("../routes/missions.js"),
    vi.importActual<typeof import("../middleware/index.js")>("../middleware/index.js"),
  ]);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", missionRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("mission initialization route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockIssueService.getById.mockResolvedValue(makeIssue());
    mockIssueService.assertCheckoutOwner.mockResolvedValue({ ok: true });
    mockAccessService.hasPermission.mockResolvedValue(false);
    mockAgentService.getById.mockResolvedValue(null);
    mockMissionInitializationService.initialize.mockResolvedValue(makeInitResult());
  });

  it("initializes a board-accessible issue and logs mission activity", async () => {
    const res = await request(await createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: false,
    })).post(`/api/issues/${issueId}/mission/init`).send({});

    expect(res.status).toBe(201);
    expect(mockMissionInitializationService.initialize).toHaveBeenCalledWith(issueId, {
      actor: { agentId: null, userId: "board-user", runId: null },
    });
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "issue.mission_initialized",
        companyId,
        actorType: "user",
        actorId: "board-user",
        entityType: "issue",
        entityId: issueId,
        details: expect.objectContaining({
          createdDocumentKeys: ["mission-brief"],
          metadataUpdated: true,
          originKind: "mission",
        }),
      }),
    );
  });

  it("returns 200 for an idempotent initialization with no new mutation", async () => {
    mockMissionInitializationService.initialize.mockResolvedValue(makeInitResult({
      metadataUpdated: false,
      createdDocumentKeys: [],
      existingDocumentKeys: ["plan", "mission-brief"],
      commentId: null,
    }));

    const res = await request(await createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: false,
    })).post(`/api/issues/${issueId}/mission/init`).send({});

    expect(res.status).toBe(200);
    expect(res.body.createdDocumentKeys).toEqual([]);
    expect(mockLogActivity).not.toHaveBeenCalled();
  });

  it("rejects agent callers from another company before initialization", async () => {
    const res = await request(await createApp({
      type: "agent",
      agentId,
      companyId: "44444444-4444-4444-8444-444444444444",
      runId: "run-1",
    })).post(`/api/issues/${issueId}/mission/init`).send({});

    expect(res.status).toBe(403);
    expect(mockMissionInitializationService.initialize).not.toHaveBeenCalled();
  });

  it("requires task assignment permission for non-assignee agents", async () => {
    mockIssueService.getById.mockResolvedValue(makeIssue({ assigneeAgentId: "other-agent" }));
    mockAgentService.getById.mockResolvedValue({
      id: agentId,
      companyId,
      role: "engineer",
      permissions: {},
    });

    const res = await request(await createApp({
      type: "agent",
      agentId,
      companyId,
      runId: "run-1",
    })).post(`/api/issues/${issueId}/mission/init`).send({});

    expect(res.status).toBe(403);
    expect(mockMissionInitializationService.initialize).not.toHaveBeenCalled();
  });

  it("allows the assigned agent and verifies checkout ownership for in-progress work", async () => {
    const res = await request(await createApp({
      type: "agent",
      agentId,
      companyId,
      runId: "run-1",
    })).post(`/api/issues/${issueId}/mission/init`).send({});

    expect(res.status).toBe(201);
    expect(mockIssueService.assertCheckoutOwner).toHaveBeenCalledWith(issueId, agentId, "run-1");
    expect(mockMissionInitializationService.initialize).toHaveBeenCalledWith(issueId, {
      actor: { agentId, userId: null, runId: "run-1" },
    });
  });
});
