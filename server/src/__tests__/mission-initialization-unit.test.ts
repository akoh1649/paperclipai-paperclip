import { beforeEach, describe, expect, it, vi } from "vitest";
import { MISSION_REQUIRED_DOCUMENT_KEYS } from "@paperclipai/shared";

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn(),
  update: vi.fn(),
  addComment: vi.fn(),
}));

const mockDocumentService = vi.hoisted(() => ({
  listIssueDocuments: vi.fn(),
  getIssueDocumentByKey: vi.fn(),
  upsertIssueDocument: vi.fn(),
}));

vi.mock("../services/issues.js", () => ({
  issueService: () => mockIssueService,
}));

vi.mock("../services/documents.js", () => ({
  documentService: () => mockDocumentService,
}));

const { missionInitializationService } = await import("../services/mission-initialization.js");

const issue = {
  id: "issue-1",
  companyId: "company-1",
  projectId: null,
  projectWorkspaceId: null,
  goalId: null,
  parentId: null,
  title: "Mission candidate",
  description: "Build the mission flow",
  status: "in_progress",
  priority: "medium",
  assigneeAgentId: "agent-1",
  assigneeUserId: null,
  checkoutRunId: "run-1",
  executionRunId: "run-1",
  executionAgentNameKey: null,
  executionLockedAt: null,
  createdByAgentId: null,
  createdByUserId: null,
  issueNumber: 1532,
  identifier: "PAP-1532",
  originKind: "manual",
  originId: null,
  originRunId: null,
  requestDepth: 0,
  billingCode: null,
  assigneeAdapterOverrides: null,
  executionWorkspaceId: null,
  executionWorkspacePreference: null,
  executionWorkspaceSettings: null,
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  hiddenAt: null,
  createdAt: new Date("2026-04-17T00:00:00.000Z"),
  updatedAt: new Date("2026-04-17T00:00:00.000Z"),
};

function doc(key: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `doc-${key}`,
    companyId: issue.companyId,
    issueId: issue.id,
    key,
    title: key,
    format: "markdown",
    body: `# ${key}`,
    latestRevisionId: `rev-${key}`,
    latestRevisionNumber: 1,
    createdByAgentId: null,
    createdByUserId: null,
    updatedByAgentId: null,
    updatedByUserId: null,
    createdAt: new Date("2026-04-17T00:00:00.000Z"),
    updatedAt: new Date("2026-04-17T00:00:00.000Z"),
    ...overrides,
  };
}

describe("missionInitializationService unit behavior", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockIssueService.getById.mockResolvedValue(issue);
    mockIssueService.update.mockResolvedValue({
      ...issue,
      originKind: "mission",
      originId: "PAP-1532",
      billingCode: "mission:PAP-1532",
    });
    mockIssueService.addComment.mockResolvedValue({ id: "comment-1" });
    mockDocumentService.listIssueDocuments.mockResolvedValue([]);
    mockDocumentService.getIssueDocumentByKey.mockResolvedValue(null);
    mockDocumentService.upsertIssueDocument.mockImplementation(async (input: { key: string }) => ({
      created: true,
      document: doc(input.key),
    }));
  });

  it("creates missing required documents and records mission metadata once", async () => {
    const result = await missionInitializationService({} as any).initialize(issue.id, {
      actor: { agentId: "agent-1", runId: "run-1" },
    });

    expect(result.createdDocumentKeys).toEqual([...MISSION_REQUIRED_DOCUMENT_KEYS]);
    expect(mockDocumentService.upsertIssueDocument).toHaveBeenCalledTimes(MISSION_REQUIRED_DOCUMENT_KEYS.length);
    expect(mockIssueService.update).toHaveBeenCalledWith(issue.id, expect.objectContaining({
      originKind: "mission",
      originId: "PAP-1532",
      billingCode: "mission:PAP-1532",
    }));
    expect(mockIssueService.addComment).toHaveBeenCalledTimes(1);

    vi.resetAllMocks();
    mockIssueService.getById.mockResolvedValue({
      ...issue,
      originKind: "mission",
      originId: "PAP-1532",
      billingCode: "mission:PAP-1532",
    });
    mockDocumentService.listIssueDocuments.mockResolvedValue(
      MISSION_REQUIRED_DOCUMENT_KEYS.map((key) => doc(key)),
    );
    mockDocumentService.getIssueDocumentByKey.mockImplementation(async (_issueId: string, key: string) => doc(key));

    const second = await missionInitializationService({} as any).initialize(issue.id, {
      actor: { agentId: "agent-1", runId: "run-2" },
    });

    expect(second.createdDocumentKeys).toEqual([]);
    expect(second.existingDocumentKeys).toEqual([...MISSION_REQUIRED_DOCUMENT_KEYS]);
    expect(second.metadataUpdated).toBe(false);
    expect(second.commentId).toBeNull();
    expect(mockDocumentService.upsertIssueDocument).not.toHaveBeenCalled();
    expect(mockIssueService.update).not.toHaveBeenCalled();
    expect(mockIssueService.addComment).not.toHaveBeenCalled();
  });

  it("preserves existing user-authored documents without revising them", async () => {
    const existingContract = doc("validation-contract", { body: "# Custom contract" });
    mockDocumentService.listIssueDocuments.mockResolvedValue([existingContract]);
    mockDocumentService.getIssueDocumentByKey.mockImplementation(async (_issueId: string, key: string) => (
      key === "validation-contract" ? existingContract : null
    ));

    const result = await missionInitializationService({} as any).initialize(issue.id, {
      actor: { agentId: "agent-1", runId: "run-1" },
    });

    expect(result.existingDocumentKeys).toContain("validation-contract");
    expect(result.createdDocumentKeys).not.toContain("validation-contract");
    expect(mockDocumentService.upsertIssueDocument).not.toHaveBeenCalledWith(
      expect.objectContaining({ key: "validation-contract" }),
    );
  });
});
