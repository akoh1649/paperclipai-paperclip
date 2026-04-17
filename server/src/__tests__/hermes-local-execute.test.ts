import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execute } from "hermes-paperclip-adapter/server";

/**
 * Write a fake hermes CLI that captures its environment and argv,
 * then exits cleanly with a session_id line (quiet-mode output).
 */
async function writeFakeHermesCommand(commandPath: string): Promise<void> {
  const script = `#!/usr/bin/env node
const fs = require("node:fs");

const capturePath = process.env.PAPERCLIP_TEST_CAPTURE_PATH;
const payload = {
  argv: process.argv.slice(2),
  env: {
    PAPERCLIP_AGENT_ID: process.env.PAPERCLIP_AGENT_ID || null,
    PAPERCLIP_COMPANY_ID: process.env.PAPERCLIP_COMPANY_ID || null,
    PAPERCLIP_API_URL: process.env.PAPERCLIP_API_URL || null,
    PAPERCLIP_API_KEY: process.env.PAPERCLIP_API_KEY || null,
    PAPERCLIP_RUN_ID: process.env.PAPERCLIP_RUN_ID || null,
  },
};
if (capturePath) {
  fs.writeFileSync(capturePath, JSON.stringify(payload), "utf8");
}

// Hermes quiet-mode output: response text then session_id line
console.log("I checked for work.");
console.log("");
console.log("session_id: test-session-001");
`;
  await fs.writeFile(commandPath, script, "utf8");
  await fs.chmod(commandPath, 0o755);
}

function makeContext(overrides: Record<string, unknown> = {}) {
  const logs: Array<{ stream: string; chunk: string }> = [];
  return {
    ctx: {
      runId: "run-123",
      agent: {
        id: "agent-aaa",
        companyId: "company-bbb",
        name: "TestAgent",
        adapterType: "hermes_local",
        adapterConfig: {
          hermesCommand: overrides.hermesCommand ?? "hermes",
          model: "test-model",
          timeoutSec: 10,
          ...(overrides.adapterConfig as Record<string, unknown> ?? {}),
        },
      },
      runtime: {
        sessionId: null,
        sessionParams: null,
        sessionDisplayId: null,
        taskKey: null,
      },
      config: {
        workspaceDir: overrides.cwd ?? "/tmp",
        ...(overrides.config as Record<string, unknown> ?? {}),
      },
      context: {},
      onLog: async (stream: string, chunk: string) => {
        logs.push({ stream, chunk });
      },
      authToken: overrides.authToken ?? undefined,
    },
    logs,
  };
}

describe("hermes_local adapter execute", () => {
  it("injects authToken as PAPERCLIP_API_KEY into the child process env", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hermes-test-"));
    const hermesPath = path.join(tmpDir, "hermes");
    const capturePath = path.join(tmpDir, "capture.json");
    await writeFakeHermesCommand(hermesPath);

    const { ctx } = makeContext({
      hermesCommand: hermesPath,
      authToken: "jwt-token-for-test",
      cwd: tmpDir,
    });

    // Set env var so the fake hermes knows where to write
    const origCapture = process.env.PAPERCLIP_TEST_CAPTURE_PATH;
    process.env.PAPERCLIP_TEST_CAPTURE_PATH = capturePath;

    try {
      const result = await execute(ctx as any);
      expect(result.exitCode).toBe(0);

      const captured = JSON.parse(await fs.readFile(capturePath, "utf8"));

      // Core assertion: PAPERCLIP_API_KEY must be the JWT auth token
      expect(captured.env.PAPERCLIP_API_KEY).toBe("jwt-token-for-test");

      // Other env vars should also be set
      expect(captured.env.PAPERCLIP_AGENT_ID).toBe("agent-aaa");
      expect(captured.env.PAPERCLIP_COMPANY_ID).toBe("company-bbb");
      expect(captured.env.PAPERCLIP_RUN_ID).toBe("run-123");
    } finally {
      if (origCapture !== undefined) {
        process.env.PAPERCLIP_TEST_CAPTURE_PATH = origCapture;
      } else {
        delete process.env.PAPERCLIP_TEST_CAPTURE_PATH;
      }
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("does not set PAPERCLIP_API_KEY when authToken is not provided", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hermes-test-"));
    const hermesPath = path.join(tmpDir, "hermes");
    const capturePath = path.join(tmpDir, "capture.json");
    await writeFakeHermesCommand(hermesPath);

    const { ctx } = makeContext({
      hermesCommand: hermesPath,
      // No authToken
      cwd: tmpDir,
    });

    const origCapture = process.env.PAPERCLIP_TEST_CAPTURE_PATH;
    process.env.PAPERCLIP_TEST_CAPTURE_PATH = capturePath;

    try {
      const result = await execute(ctx as any);
      expect(result.exitCode).toBe(0);

      const captured = JSON.parse(await fs.readFile(capturePath, "utf8"));

      // PAPERCLIP_API_KEY should not be set (or null)
      expect(captured.env.PAPERCLIP_API_KEY).toBeNull();
    } finally {
      if (origCapture !== undefined) {
        process.env.PAPERCLIP_TEST_CAPTURE_PATH = origCapture;
      } else {
        delete process.env.PAPERCLIP_TEST_CAPTURE_PATH;
      }
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("includes auth header in the prompt when authToken is provided", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hermes-test-"));
    const hermesPath = path.join(tmpDir, "hermes");
    const capturePath = path.join(tmpDir, "capture.json");

    // Modified fake that captures the -q prompt argument
    const script = `#!/usr/bin/env node
const fs = require("node:fs");
const capturePath = process.env.PAPERCLIP_TEST_CAPTURE_PATH;
const qIndex = process.argv.indexOf("-q");
const prompt = qIndex >= 0 ? process.argv[qIndex + 1] : null;
if (capturePath) {
  fs.writeFileSync(capturePath, JSON.stringify({ prompt }), "utf8");
}
console.log("Done.");
console.log("");
console.log("session_id: test-session-002");
`;
    await fs.writeFile(hermesPath, script, "utf8");
    await fs.chmod(hermesPath, 0o755);

    const { ctx } = makeContext({
      hermesCommand: hermesPath,
      authToken: "my-jwt-token",
      cwd: tmpDir,
    });

    const origCapture = process.env.PAPERCLIP_TEST_CAPTURE_PATH;
    process.env.PAPERCLIP_TEST_CAPTURE_PATH = capturePath;

    try {
      const result = await execute(ctx as any);
      expect(result.exitCode).toBe(0);

      const captured = JSON.parse(await fs.readFile(capturePath, "utf8"));

      // The prompt should contain the Authorization header in curl commands
      expect(captured.prompt).toContain('-H "Authorization: Bearer my-jwt-token"');
      // Auth headers should appear in the heartbeat curl commands
      expect(captured.prompt).toContain('curl -s "http://127.0.0.1:3100/api/companies/company-bbb/issues?assigneeAgentId=agent-aaa" -H "Authorization: Bearer my-jwt-token"');
    } finally {
      if (origCapture !== undefined) {
        process.env.PAPERCLIP_TEST_CAPTURE_PATH = origCapture;
      } else {
        delete process.env.PAPERCLIP_TEST_CAPTURE_PATH;
      }
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
