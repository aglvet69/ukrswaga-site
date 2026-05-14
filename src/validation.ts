import { z } from "zod";

export const SQUAD_APP_ID = "393380";

export const connectUrlRegex = /^steam:\/\/joinlobby\/393380\/(\d+)(?:\/\d+)?\/?$/;

export function parseConnectUrl(value: string): { connectUrl: string; lobbyId: string } | null {
  const connectUrl = value.trim();
  const match = connectUrlRegex.exec(connectUrl);

  if (!match) {
    return null;
  }

  return {
    connectUrl,
    lobbyId: match[1]
  };
}

export const adminConnectBodySchema = z.object({
  connectUrl: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => connectUrlRegex.test(value), {
      message: "connectUrl must match steam://joinlobby/393380/LOBBY_ID"
    }),
  source: z.string().trim().min(1).max(120).optional()
});

export const connectRecordSchema = z.object({
  connectUrl: z.string().refine((value) => connectUrlRegex.test(value), {
    message: "Stored connectUrl is invalid."
  }),
  lobbyId: z.string().regex(/^\d+$/),
  appId: z.string().regex(/^\d+$/),
  fallbackIp: z.string().min(1),
  updatedAt: z.string().datetime(),
  source: z.string().trim().min(1).default("unknown")
});

export type ConnectRecord = z.infer<typeof connectRecordSchema>;
