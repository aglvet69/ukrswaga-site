import { parseConnectUrl, SQUAD_APP_ID } from "../src/validation.js";

interface Options {
  profile: string;
  baseUrl: string;
  adminToken: string;
  keepReferrer: boolean;
}

const usage = `Usage:
  npm run update:lobby -- --profile <steam profile URL> --base-url <site base URL> --admin-token <token> [--keep-referrer]
`;

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const response = await fetch(options.profile, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "ukrswaga-squad-site/1.0"
    },
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Steam profile: HTTP ${response.status}.`);
  }

  const html = await response.text();
  const match = html.match(/steam:\/\/joinlobby\/393380\/\d+(?:\/\d+)?\/?/i);

  if (!match) {
    console.error(
      "Join the Squad server first, make Steam profile/game details public, then run again."
    );
    process.exitCode = 1;
    return;
  }

  const foundUrl = match[0];
  const connectUrl = options.keepReferrer ? foundUrl : normalizeConnectUrl(foundUrl);

  if (!parseConnectUrl(connectUrl)) {
    throw new Error(`Found joinlobby URL is invalid: ${connectUrl}`);
  }

  const adminResponse = await fetch(joinUrl(options.baseUrl, "/api/admin/connect-url"), {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.adminToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      connectUrl,
      source: "update-lobby-from-profile"
    })
  });

  const payload = (await adminResponse.json()) as Record<string, unknown>;

  if (!adminResponse.ok) {
    throw new Error(
      `Admin API rejected the update: ${typeof payload.error === "string" ? payload.error : adminResponse.status}`
    );
  }

  console.log(`Updated connect URL from Steam profile: ${connectUrl}`);
}

function normalizeConnectUrl(value: string): string {
  const parsed = parseConnectUrl(value);

  if (!parsed) {
    throw new Error(`Found joinlobby URL is invalid: ${value}`);
  }

  return `steam://joinlobby/${SQUAD_APP_ID}/${parsed.lobbyId}`;
}

function parseArgs(args: string[]): Options {
  const values = new Map<string, string>();
  let keepReferrer = false;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === "--keep-referrer") {
      keepReferrer = true;
      continue;
    }

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

  const profile = values.get("--profile");
  const baseUrl = values.get("--base-url");
  const adminToken = values.get("--admin-token");

  if (!profile || !baseUrl || !adminToken) {
    throw new Error(usage);
  }

  return {
    profile,
    baseUrl,
    adminToken,
    keepReferrer
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
