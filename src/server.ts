import fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { pathToFileURL } from "node:url";
import { BattleMetricsService } from "./battlemetrics.js";
import { loadConfig } from "./config.js";
import { createConnectStore } from "./connectStore.js";
import { registerRoutes } from "./routes.js";

export async function buildServer() {
  const config = loadConfig();

  const app = fastify({
    logger:
      config.nodeEnv === "production"
        ? { level: "info" }
        : {
            level: "debug",
            transport: {
              target: "pino-pretty",
              options: {
                colorize: true,
                ignore: "pid,hostname",
                translateTime: "SYS:standard"
              }
            }
          }
  });

  const connectStore = createConnectStore(config);
  await connectStore.ensureDataDir();

  await app.register(fastifyStatic, {
    root: config.publicDir,
    prefix: "/static/"
  });

  await registerRoutes(app, {
    config,
    battleMetricsService: new BattleMetricsService(config, app.log),
    connectStore
  });

  return app;
}

async function start(): Promise<void> {
  const config = loadConfig();
  const app = await buildServer();

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, "Shutting down UKRSWAGA Squad site.");

    try {
      await app.close();
    } finally {
      process.exit(0);
    }
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  try {
    await app.listen({
      host: config.host,
      port: config.port
    });

    app.log.info(
      {
        host: config.host,
        port: config.port,
        publicBaseUrl: config.publicBaseUrl
      },
      "UKRSWAGA Squad site started."
    );
  } catch (error) {
    app.log.error({ err: error }, "Failed to start server.");
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void start();
}
