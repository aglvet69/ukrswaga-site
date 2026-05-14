import type { FastifyBaseLogger } from "fastify";
import type { AppConfig } from "./config.js";

export interface SquadServerStatus {
  id: string;
  name: string | null;
  ip: string | null;
  port: number | null;
  status: string | null;
  players: number | null;
  maxPlayers: number | null;
  queue: number | null;
  reservedQueue: number | null;
  queueLimit: number | null;
  map: string | null;
  gameMode: string | null;
  version: string | null;
  licensedServer: boolean | null;
  password: boolean | null;
  teamOne: string | null;
  teamTwo: string | null;
  updatedAt: string | null;
}

export type StatusResponse =
  | {
      ok: true;
      server: SquadServerStatus;
      source: "battlemetrics";
      cacheAgeMs: number;
      stale?: boolean;
    }
  | {
      ok: false;
      error: string;
      source: "battlemetrics";
      cacheAgeMs: null;
    };

interface CacheEntry {
  fetchedAt: number;
  server: SquadServerStatus;
}

export class BattleMetricsService {
  private cache: CacheEntry | null = null;
  private inFlight: Promise<StatusResponse> | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: FastifyBaseLogger
  ) {}

  async getStatus(): Promise<StatusResponse> {
    const now = Date.now();

    if (this.cache && now - this.cache.fetchedAt < this.config.battlemetricsCacheTtlMs) {
      return {
        ok: true,
        server: this.cache.server,
        source: "battlemetrics",
        cacheAgeMs: now - this.cache.fetchedAt
      };
    }

    if (!this.inFlight) {
      this.inFlight = this.refreshStatus();
    }

    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  private async refreshStatus(): Promise<StatusResponse> {
    const now = Date.now();

    try {
      const response = await fetch(
        `${this.config.battlemetricsApiBase}/servers/${this.config.battlemetricsServerId}`,
        {
          signal: AbortSignal.timeout(this.config.battlemetricsTimeoutMs),
          headers: {
            accept: "application/json",
            "user-agent": "ukrswaga-squad-site/1.0"
          }
        }
      );

      if (!response.ok) {
        throw new Error(`BattleMetrics returned HTTP ${response.status}.`);
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const server = mapBattleMetricsPayload(payload, this.config.battlemetricsServerId);

      this.cache = {
        fetchedAt: now,
        server
      };

      return {
        ok: true,
        server,
        source: "battlemetrics",
        cacheAgeMs: 0
      };
    } catch (error) {
      this.logger.warn(
        {
          err: error,
          battlemetricsServerId: this.config.battlemetricsServerId
        },
        "Failed to refresh BattleMetrics status."
      );

      if (this.cache) {
        return {
          ok: true,
          server: this.cache.server,
          source: "battlemetrics",
          cacheAgeMs: now - this.cache.fetchedAt,
          stale: true
        };
      }

      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown BattleMetrics error.",
        source: "battlemetrics",
        cacheAgeMs: null
      };
    }
  }
}

function mapBattleMetricsPayload(payload: Record<string, unknown>, fallbackId: string): SquadServerStatus {
  const data = asRecord(payload.data);
  const attributes = asRecord(data?.attributes);
  const details = asRecord(attributes?.details);

  return {
    id: toStringValue(data?.id) ?? fallbackId,
    name: toStringValue(attributes?.name),
    ip: toStringValue(attributes?.ip),
    port: toNumberValue(attributes?.port),
    status: toStringValue(attributes?.status),
    players: toNumberValue(attributes?.players),
    maxPlayers: toNumberValue(attributes?.maxPlayers),
    queue: toNumberValue(details?.squad_publicQueue),
    reservedQueue: toNumberValue(details?.squad_reservedQueue),
    queueLimit: toNumberValue(details?.squad_publicQueueLimit),
    map: toStringValue(details?.map),
    gameMode: toStringValue(details?.gameMode),
    version: toStringValue(details?.version),
    licensedServer: toBooleanValue(details?.licensedServer),
    password: toBooleanValue(details?.password),
    teamOne: toStringValue(details?.squad_teamOne),
    teamTwo: toStringValue(details?.squad_teamTwo),
    updatedAt: toStringValue(attributes?.updatedAt)
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function toStringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return null;
}

function toNumberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toBooleanValue(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true" || normalized === "1") {
      return true;
    }

    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }

  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }

    if (value === 0) {
      return false;
    }
  }

  return null;
}
