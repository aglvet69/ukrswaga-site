import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { BattleMetricsService } from "./battlemetrics.js";
import type { AppConfig } from "./config.js";
import type { ConnectStore } from "./connectStore.js";
import { adminConnectBodySchema } from "./validation.js";

interface RouteDependencies {
  config: AppConfig;
  battleMetricsService: BattleMetricsService;
  connectStore: ConnectStore;
}

export async function registerRoutes(app: FastifyInstance, deps: RouteDependencies): Promise<void> {
  app.get("/", async (_request, reply) => {
    reply.type("text/html; charset=utf-8");
    return reply.sendFile("index.html");
  });

  app.get("/join", async (_request, reply) => {
    reply.type("text/html; charset=utf-8");
    return reply.sendFile("join.html");
  });

  app.get("/api/status", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");

    const result = await deps.battleMetricsService.getStatus();

    if (!result.ok) {
      reply.status(502);
    }

    return result;
  });

  app.get("/api/connect", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");

    try {
      const record = await deps.connectStore.read();

      if (!record) {
        return {
          ok: false,
          connectUrl: null,
          lobbyId: null,
          appId: deps.config.squadAppId,
          fallbackIp: deps.config.fallbackServerIp,
          updatedAt: null,
          source: null
        };
      }

      return {
        ok: true,
        connectUrl: record.connectUrl,
        lobbyId: record.lobbyId,
        appId: record.appId,
        fallbackIp: record.fallbackIp,
        updatedAt: record.updatedAt,
        source: record.source
      };
    } catch (error) {
      app.log.error({ err: error }, "Failed to read connect.json.");
      reply.status(500);

      return {
        ok: false,
        error: "Failed to read current connect URL.",
        connectUrl: null,
        lobbyId: null,
        appId: deps.config.squadAppId,
        fallbackIp: deps.config.fallbackServerIp,
        updatedAt: null,
        source: null
      };
    }
  });

  app.post("/api/admin/connect-url", async (request, reply) => {
    reply.header("Cache-Control", "no-store");

    if (!isAuthorized(request.headers.authorization, deps.config.adminToken)) {
      reply.status(401);
      return {
        ok: false,
        error: "Unauthorized."
      };
    }

    const parsedBody = adminConnectBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.status(400);
      return {
        ok: false,
        error: "Invalid request body.",
        details: parsedBody.error.flatten()
      };
    }

    try {
      const record = await deps.connectStore.write({
        connectUrl: parsedBody.data.connectUrl,
        source: parsedBody.data.source ?? "admin-api"
      });

      return {
        ok: true,
        connectUrl: record.connectUrl,
        lobbyId: record.lobbyId,
        appId: record.appId,
        fallbackIp: record.fallbackIp,
        updatedAt: record.updatedAt,
        source: record.source
      };
    } catch (error) {
      app.log.error({ err: error }, "Failed to persist connect URL.");
      reply.status(500);
      return {
        ok: false,
        error: "Failed to update connect URL."
      };
    }
  });
}

function isAuthorized(headerValue: string | undefined, expectedToken: string): boolean {
  if (!headerValue?.startsWith("Bearer ")) {
    return false;
  }

  const providedToken = headerValue.slice("Bearer ".length);
  const expectedBuffer = Buffer.from(expectedToken, "utf8");
  const providedBuffer = Buffer.from(providedToken, "utf8");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}
