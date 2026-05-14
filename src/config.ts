import dotenv from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  PUBLIC_BASE_URL: z.string().url(),
  BATTLEMETRICS_SERVER_ID: z.string().min(1),
  BATTLEMETRICS_API_BASE: z.string().url().default("https://api.battlemetrics.com"),
  BM_CACHE_TTL_MS: z.coerce.number().int().positive().default(15000),
  BM_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  SQUAD_APP_ID: z.string().regex(/^\d+$/).default("393380"),
  FALLBACK_SERVER_IP: z.string().min(1),
  ADMIN_TOKEN: z.string().min(16),
  DATA_DIR: z.string().min(1).default("./data")
});

export interface AppConfig {
  nodeEnv: "development" | "production" | "test";
  host: string;
  port: number;
  publicBaseUrl: string;
  battlemetricsServerId: string;
  battlemetricsApiBase: string;
  battlemetricsCacheTtlMs: number;
  battlemetricsTimeoutMs: number;
  squadAppId: string;
  fallbackServerIp: string;
  adminToken: string;
  dataDir: string;
  publicDir: string;
}

let cachedConfig: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const parsed = envSchema.parse(process.env);

  cachedConfig = {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    publicBaseUrl: parsed.PUBLIC_BASE_URL,
    battlemetricsServerId: parsed.BATTLEMETRICS_SERVER_ID,
    battlemetricsApiBase: parsed.BATTLEMETRICS_API_BASE.replace(/\/+$/, ""),
    battlemetricsCacheTtlMs: parsed.BM_CACHE_TTL_MS,
    battlemetricsTimeoutMs: parsed.BM_TIMEOUT_MS,
    squadAppId: parsed.SQUAD_APP_ID,
    fallbackServerIp: parsed.FALLBACK_SERVER_IP,
    adminToken: parsed.ADMIN_TOKEN,
    dataDir: resolve(process.cwd(), parsed.DATA_DIR),
    publicDir: resolve(process.cwd(), "public")
  };

  return cachedConfig;
}
