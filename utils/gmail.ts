import { requireEnv } from "./env";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const OTP_SUBJECT = "Your Login OTP";

interface GmailMessage {
  id: string;
  snippet: string;
  internalDate: string;
  payload?: GmailPart;
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let cachedToken: string | undefined;
// messages already handed out, so a later lookup never reuses an older OTP / reset email
const consumedMessageIds = new Set<string>();

/**
 * Uses GMAIL_ACCESS_TOKEN. If GMAIL_REFRESH_TOKEN, GMAIL_CLIENT_ID and
 * GMAIL_CLIENT_SECRET are also set, a fresh access token is minted instead,
 * so runs keep working after the 1-hour access token expires.
 */
async function getAccessToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const { GMAIL_REFRESH_TOKEN, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET } = process.env;
  if (GMAIL_REFRESH_TOKEN && GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: GMAIL_CLIENT_ID,
        client_secret: GMAIL_CLIENT_SECRET,
        refresh_token: GMAIL_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) throw new Error(`Gmail token refresh failed: ${res.status} ${await res.text()}`);
    cachedToken = ((await res.json()) as { access_token: string }).access_token;
  } else {
    cachedToken = requireEnv("GMAIL_ACCESS_TOKEN");
  }
  return cachedToken;
}

async function gmailGet<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${await getAccessToken()}` },
  });
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

/** Email list API — returns the newest message matching the Gmail search query. */
async function getLatestMessageId(query: string): Promise<string | undefined> {
  const url = `${GMAIL_API}?maxResults=1&q=${encodeURIComponent(query)}`;
  const list = await gmailGet<{ messages?: { id: string }[] }>(url);
  return list.messages?.[0]?.id;
}

/** Read email API — GET /messages/{messageID}. */
async function readMessage(messageId: string): Promise<GmailMessage> {
  return gmailGet<GmailMessage>(`${GMAIL_API}/${messageId}`);
}

/**
 * Waits for the newest email matching `query` that arrived after `sentAfter`.
 * Waits `initialWaitMs` first, then polls a few more times in case delivery is slow.
 */
async function waitForLatestMessage(
  query: string,
  sentAfter: number,
  initialWaitMs = 10_000,
): Promise<GmailMessage> {
  await sleep(initialWaitMs);
  for (let attempt = 0; attempt < 6; attempt++) {
    const id = await getLatestMessageId(query);
    if (id && !consumedMessageIds.has(id)) {
      const message = await readMessage(id);
      // allow a little clock skew between this machine and Gmail
      if (Number(message.internalDate) >= sentAfter - 10_000) {
        consumedMessageIds.add(id);
        return message;
      }
    }
    await sleep(5_000);
  }
  throw new Error(`No new email matching "${query}" arrived after ${new Date(sentAfter).toISOString()}`);
}

/** Reads the latest "Your Login OTP" email and extracts the 4-digit OTP from its snippet. */
export async function getLoginOtp(sentAfter: number): Promise<string> {
  const message = await waitForLatestMessage(`subject:"${OTP_SUBJECT}"`, sentAfter);
  const otp = message.snippet.match(/\b(\d{4})\b/)?.[1];
  if (!otp) throw new Error(`No 4-digit OTP found in snippet: "${message.snippet}"`);
  return otp;
}

function decodeBody(part: GmailPart | undefined): string {
  if (!part) return "";
  const own = part.body?.data ? Buffer.from(part.body.data, "base64url").toString("utf8") : "";
  return own + (part.parts ?? []).map(decodeBody).join("\n");
}

/** Reads the latest password-reset email sent to `recipient` and returns its reset link. */
export async function getPasswordResetLink(recipient: string, sentAfter: number): Promise<string> {
  const message = await waitForLatestMessage(`to:${recipient} -subject:"${OTP_SUBJECT}"`, sentAfter);
  const body = decodeBody(message.payload).replace(/&amp;/g, "&");
  const link = body.match(/https?:\/\/[^\s"'<>]*reset-password\?token=[^\s"'<>]+/)?.[0];
  if (!link) throw new Error("No reset-password link found in the latest reset email");
  return link;
}
