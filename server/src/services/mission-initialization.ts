import type { Db } from "@paperclipai/db";
import {
  MISSION_REQUIRED_DOCUMENT_KEYS,
  type MissionRequiredDocumentKey,
} from "@paperclipai/shared";
import { HttpError } from "../errors.js";
import { documentService } from "./documents.js";
import { issueService } from "./issues.js";

type ActorInfo = {
  agentId?: string | null;
  userId?: string | null;
  runId?: string | null;
};

type MissionIssue = {
  id: string;
  companyId: string;
  identifier?: string | null;
  title: string;
  description?: string | null;
  status: string;
  originKind?: string | null;
  originId?: string | null;
  billingCode?: string | null;
};

type ExistingDocument = {
  id: string;
  latestRevisionNumber: number;
};

export interface MissionInitializationDocumentResult {
  key: MissionRequiredDocumentKey;
  documentId: string;
  revisionNumber: number;
  created: boolean;
}

export interface MissionInitializationResult {
  issueId: string;
  identifier: string | null;
  originKind: string | null;
  originId: string | null;
  billingCode: string | null;
  metadataUpdated: boolean;
  createdDocumentKeys: MissionRequiredDocumentKey[];
  existingDocumentKeys: MissionRequiredDocumentKey[];
  documents: MissionInitializationDocumentResult[];
  commentId: string | null;
}

function issueReference(issue: Pick<MissionIssue, "identifier" | "id">) {
  if (!issue.identifier) return `\`${issue.id}\``;
  const prefix = issue.identifier.split("-")[0]?.toUpperCase();
  return prefix ? `[${issue.identifier}](/${prefix}/issues/${issue.identifier})` : `\`${issue.id}\``;
}

function missionBillingCode(issue: Pick<MissionIssue, "identifier" | "id" | "billingCode">) {
  return issue.billingCode ?? `mission:${issue.identifier ?? issue.id}`;
}

function missionOriginId(issue: Pick<MissionIssue, "identifier" | "id" | "originId">) {
  return issue.originId ?? issue.identifier ?? issue.id;
}

function defaultMissionDocument(input: {
  issue: MissionIssue;
  key: MissionRequiredDocumentKey;
}): { title: string; body: string } {
  const { issue, key } = input;
  const ref = issueReference(issue);
  const issueTitle = issue.title.trim();
  switch (key) {
    case "plan":
      return {
        title: "Plan",
        body: [
          "# Plan",
          "",
          `Mission issue: ${ref}`,
          "",
          "## Objective",
          "",
          issue.description?.trim() || issueTitle,
          "",
          "## Milestones",
          "",
          "- TODO: Decompose the mission into bounded milestones.",
          "",
          "## Verification",
          "",
          "- TODO: Link validation assertions from `validation-contract` before implementation starts.",
        ].join("\n"),
      };
    case "mission-brief":
      return {
        title: "Mission Brief",
        body: [
          "# Mission Brief",
          "",
          `Mission issue: ${ref}`,
          `Current status: \`${issue.status}\``,
          `Billing code: \`${missionBillingCode(issue)}\``,
          "",
          "## Goal",
          "",
          issueTitle,
          "",
          "## Scope",
          "",
          "- TODO: Define the work that is in scope.",
          "",
          "## Non-Goals",
          "",
          "- TODO: Define what this mission will not do.",
          "",
          "## Assumptions",
          "",
          "- TODO: Record assumptions that need validation.",
        ].join("\n"),
      };
    case "validation-contract":
      return {
        title: "Validation Contract",
        body: [
          "# Validation Contract",
          "",
          "Define finite, testable assertions before feature decomposition.",
          "",
          "```json",
          JSON.stringify({ assertions: [] }, null, 2),
          "```",
        ].join("\n"),
      };
    case "features":
      return {
        title: "Features",
        body: [
          "# Features",
          "",
          "Group implementation features by milestone after the validation contract is written.",
          "",
          "```json",
          JSON.stringify({ milestones: [] }, null, 2),
          "```",
        ].join("\n"),
      };
    case "worker-guidelines":
      return {
        title: "Worker Guidelines",
        body: [
          "# Worker Guidelines",
          "",
          "- Work only on the assigned child issue.",
          "- Preserve normal checkout, ownership, testing, and handoff rules.",
          "- Do not decide final correctness; validators judge against the validation contract.",
          "- Leave concise evidence in comments, work products, or attachments.",
        ].join("\n"),
      };
    case "services":
      return {
        title: "Services",
        body: [
          "# Services",
          "",
          "## Commands",
          "",
          "- TODO: Document local server, test, and preview commands.",
          "",
          "## Environment",
          "",
          "- TODO: Document required accounts, seeded data, secrets, and setup costs.",
        ].join("\n"),
      };
    case "knowledge-base":
      return {
        title: "Knowledge Base",
        body: [
          "# Knowledge Base",
          "",
          "- TODO: Add concise discoveries that future workers or validators need.",
        ].join("\n"),
      };
    case "decision-log":
      return {
        title: "Decision Log",
        body: [
          "# Decision Log",
          "",
          "- Mission initialized from existing issue state.",
        ].join("\n"),
      };
  }
}

