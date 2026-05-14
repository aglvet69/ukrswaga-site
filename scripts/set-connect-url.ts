import { parseConnectUrl } from "../src/validation.js";

interface Options {
  url: string;
  baseUrl: string;
  adminToken: string;
}

const usage = `Usage:
  npm run set:connect -- --url <steam://joinlobby/...> --base-url <site base URL> --admin-token <token>
`;

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const parsedConnectUrl = parseConnectUrl(options.url);

  if (!parsedConnectUrl) {
    throw new Error(
      "Invalid connect URL. Expected steam://joinlobby/393380/LOBBY_ID or steam://joinlobby/393380/LOBBY_ID/STEAM_ID64"
    );
  }

  const response = await fetch(joinUrl(options.baseUrl, "/api/admin/connect-url"), {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.adminToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      connectUrl: parsedConnectUrl.connectUrl,
      source: "set-connect-url"
    })
  });

  const payload = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(
      `Admin API rejected the update: ${typeof payload.error === "string" ? payload.error : response.status}`
    );
  }

  console.log(`Updated connect URL: ${parsedConnectUrl.connectUrl}`);
}

function parseArgs(args: string[]): Options {
  const values = new Map<string, string>();

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (!token.startsWith("--")) {
      throw new Error(usage);
    }

    const nextValue = args[index + 1];

    if (!nextValue || nextValue.startsWith("--")) {
      throw new Error(`Missing value for ${token}.\n\n${usage}`);
    }

    values.set(token, nextValue);
    index += 1;
  }

  const url = values.get("--url");
  const baseUrl = values.get("--base-url");
  const adminToken = values.get("--admin-token");

  if (!url || !baseUrl || !adminToken) {
    throw new Error(usage);
  }

  return {
    url,
    baseUrl,
    adminToken
  };
}

function joinUrl(baseUrl: string, path: string): string {
  return new URL(path, withTrailingSlash(baseUrl)).toString();
}

function withTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
