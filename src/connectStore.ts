import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AppConfig } from "./config.js";
import { connectRecordSchema, parseConnectUrl, type ConnectRecord } from "./validation.js";

export interface ConnectStore {
  filePath: string;
  ensureDataDir: () => Promise<void>;
  read: () => Promise<ConnectRecord | null>;
  write: (input: { connectUrl: string; source?: string }) => Promise<ConnectRecord>;
}

export function createConnectStore(config: AppConfig): ConnectStore {
  const filePath = join(config.dataDir, "connect.json");

  async function ensureDataDir(): Promise<void> {
    await mkdir(config.dataDir, { recursive: true });
  }

  async function read(): Promise<ConnectRecord | null> {
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      return connectRecordSchema.parse(parsed);
    } catch (error) {
      if (isNodeError(error, "ENOENT")) {
        return null;
      }

      throw error;
    }
  }

  async function write(input: { connectUrl: string; source?: string }): Promise<ConnectRecord> {
    const parsedConnectUrl = parseConnectUrl(input.connectUrl);

    if (!parsedConnectUrl) {
      throw new Error("Invalid steam joinlobby URL.");
    }

    const record: ConnectRecord = {
      connectUrl: parsedConnectUrl.connectUrl,
      lobbyId: parsedConnectUrl.lobbyId,
      appId: config.squadAppId,
      fallbackIp: config.fallbackServerIp,
      updatedAt: new Date().toISOString(),
      source: input.source?.trim() || "admin-api"
    };

    await ensureDataDir();

    const tempFilePath = `${filePath}.tmp`;
    await writeFile(tempFilePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    await rename(tempFilePath, filePath);

    return record;
  }

  return {
    filePath,
    ensureDataDir,
    read,
    write
  };
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