function isDocumentConflict(error: unknown) {
  return error instanceof HttpError && error.status === 409;
}

export function missionInitializationService(db: Db) {
  const issuesSvc = issueService(db);
  const documentsSvc = documentService(db);

  async function createDocumentIfMissing(input: {
    issue: MissionIssue;
    key: MissionRequiredDocumentKey;
    existingByKey: Map<string, ExistingDocument>;
    actor: ActorInfo;
  }): Promise<MissionInitializationDocumentResult> {
    const existing = input.existingByKey.get(input.key);
    if (existing) {
      return {
        key: input.key,
        documentId: existing.id,
        revisionNumber: existing.latestRevisionNumber,
        created: false,
      };
    }

    const template = defaultMissionDocument({ issue: input.issue, key: input.key });
    try {
      const created = await documentsSvc.upsertIssueDocument({
        issueId: input.issue.id,
        key: input.key,
        title: template.title,
        format: "markdown",
        body: template.body,
        changeSummary: "Initialize mission document bundle",
        baseRevisionId: null,
        createdByAgentId: input.actor.agentId ?? null,
        createdByUserId: input.actor.userId ?? null,
        createdByRunId: input.actor.runId ?? null,
      });
      return {
        key: input.key,
        documentId: created.document.id,
        revisionNumber: created.document.latestRevisionNumber,
        created: true,
      };
    } catch (error) {
      if (!isDocumentConflict(error)) throw error;
      const concurrent = await documentsSvc.getIssueDocumentByKey(input.issue.id, input.key);
      if (!concurrent) throw error;
      return {
        key: input.key,
        documentId: concurrent.id,
        revisionNumber: concurrent.latestRevisionNumber,
        created: false,
      };
    }
  }

  return {
    initialize: async (
      issueId: string,
      input: {
        actor: ActorInfo;
        addAuditComment?: boolean;
      },
    ): Promise<MissionInitializationResult> => {
      const issue = await issuesSvc.getById(issueId);
      if (!issue) throw new HttpError(404, "Issue not found");

      const currentDocuments = await documentsSvc.listIssueDocuments(issue.id);
      const existingByKey = new Map(
        await Promise.all(
          currentDocuments
            .filter((document) => (MISSION_REQUIRED_DOCUMENT_KEYS as readonly string[]).includes(document.key))
            .map(async (document) => [
              document.key,
              await documentsSvc.getIssueDocumentByKey(issue.id, document.key),
            ] as const),
        ).then((entries) => entries.flatMap(([key, document]) => (document ? [[key, document] as const] : []))),
      );

      const documents: MissionInitializationDocumentResult[] = [];
      for (const key of MISSION_REQUIRED_DOCUMENT_KEYS) {
        documents.push(await createDocumentIfMissing({ issue, key, existingByKey, actor: input.actor }));
      }

      const createdDocumentKeys = documents.filter((document) => document.created).map((document) => document.key);
      const existingDocumentKeys = documents.filter((document) => !document.created).map((document) => document.key);
      const nextOriginKind = "mission";
      const nextOriginId = missionOriginId(issue);
      const nextBillingCode = missionBillingCode(issue);
      const metadataUpdated =
        issue.originKind !== nextOriginKind ||
        issue.originId !== nextOriginId ||
        issue.billingCode !== nextBillingCode;

      const updatedIssue = metadataUpdated
        ? await issuesSvc.update(issue.id, {
          originKind: nextOriginKind,
          originId: nextOriginId,
          billingCode: nextBillingCode,
          actorAgentId: input.actor.agentId ?? null,
          actorUserId: input.actor.userId ?? null,
        })
        : issue;
      if (!updatedIssue) throw new HttpError(404, "Issue not found");

      let commentId: string | null = null;
      if (input.addAuditComment !== false && (metadataUpdated || createdDocumentKeys.length > 0)) {
        const comment = await issuesSvc.addComment(
          issue.id,
          [
            "Mission initialized",
            "",
            `- Created mission documents: ${createdDocumentKeys.length > 0 ? createdDocumentKeys.map((key) => `\`${key}\``).join(", ") : "none"}.`,
            `- Preserved existing mission documents: ${existingDocumentKeys.length > 0 ? existingDocumentKeys.map((key) => `\`${key}\``).join(", ") : "none"}.`,
            `- Origin metadata: \`${nextOriginKind}:${nextOriginId}\`.`,
            `- Billing code: \`${nextBillingCode}\`.`,
          ].join("\n"),
          {
            agentId: input.actor.agentId ?? undefined,
            userId: input.actor.userId ?? undefined,
            runId: input.actor.runId ?? null,
          },
        );
        commentId = comment.id;
      }

      return {
        issueId: updatedIssue.id,
        identifier: updatedIssue.identifier ?? null,
        originKind: updatedIssue.originKind ?? null,
        originId: updatedIssue.originId ?? null,
        billingCode: updatedIssue.billingCode ?? null,
        metadataUpdated,
        createdDocumentKeys,
        existingDocumentKeys,
        documents,
        commentId,
      };
    },
  };
}
