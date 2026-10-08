#!/usr/bin/env node

// src/args.ts
function parseArgs(argv) {
  const flags = {};
  const positionals = [];
  let command = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
        continue;
      }
      const key = arg.slice(2);
      if (key.startsWith("no-")) {
        flags[key.slice(3)] = false;
        continue;
      }
      const next = argv[i + 1];
      if (next !== void 0 && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
      continue;
    }
    if (command === null) command = arg;
    else positionals.push(arg);
  }
  return { command, positionals, flags };
}
var flagString = (flags, key) => {
  const v = flags[key];
  return typeof v === "string" ? v : void 0;
};
var flagBool = (flags, key) => flags[key] === true;
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function parseDateFlag(flags, key, endOfDay = false) {
  const v = flagString(flags, key);
  if (v === void 0) return void 0;
  if (!DATE_RE.test(v))
    throw new Error(`--${key} \u306F YYYY-MM-DD \u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044`);
  const ms = Date.parse(`${v}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (Number.isNaN(ms)) throw new Error(`--${key} \u304C\u4E0D\u6B63\u306A\u65E5\u4ED8\u3067\u3059: ${v}`);
  return ms;
}

// src/commands/import.ts
import { createHash } from "crypto";
import { createInterface as createInterface2 } from "readline";

// src/claude-prices.ts
import { readFileSync } from "fs";

// ../shared/dist/ai-model-prices.mjs
var ANTHROPIC_MODEL_PRICES = {
  "claude-fable-5-1": {
    inputCostPerToken: 1e-5,
    outputCostPerToken: 5e-5,
    cachedInputCostPerToken: 25e-8
  },
  "claude-fable-5": {
    inputCostPerToken: 1e-5,
    outputCostPerToken: 5e-5,
    cachedInputCostPerToken: 1e-6
  },
  // Mythos は Fable と同じ基盤モデル (承認組織限定) で単価も同一。
  "claude-mythos-5-1": {
    inputCostPerToken: 1e-5,
    outputCostPerToken: 5e-5,
    cachedInputCostPerToken: 25e-8
  },
  "claude-mythos-5": {
    inputCostPerToken: 1e-5,
    outputCostPerToken: 5e-5,
    cachedInputCostPerToken: 1e-6
  },
  "claude-opus-5-5": {
    inputCostPerToken: 4e-6,
    outputCostPerToken: 2e-5,
    cachedInputCostPerToken: 2e-7
  },
  "claude-opus-5": {
    inputCostPerToken: 5e-6,
    outputCostPerToken: 25e-6,
    cachedInputCostPerToken: 5e-7
  },
  "claude-opus-4-8": {
    inputCostPerToken: 5e-6,
    outputCostPerToken: 25e-6,
    cachedInputCostPerToken: 5e-7
  },
  "claude-opus-4-7": {
    inputCostPerToken: 5e-6,
    outputCostPerToken: 25e-6,
    cachedInputCostPerToken: 5e-7
  },
  "claude-opus-4-6": {
    inputCostPerToken: 5e-6,
    outputCostPerToken: 25e-6,
    cachedInputCostPerToken: 5e-7
  },
  "claude-sonnet-5-5": {
    inputCostPerToken: 2e-6,
    outputCostPerToken: 1e-5,
    cachedInputCostPerToken: 2e-7
  },
  "claude-sonnet-5": {
    inputCostPerToken: 2e-6,
    outputCostPerToken: 1e-5,
    cachedInputCostPerToken: 2e-7
  },
  "claude-sonnet-4-6": {
    inputCostPerToken: 3e-6,
    outputCostPerToken: 15e-6,
    cachedInputCostPerToken: 3e-7
  },
  "claude-haiku-4-5": {
    inputCostPerToken: 1e-6,
    outputCostPerToken: 5e-6,
    cachedInputCostPerToken: 1e-7
  },
  "claude-opus-4-5": {
    inputCostPerToken: 5e-6,
    outputCostPerToken: 25e-6,
    cachedInputCostPerToken: 5e-7
  },
  "claude-opus-4-1": {
    inputCostPerToken: 15e-6,
    outputCostPerToken: 75e-6,
    cachedInputCostPerToken: 15e-7
  },
  "claude-opus-4-0": {
    inputCostPerToken: 15e-6,
    outputCostPerToken: 75e-6,
    cachedInputCostPerToken: 15e-7
  },
  "claude-sonnet-4-5": {
    inputCostPerToken: 3e-6,
    outputCostPerToken: 15e-6,
    cachedInputCostPerToken: 3e-7
  },
  "claude-sonnet-4-0": {
    inputCostPerToken: 3e-6,
    outputCostPerToken: 15e-6,
    cachedInputCostPerToken: 3e-7
  },
  "claude-haiku-3-5": {
    inputCostPerToken: 8e-7,
    outputCostPerToken: 4e-6,
    cachedInputCostPerToken: 8e-8
  },
  // Claude Code の履歴インポート (packages/cli) で旧セッションに現れる 3.x 世代。
  // API 上の ID は claude-3-7-sonnet-YYYYMMDD だが、キーはこのテーブルの
  // <family>-<major>-<minor> 表記に揃える (normalizeAnthropicModelId が変換する)。
  "claude-sonnet-3-7": {
    inputCostPerToken: 3e-6,
    outputCostPerToken: 15e-6,
    cachedInputCostPerToken: 3e-7
  },
  "claude-sonnet-3-5": {
    inputCostPerToken: 3e-6,
    outputCostPerToken: 15e-6,
    cachedInputCostPerToken: 3e-7
  }
};
function normalizeAnthropicModelId(model) {
  const bare = model.trim().replace(/\[1m\]$/, "").replace(/-\d{8}$/, "").replace(/-latest$/, "");
  const legacy = /^claude-(\d+)-(\d+)-(opus|sonnet|haiku)$/.exec(bare);
  if (legacy) return `claude-${legacy[3]}-${legacy[1]}-${legacy[2]}`;
  const noMinor = /^claude-(opus|sonnet|haiku)-(\d+)$/.exec(bare);
  if (noMinor && `${bare}-0` in ANTHROPIC_MODEL_PRICES) return `${bare}-0`;
  return bare;
}
function findAnthropicPriceKey(table, model) {
  const normalized = normalizeAnthropicModelId(model);
  if (normalized in table) return normalized;
  const prefix = Object.keys(table).filter((key) => normalized.startsWith(`${key}-`)).sort((a, b) => b.length - a.length)[0];
  return prefix ?? null;
}

// src/jsonl.ts
import { createReadStream } from "fs";
import { readdir, stat } from "fs/promises";
import { join } from "path";
import { createInterface } from "readline";
var isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var asString = (v) => typeof v === "string" ? v : null;
var asNumber = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;
var asObject = (v) => isObject(v) ? v : null;
var asArray = (v) => Array.isArray(v) ? v : null;
async function* readJsonl(path) {
  const rl = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Number.POSITIVE_INFINITY
  });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (isObject(parsed)) yield parsed;
    } catch {
    }
  }
}
async function listJsonlFiles(dir, recursive) {
  const out = [];
  const walk = async (d) => {
    let entries;
    try {
      entries = await readdir(d);
    } catch {
      return;
    }
    for (const name of entries) {
      const p = join(d, name);
      let s;
      try {
        s = await stat(p);
      } catch {
        continue;
      }
      if (s.isDirectory()) {
        if (recursive) await walk(p);
      } else if (name.endsWith(".jsonl")) {
        out.push(p);
      }
    }
  };
  await walk(dir);
  return out.sort();
}
var parseTimestampMs = (v) => {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v < 1e12 ? v * 1e3 : v;
  }
  if (typeof v === "string") {
    const ms = Date.parse(v);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
};

// src/claude-prices.ts
var CACHE_WRITE_MULTIPLIER = 1.25;
var PER_MILLION = 1e6;
var perMillion = (perToken) => Math.round(perToken * PER_MILLION * 1e6) / 1e6;
var BUNDLED_CLAUDE_PRICES = Object.fromEntries(
  Object.entries(ANTHROPIC_MODEL_PRICES).map(([model, price]) => {
    const input = perMillion(price.inputCostPerToken);
    return [
      model,
      {
        input,
        output: perMillion(price.outputCostPerToken),
        cacheWrite: perMillion(
          price.inputCostPerToken * CACHE_WRITE_MULTIPLIER
        ),
        cacheRead: perMillion(price.cachedInputCostPerToken)
      }
    ];
  })
);
var PRICE_OVERRIDE_ENV = "SUPATEAM_CLAUDE_PRICES";
function loadPriceTable(env = process.env) {
  const path = env[PRICE_OVERRIDE_ENV];
  if (!path) return { table: { ...BUNDLED_CLAUDE_PRICES }, overridePath: null };
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (!isObject(parsed)) {
    throw new Error(`${PRICE_OVERRIDE_ENV}: JSON \u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u3067\u306F\u3042\u308A\u307E\u305B\u3093`);
  }
  const table = { ...BUNDLED_CLAUDE_PRICES };
  for (const [model, raw] of Object.entries(parsed)) {
    const o = asObject(raw);
    const input = asNumber(o?.input);
    const output = asNumber(o?.output);
    const cacheWrite = asNumber(o?.cacheWrite);
    const cacheRead = asNumber(o?.cacheRead);
    if (input === null || output === null || cacheWrite === null || cacheRead === null) {
      throw new Error(
        `${PRICE_OVERRIDE_ENV}: ${model} \u306F input/output/cacheWrite/cacheRead (USD per 1M tokens) \u3092\u6301\u3064\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`
      );
    }
    table[normalizeAnthropicModelId(model)] = {
      input,
      output,
      cacheWrite,
      cacheRead
    };
  }
  return { table, overridePath: path };
}
function resolvePrice(table, model) {
  const key = findAnthropicPriceKey(table, model);
  return key ? table[key] : null;
}
var computeCostUsd = (price, usage) => (usage.input * price.input + usage.output * price.output + usage.cacheWrite * price.cacheWrite + usage.cacheRead * price.cacheRead) / PER_MILLION;

// src/credentials.ts
import { mkdirSync, readFileSync as readFileSync2, writeFileSync } from "fs";
import { dirname } from "path";

// src/paths.ts
import { homedir } from "os";
import { join as join2 } from "path";
var supateamDir = (env = process.env) => env.SUPATEAM_HOME ?? join2(homedir(), ".supateam");
var credentialsPath = (env) => join2(supateamDir(env), "credentials.json");
var ledgerPath = (env) => join2(supateamDir(env), "import-state.json");
var claudeConfigDir = (env = process.env) => env.CLAUDE_CONFIG_DIR ?? join2(homedir(), ".claude");
var claudeJsonPath = (env = process.env) => env.CLAUDE_CONFIG_DIR ? join2(env.CLAUDE_CONFIG_DIR, ".claude.json") : join2(homedir(), ".claude.json");
var codexHome = (env = process.env) => env.CODEX_HOME ?? join2(homedir(), ".codex");

// src/credentials.ts
var DEFAULT_API_URL = "https://api.supateam.com";
var DEFAULT_APP_URL = "https://app.supateam.com";
function resolveUrls(flags, env = process.env) {
  const apiUrl = (flags.apiUrl ?? env.SUPATEAM_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, "");
  const appUrl = (flags.appUrl ?? env.SUPATEAM_APP_URL ?? DEFAULT_APP_URL).replace(/\/+$/, "");
  return { apiUrl, appUrl };
}
function saveCredentials(creds, env = process.env) {
  const path = credentialsPath(env);
  mkdirSync(dirname(path), { recursive: true, mode: 448 });
  writeFileSync(path, `${JSON.stringify(creds, null, 2)}
`, { mode: 384 });
  return path;
}
function loadCredentials(env = process.env) {
  let raw;
  try {
    raw = readFileSync2(credentialsPath(env), "utf8");
  } catch {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(parsed)) return null;
  const org = asObject(parsed.organization);
  const user = asObject(parsed.user);
  const token = asString(parsed.token);
  const apiUrl = asString(parsed.apiUrl);
  const appUrl = asString(parsed.appUrl);
  const expiresAt = asString(parsed.expiresAt);
  const orgId = asString(org?.id);
  const orgName = asString(org?.name);
  const userId = asString(user?.id);
  const userEmail = asString(user?.email);
  if (!token || !apiUrl || !appUrl || !expiresAt || !orgId || !orgName || !userId || !userEmail) {
    return null;
  }
  return {
    apiUrl,
    appUrl,
    token,
    expiresAt,
    organization: { id: orgId, name: orgName },
    user: { id: userId, email: userEmail, name: asString(user?.name) }
  };
}
var isExpired = (creds, now = Date.now()) => Date.parse(creds.expiresAt) <= now;
var NotLoggedInError = class extends Error {
  constructor(message = "\u30ED\u30B0\u30A4\u30F3\u3057\u3066\u3044\u307E\u305B\u3093\u3002`supateam login` \u3092\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044") {
    super(message);
    this.name = "NotLoggedInError";
  }
};
function requireCredentials(env) {
  const creds = loadCredentials(env);
  if (!creds) throw new NotLoggedInError();
  if (isExpired(creds)) {
    throw new NotLoggedInError(
      `\u30C8\u30FC\u30AF\u30F3\u306E\u6709\u52B9\u671F\u9650\u304C\u5207\u308C\u3066\u3044\u307E\u3059 (${creds.expiresAt})\u3002\`supateam login\` \u3067\u518D\u30ED\u30B0\u30A4\u30F3\u3057\u3066\u304F\u3060\u3055\u3044`
    );
  }
  return creds;
}

// src/http.ts
var MAX_ATTEMPTS = 5;
var BASE_DELAY_MS = 500;
var HttpError = class extends Error {
  constructor(status, body, message) {
    super(message ?? `HTTP ${status}: ${body.slice(0, 300)}`);
    this.status = status;
    this.body = body;
    this.name = "HttpError";
  }
  status;
  body;
};
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
var shouldRetry = (status) => status === 429 || status >= 500;
async function requestWithRetry(url, init, fetchImpl = fetch) {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetchImpl(url, init);
      if (!shouldRetry(res.status) || attempt === MAX_ATTEMPTS) return res;
      const retryAfter = Number(res.headers.get("retry-after") ?? "");
      await sleep(
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1e3 : BASE_DELAY_MS * 2 ** (attempt - 1)
      );
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS) throw error;
      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
function extractErrorMessage(body) {
  try {
    const parsed = JSON.parse(body);
    if (isObject(parsed)) {
      const msg = asString(parsed.error);
      if (msg) return msg;
    }
  } catch {
  }
  return body.slice(0, 300);
}
async function postJson(url, body, headers, fetchImpl) {
  const res = await requestWithRetry(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body)
    },
    fetchImpl
  );
  const text = await res.text();
  if (!res.ok) throw new HttpError(res.status, text, extractErrorMessage(text));
  return text ? JSON.parse(text) : {};
}
async function getJson(url, headers, fetchImpl) {
  const res = await requestWithRetry(url, { method: "GET", headers }, fetchImpl);
  const text = await res.text();
  if (!res.ok) throw new HttpError(res.status, text, extractErrorMessage(text));
  return JSON.parse(text);
}
var bearer = (token) => ({ Authorization: `Bearer ${token}` });

// src/ledger.ts
import { mkdirSync as mkdirSync2, readFileSync as readFileSync3, writeFileSync as writeFileSync2 } from "fs";
import { dirname as dirname2 } from "path";
var SOURCES = ["claude-code", "codex"];
var emptyLedger = () => ({
  "claude-code": {},
  codex: {},
  pendingComplete: { "claude-code": [], codex: [] },
  inFlight: { "claude-code": [], codex: [] }
});
function loadLedger(env = process.env) {
  let raw;
  try {
    raw = readFileSync3(ledgerPath(env), "utf8");
  } catch {
    return emptyLedger();
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyLedger();
  }
  const ledger = emptyLedger();
  if (!isObject(parsed)) return ledger;
  for (const source of SOURCES) {
    const sessions = asObject(parsed[source]);
    if (sessions) {
      for (const [sessionId, entry] of Object.entries(sessions)) {
        const o = asObject(entry);
        const lastTimestamp = asNumber(o?.lastTimestamp);
        if (lastTimestamp === null) continue;
        const ids = (asArray(o?.lastRecordIds) ?? []).map((v) => asString(v)).filter((v) => v !== null);
        const legacy = asString(o?.lastRecordUuid);
        if (ids.length === 0 && legacy) ids.push(legacy);
        ledger[source][sessionId] = { lastTimestamp, lastRecordIds: ids };
      }
    }
    const pending = asArray(asObject(parsed.pendingComplete)?.[source]) ?? [];
    for (const item of pending) {
      const o = asObject(item);
      const startDate = asString(o?.startDate);
      const endDate = asString(o?.endDate);
      if (startDate && endDate)
        ledger.pendingComplete[source].push({ startDate, endDate });
    }
    const inFlight = asArray(asObject(parsed.inFlight)?.[source]) ?? [];
    for (const item of inFlight) {
      const o = asObject(item);
      const batchId = asString(o?.batchId);
      const date = asString(o?.date);
      if (!batchId || !date) continue;
      const records = (asArray(o?.records) ?? []).flatMap((r) => {
        const ro = asObject(r);
        const sessionId = asString(ro?.sessionId);
        const recordIds = (asArray(ro?.recordIds) ?? []).map((v) => asString(v)).filter((v) => v !== null);
        return sessionId ? [{ sessionId, recordIds }] : [];
      });
      ledger.inFlight[source].push({ batchId, date, records });
    }
  }
  return ledger;
}
function addInFlight(ledger, source, batch) {
  if (!ledger.inFlight[source].some((b) => b.batchId === batch.batchId))
    ledger.inFlight[source].push(batch);
}
function removeInFlight(ledger, source, batchId) {
  ledger.inFlight[source] = ledger.inFlight[source].filter(
    (b) => b.batchId !== batchId
  );
}
function saveLedger(ledger, env = process.env) {
  const path = ledgerPath(env);
  mkdirSync2(dirname2(path), { recursive: true, mode: 448 });
  writeFileSync2(path, `${JSON.stringify(ledger, null, 2)}
`, { mode: 384 });
}
function filterUnsent(ledger, source, sessionId, events) {
  const entry = ledger[source][sessionId];
  if (!entry) return events;
  const sentAtLast = new Set(entry.lastRecordIds);
  return events.filter(
    (e) => e.timestampMs > entry.lastTimestamp || e.timestampMs === entry.lastTimestamp && !sentAtLast.has(e.recordId)
  );
}
function advanceLedger(ledger, source, sessionId, sent) {
  if (sent.length === 0) return;
  let latestMs = sent[0].timestampMs;
  for (const e of sent) if (e.timestampMs > latestMs) latestMs = e.timestampMs;
  const idsAtLatest = sent.filter((e) => e.timestampMs === latestMs).map((e) => e.recordId);
  const current = ledger[source][sessionId];
  if (current && current.lastTimestamp > latestMs) return;
  if (current && current.lastTimestamp === latestMs) {
    current.lastRecordIds = [
      .../* @__PURE__ */ new Set([...current.lastRecordIds, ...idsAtLatest])
    ];
    return;
  }
  ledger[source][sessionId] = {
    lastTimestamp: latestMs,
    lastRecordIds: [...new Set(idsAtLatest)]
  };
}
function addPendingComplete(ledger, source, range) {
  const list = ledger.pendingComplete[source];
  if (!list.some(
    (r) => r.startDate === range.startDate && r.endDate === range.endDate
  ))
    list.push(range);
}
function removePendingCompleteWithin(ledger, source, range) {
  ledger.pendingComplete[source] = ledger.pendingComplete[source].filter(
    (r) => !(r.startDate >= range.startDate && r.endDate <= range.endDate)
  );
}

// src/otlp.ts
var str = (key, value) => ({
  key,
  value: { stringValue: value }
});
var int = (key, value) => ({
  key,
  value: { intValue: String(Math.trunc(value)) }
});
var intAsString = (key, value) => ({
  key,
  value: { stringValue: String(Math.trunc(value)) }
});
var dbl = (key, value) => ({
  key,
  value: { doubleValue: value }
});
var msToUnixNano = (ms) => `${Math.trunc(ms)}000000`;
var SCOPE_NAME = "supateam-cli";
var makeLogRecord = (timestampMs, attributes) => {
  const nano = msToUnixNano(timestampMs);
  return { timeUnixNano: nano, observedTimeUnixNano: nano, attributes };
};
var attrKeys = (records) => {
  const keys = /* @__PURE__ */ new Set();
  for (const r of records) for (const a of r.attributes) keys.add(a.key);
  return [...keys].sort();
};

// src/sources/claude-code.ts
import { readFileSync as readFileSync4 } from "fs";
import { basename, join as join3 } from "path";

// src/sanitize.ts
var COMMAND_MAX_CHARS = 2e3;
var HEREDOC_RE = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\n|$)/g;
function sanitizeCommand(command) {
  const stripped = command.replace(
    HEREDOC_RE,
    (_m, _q, tag) => `<<${tag}
<heredoc body omitted>
${tag}`
  );
  return stripped.length > COMMAND_MAX_CHARS ? `${stripped.slice(0, COMMAND_MAX_CHARS)}\u2026` : stripped;
}
var PATCH_HEADER_RE = /^\*\*\* (?:Update File|Add File|Delete File|Move to): [^\n]+$/gm;
function extractPatchHeaders(patch) {
  return patch.match(PATCH_HEADER_RE) ?? [];
}

// src/sources/claude-code.ts
var IMPORT_SERVICE_NAME = "supateam-local-import";
var IMPORT_KIND = "local-history";
function readClaudeAccount(env = process.env) {
  try {
    const parsed = JSON.parse(
      readFileSync4(claudeJsonPath(env), "utf8")
    );
    const oauth = isObject(parsed) ? asObject(parsed.oauthAccount) : null;
    return {
      email: asString(oauth?.emailAddress),
      accountUuid: asString(oauth?.accountUuid),
      organizationUuid: asString(oauth?.organizationUuid)
    };
  } catch {
    return { email: null, accountUuid: null, organizationUuid: null };
  }
}
var newAccumulator = (sessionId) => ({
  sessionId,
  version: null,
  events: [],
  endMs: 0,
  billingEventCount: 0,
  seenMessageIds: /* @__PURE__ */ new Set(),
  seenToolUseIds: /* @__PURE__ */ new Set(),
  seenSkills: /* @__PURE__ */ new Set(),
  prNumbers: /* @__PURE__ */ new Set(),
  toolErrors: /* @__PURE__ */ new Set(),
  pendingApiRequests: []
});
var isRealUserPrompt = (record, message) => {
  if (record.isMeta === true || record.isSidechain === true) return false;
  const content = message.content;
  if (typeof content === "string") {
    return !content.startsWith("<command-") && !content.startsWith("<local-command-");
  }
  const blocks = asArray(content);
  if (!blocks) return false;
  let hasPromptBlock = false;
  for (const b of blocks) {
    const block = asObject(b);
    const type = asString(block?.type);
    if (type === "tool_result") return false;
    if (type === "text" || type === "image") hasPromptBlock = true;
  }
  return hasPromptBlock;
};
var promptLength = (message) => {
  const content = message.content;
  if (typeof content === "string") return content.length;
  let len = 0;
  for (const b of asArray(content) ?? []) {
    const block = asObject(b);
    const text = asString(block?.text);
    if (text) len += text.length;
  }
  return len;
};
function safeToolInput(toolName, input) {
  const obj = asObject(input);
  if (toolName === "Bash") {
    const command = asString(obj?.command);
    return JSON.stringify(command ? { command: sanitizeCommand(command) } : {});
  }
  if (toolName === "Edit" || toolName === "Write" || toolName === "MultiEdit") {
    const filePath = asString(obj?.file_path);
    return JSON.stringify(filePath ? { file_path: filePath } : {});
  }
  return "{}";
}
var MCP_TOOL_RE = /^mcp__(.+?)__(.+)$/;
async function convertClaudeCode(options, deps = {}) {
  const env = deps.env ?? process.env;
  const priceTable = deps.priceTable ?? loadPriceTable(env).table;
  const account = deps.account ?? readClaudeAccount(env);
  const email = options.email ?? account.email;
  const projectsDir = deps.projectsDir ?? join3(claudeConfigDir(env), "projects");
  const warnings = [];
  const unknownModels = /* @__PURE__ */ new Set();
  const files = await listJsonlFiles(projectsDir, true);
  const sessions = [];
  for (const file of files) {
    const acc = newAccumulator(basename(file, ".jsonl"));
    const records = [];
    for await (const record of readJsonl(file)) records.push(record);
    for (const record of records) {
      if (record.type !== "user") continue;
      const message = asObject(record.message);
      for (const b of asArray(message?.content) ?? []) {
        const block = asObject(b);
        if (block?.type === "tool_result" && block.is_error === true) {
          const id = asString(block.tool_use_id);
          if (id) acc.toolErrors.add(id);
        }
      }
    }
    for (const record of records) {
      const sessionId = asString(record.sessionId);
      if (sessionId) acc.sessionId = sessionId;
      const version = asString(record.version);
      if (version && !acc.version) acc.version = version;
      const type = asString(record.type);
      if (type === "pr-link") {
        const pr = asNumber(record.prNumber) ?? Number(asString(record.prNumber));
        if (Number.isFinite(pr) && pr > 0) acc.prNumbers.add(String(pr));
        continue;
      }
      const timestampMs = parseTimestampMs(record.timestamp);
      if (timestampMs === null) continue;
      if (timestampMs > acc.endMs) acc.endMs = timestampMs;
      if (timestampMs < options.sinceMs || timestampMs > options.untilMs) {
        continue;
      }
      const uuid = asString(record.uuid) ?? `${acc.sessionId}:${timestampMs}`;
      const base = [str("session.id", acc.sessionId)];
      if (email) base.push(str("user.email", email));
      if (account.accountUuid) base.push(str("user.id", account.accountUuid));
      if (account.organizationUuid)
        base.push(str("organization.id", account.organizationUuid));
      const entrypoint = asString(record.entrypoint);
      const promptId = asString(record.promptId);
      const skill = asString(record.attributionSkill);
      if (skill && !acc.seenSkills.has(skill)) {
        acc.seenSkills.add(skill);
        acc.events.push({
          recordId: `${uuid}:skill`,
          timestampMs,
          record: makeLogRecord(timestampMs, [
            str("event.name", "skill_activated"),
            ...base,
            str("skill.name", skill),
            str("skill.source", skill.includes(":") ? "plugin" : "user"),
            str("invocation_trigger", "unknown")
          ])
        });
      }
      if (type === "assistant") {
        const message = asObject(record.message);
        if (!message) continue;
        const usage = asObject(message.usage);
        const messageId = asString(message.id) ?? asString(record.requestId);
        const model = asString(message.model) ?? "unknown";
        if (usage && messageId && model !== "<synthetic>" && !acc.seenMessageIds.has(messageId)) {
          acc.seenMessageIds.add(messageId);
          const input = asNumber(usage.input_tokens) ?? 0;
          const output = asNumber(usage.output_tokens) ?? 0;
          const cacheRead = asNumber(usage.cache_read_input_tokens) ?? 0;
          const cacheWrite = asNumber(usage.cache_creation_input_tokens) ?? 0;
          const price = resolvePrice(priceTable, model);
          if (!price) unknownModels.add(model);
          const cost = price ? computeCostUsd(price, { input, output, cacheRead, cacheWrite }) : 0;
          const attrs = [
            str("event.name", "api_request"),
            ...base,
            str("model", model),
            int("input_tokens", input),
            int("output_tokens", output),
            int("cache_read_tokens", cacheRead),
            int("cache_creation_tokens", cacheWrite),
            dbl("cost_usd", cost)
          ];
          const durationMs = asNumber(record.durationMs);
          if (durationMs !== null) attrs.push(int("duration_ms", durationMs));
          if (entrypoint) attrs.push(str("terminal.type", entrypoint));
          if (promptId) attrs.push(str("prompt.id", promptId));
          const rec = makeLogRecord(timestampMs, attrs);
          acc.pendingApiRequests.push({ record: rec });
          acc.events.push({ recordId: uuid, timestampMs, record: rec });
          acc.billingEventCount++;
        }
        for (const b of asArray(message.content) ?? []) {
          const block = asObject(b);
          if (block?.type !== "tool_use") continue;
          const toolUseId = asString(block.id);
          const toolName = asString(block.name);
          if (!toolUseId || !toolName || acc.seenToolUseIds.has(toolUseId)) {
            continue;
          }
          acc.seenToolUseIds.add(toolUseId);
          const attrs = [
            str("event.name", "tool_result"),
            ...base,
            str("tool_name", toolName),
            str("tool_input", safeToolInput(toolName, block.input)),
            str("success", acc.toolErrors.has(toolUseId) ? "false" : "true"),
            str("tool_use_id", toolUseId)
          ];
          const mcp = toolName.match(MCP_TOOL_RE);
          if (mcp) {
            attrs.push(str("mcp_server.name", mcp[1]));
            attrs.push(str("mcp_tool.name", mcp[2]));
          }
          if (entrypoint) attrs.push(str("terminal.type", entrypoint));
          acc.events.push({
            recordId: `${uuid}:${toolUseId}`,
            timestampMs,
            record: makeLogRecord(timestampMs, attrs)
          });
        }
      } else if (type === "user") {
        const message = asObject(record.message);
        if (!message || !isRealUserPrompt(record, message)) continue;
        const attrs = [
          str("event.name", "user_prompt"),
          ...base,
          int("prompt_length", promptLength(message))
        ];
        if (promptId) attrs.push(str("prompt.id", promptId));
        if (entrypoint) attrs.push(str("terminal.type", entrypoint));
        acc.events.push({
          recordId: uuid,
          timestampMs,
          record: makeLogRecord(timestampMs, attrs)
        });
      }
    }
    if (acc.billingEventCount === 0 || acc.events.length === 0) continue;
    if (acc.prNumbers.size > 0) {
      const prAttr = str("pr.number", [...acc.prNumbers].join(" "));
      for (const { record } of acc.pendingApiRequests) {
        record.attributes.push(prAttr);
      }
    }
    acc.events.sort((a, b) => a.timestampMs - b.timestampMs);
    const resource = [
      str("service.name", IMPORT_SERVICE_NAME),
      str("service.version", acc.version ?? "unknown"),
      str("supateam.import.kind", IMPORT_KIND)
    ];
    if (email) resource.push(str("user.email", email));
    sessions.push({
      source: "claude-code",
      sessionId: acc.sessionId,
      resource,
      events: acc.events,
      firstMs: acc.events[0].timestampMs,
      lastMs: acc.events[acc.events.length - 1].timestampMs,
      endMs: acc.endMs,
      billingEventCount: acc.billingEventCount
    });
  }
  for (const model of [...unknownModels].sort()) {
    warnings.push(`unknown model pricing: ${model} (cost recorded as 0)`);
  }
  if (!email) {
    warnings.push(
      "Claude Code \u306E\u30ED\u30B0\u30A4\u30F3\u30E1\u30FC\u30EB\u3092 ~/.claude.json \u304B\u3089\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002--email \u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044 (\u30E1\u30F3\u30D0\u30FC\u5E30\u5C5E\u306B\u5FC5\u8981\u3067\u3059)"
    );
  }
  return {
    sessions,
    warnings,
    identity: {
      email,
      note: account.email && options.email && account.email !== options.email ? `--email \u304C ~/.claude.json (${account.email}) \u3092\u4E0A\u66F8\u304D\u3057\u3066\u3044\u307E\u3059` : null
    }
  };
}

// src/sources/codex.ts
import { readFileSync as readFileSync5 } from "fs";
import { basename as basename2, join as join4 } from "path";
var decodeJwtPayload = (token) => {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
};
function readCodexAccount(env = process.env) {
  try {
    const parsed = JSON.parse(
      readFileSync5(join4(codexHome(env), "auth.json"), "utf8")
    );
    if (!isObject(parsed))
      return { email: null, accountId: null, authMode: null };
    const tokens = asObject(parsed.tokens);
    const idToken = asString(tokens?.id_token);
    const payload = idToken ? decodeJwtPayload(idToken) : null;
    const profile = payload ? asObject(payload["https://api.openai.com/profile"]) : null;
    return {
      email: asString(payload?.email) ?? asString(profile?.email),
      accountId: asString(tokens?.account_id),
      authMode: asString(parsed.auth_mode)
    };
  } catch {
    return { email: null, accountId: null, authMode: null };
  }
}
var EXEC_TOOLS = /* @__PURE__ */ new Set(["exec_command", "exec", "shell", "local_shell"]);
function safeCodexArguments(toolName, raw) {
  if (EXEC_TOOLS.has(toolName)) {
    let cmd = null;
    const text = asString(raw);
    let obj = asObject(raw);
    if (text) {
      try {
        obj = asObject(JSON.parse(text));
      } catch {
        obj = null;
      }
    }
    const direct = asString(obj?.cmd);
    if (direct) cmd = direct;
    const command = obj?.command;
    if (!cmd && typeof command === "string") cmd = command;
    if (!cmd && Array.isArray(command)) {
      cmd = command.filter((c) => typeof c === "string").join(" ");
    }
    return JSON.stringify(cmd ? { cmd: sanitizeCommand(cmd) } : {});
  }
  if (toolName === "apply_patch") {
    const text = asString(raw);
    let patch = text ?? "";
    if (text) {
      try {
        const parsed = JSON.parse(text);
        const inner = asObject(parsed);
        patch = asString(inner?.input) ?? asString(inner?.patch) ?? text;
      } catch {
        patch = text;
      }
    } else {
      const inner = asObject(raw);
      patch = asString(inner?.input) ?? asString(inner?.patch) ?? "";
    }
    return extractPatchHeaders(patch).join("\n");
  }
  return "{}";
}
async function convertCodex(options, deps = {}) {
  const env = deps.env ?? process.env;
  const account = deps.account ?? readCodexAccount(env);
  const email = options.email ?? account.email;
  const sessionsDir = deps.sessionsDir ?? join4(codexHome(env), "sessions");
  const files = await listJsonlFiles(sessionsDir, true);
  const sessions = [];
  const warnings = [];
  for (const file of files) {
    let sessionId = basename2(file, ".jsonl").replace(
      /^rollout-.*?-(?=[0-9a-f]{8}-)/,
      ""
    );
    let cliVersion = null;
    let originator = null;
    let model = null;
    let lastTimestampMs = null;
    let lastUserPromptLength = null;
    const events = [];
    let billingEventCount = 0;
    let endMs = 0;
    for await (const record of readJsonl(file)) {
      const type = asString(record.type);
      const payload = asObject(record.payload) ?? {};
      const ts = parseTimestampMs(record.timestamp);
      if (ts !== null) lastTimestampMs = ts;
      const timestampMs = ts ?? lastTimestampMs;
      if (type === "session_meta") {
        sessionId = asString(payload.id) ?? sessionId;
        cliVersion = asString(payload.cli_version);
        originator = asString(payload.originator);
        model = asString(payload.model) ?? model;
        continue;
      }
      if (type === "turn_context") {
        model = asString(payload.model) ?? model;
        continue;
      }
      if (type === "event_msg" && payload.type === "thread_settings_applied") {
        const settings = asObject(payload.thread_settings);
        model = asString(settings?.model) ?? model;
        continue;
      }
      if (timestampMs === null) continue;
      if (timestampMs > endMs) endMs = timestampMs;
      if (timestampMs < options.sinceMs || timestampMs > options.untilMs) {
        continue;
      }
      const base = [str("conversation.id", sessionId)];
      if (email) base.push(str("user.email", email));
      if (account.accountId)
        base.push(str("user.account_id", account.accountId));
      if (originator) base.push(str("terminal.type", originator));
      if (account.authMode) base.push(str("auth_mode", account.authMode));
      if (type === "token_usage_record") {
        const usage = asObject(payload.usage);
        if (!usage) continue;
        const responseId = asString(payload.response_id) ?? `${sessionId}:${timestampMs}`;
        const input = asNumber(usage.input_tokens) ?? 0;
        const cached = asNumber(usage.cached_input_tokens) ?? 0;
        const output = asNumber(usage.output_tokens) ?? 0;
        const reasoning = asNumber(usage.reasoning_output_tokens) ?? 0;
        const m = model ?? "unknown";
        events.push({
          recordId: responseId,
          timestampMs,
          record: makeLogRecord(timestampMs, [
            str("event.name", "codex.sse_event"),
            str("event.kind", "response.completed"),
            ...base,
            str("model", m),
            str("gen_ai.request.model", m),
            // DuckDB 経路は input/output を stringValue、cached/reasoning を intValue で読む
            intAsString("input_token_count", input),
            intAsString("output_token_count", output),
            int("cached_token_count", cached),
            int("reasoning_token_count", reasoning)
          ])
        });
        billingEventCount++;
        continue;
      }
      if (type === "event_msg" && payload.type === "task_started") {
        const turnId = asString(payload.turn_id) ?? `${sessionId}:${timestampMs}`;
        const attrs = [
          str("event.name", "codex.user_prompt"),
          ...base
        ];
        if (lastUserPromptLength !== null) {
          attrs.push(int("prompt_length", lastUserPromptLength));
          lastUserPromptLength = null;
        }
        events.push({
          recordId: `${turnId}:prompt`,
          timestampMs,
          record: makeLogRecord(timestampMs, attrs)
        });
        continue;
      }
      if (type === "response_item") {
        const itemType = asString(payload.type);
        if (itemType === "message" && payload.role === "user") {
          let len = 0;
          for (const b of asArray(payload.content) ?? []) {
            const block = asObject(b);
            const text = asString(block?.text);
            if (text && !text.startsWith("<")) len += text.length;
          }
          if (len > 0) lastUserPromptLength = len;
          continue;
        }
        if (itemType === "function_call" || itemType === "custom_tool_call") {
          const toolName = asString(payload.name);
          if (!toolName) continue;
          const callId = asString(payload.call_id) ?? asString(payload.id) ?? `${sessionId}:${timestampMs}`;
          const rawArgs = itemType === "function_call" ? payload.arguments : payload.input;
          events.push({
            recordId: `${callId}:tool`,
            timestampMs,
            record: makeLogRecord(timestampMs, [
              str("event.name", "codex.tool_result"),
              ...base,
              str("tool_name", toolName),
              str("arguments", safeCodexArguments(toolName, rawArgs)),
              str("success", "true")
            ])
          });
        }
      }
    }
    if (billingEventCount === 0 || events.length === 0) continue;
    events.sort((a, b) => a.timestampMs - b.timestampMs);
    const resource = [
      str("service.name", IMPORT_SERVICE_NAME),
      str("service.version", cliVersion ?? "unknown"),
      str("supateam.import.kind", IMPORT_KIND)
    ];
    if (email) resource.push(str("user.email", email));
    sessions.push({
      source: "codex",
      sessionId,
      resource,
      events,
      firstMs: events[0].timestampMs,
      lastMs: events[events.length - 1].timestampMs,
      endMs,
      billingEventCount
    });
  }
  if (!email) {
    warnings.push(
      "Codex \u306E\u30ED\u30B0\u30A4\u30F3\u30E1\u30FC\u30EB\u3092 ~/.codex/auth.json \u304B\u3089\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002--email \u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044 (\u30E1\u30F3\u30D0\u30FC\u5E30\u5C5E\u306B\u5FC5\u8981\u3067\u3059)"
    );
  }
  return {
    sessions,
    warnings,
    identity: {
      email,
      note: account.email && options.email && account.email !== options.email ? `--email \u304C ~/.codex/auth.json (${account.email}) \u3092\u4E0A\u66F8\u304D\u3057\u3066\u3044\u307E\u3059` : null
    }
  };
}

// src/sources/types.ts
var utcDate = (ms) => new Date(ms).toISOString().slice(0, 10);

// src/summary.ts
function summarizeSource(source, sessions, skippedSessions, email, identityNote, warnings) {
  let events = 0;
  let bytes = 0;
  let firstMs = Number.POSITIVE_INFINITY;
  let lastMs = Number.NEGATIVE_INFINITY;
  const allRecords = [];
  for (const s of sessions) {
    events += s.events.length;
    firstMs = Math.min(firstMs, s.firstMs);
    lastMs = Math.max(lastMs, s.lastMs);
    for (const e of s.events) {
      bytes += JSON.stringify(e.record).length + 1;
      allRecords.push(e.record);
    }
    bytes += JSON.stringify(s.resource).length;
  }
  return {
    source,
    sessions: sessions.length,
    events,
    skippedSessions,
    startDate: sessions.length > 0 ? utcDate(firstMs) : null,
    endDate: sessions.length > 0 ? utcDate(lastMs) : null,
    bytes,
    attributeKeys: attrKeys(allRecords),
    email,
    identityNote,
    warnings
  };
}
var fmtBytes = (n) => n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`;
function renderSummary(summaries, opts) {
  const lines = [];
  lines.push(
    opts.dryRun ? "== supateam import (dry-run: \u4F55\u3082\u9001\u4FE1\u3057\u307E\u305B\u3093) ==" : `== supateam import \u2192 ${opts.apiUrl}${opts.organizationName ? ` (${opts.organizationName})` : ""} ==`
  );
  for (const s of summaries) {
    lines.push("");
    lines.push(`[${s.source}]`);
    lines.push(
      `  sessions: ${s.sessions}  events: ${s.events}  skipped sessions: ${s.skippedSessions}`
    );
    lines.push(
      `  date range (UTC): ${s.startDate ?? "-"} .. ${s.endDate ?? "-"}  payload: ${fmtBytes(s.bytes)}`
    );
    lines.push(`  user.email: ${s.email ?? "(\u672A\u8A2D\u5B9A)"}`);
    if (s.identityNote) lines.push(`  note: ${s.identityNote}`);
    lines.push(`  attributes sent: ${s.attributeKeys.join(", ") || "-"}`);
    for (const w of s.warnings) lines.push(`  \u26A0 ${w}`);
  }
  if (opts.priceTable) {
    lines.push("");
    lines.push(
      `Claude \u5358\u4FA1\u8868 (USD / 1M tokens, in/out/cacheWrite/cacheRead)${opts.priceOverridePath ? ` [override: ${opts.priceOverridePath}]` : ""}:`
    );
    for (const [model, p] of Object.entries(opts.priceTable)) {
      lines.push(
        `  ${model}: ${p.input} / ${p.output} / ${p.cacheWrite} / ${p.cacheRead}`
      );
    }
  }
  lines.push("");
  lines.push(
    "\u9001\u4FE1\u3057\u306A\u3044\u5185\u5BB9: \u30D7\u30ED\u30F3\u30D7\u30C8\u672C\u6587\u3001\u30C4\u30FC\u30EB\u306E\u51FA\u529B\u3001reasoning\u3001\u30D5\u30A1\u30A4\u30EB\u5185\u5BB9\u3001heredoc \u672C\u6587"
  );
  return lines.join("\n");
}

// src/commands/whoami.ts
function collectLocalEmails(env = process.env, loginEmail) {
  const emails = /* @__PURE__ */ new Set();
  if (loginEmail) emails.add(loginEmail.toLowerCase());
  const claude = readClaudeAccount(env).email;
  if (claude) emails.add(claude.toLowerCase());
  const codex = readCodexAccount(env).email;
  if (codex) emails.add(codex.toLowerCase());
  return [...emails];
}
async function fetchMe(env = process.env) {
  const creds = requireCredentials(env);
  const emails = collectLocalEmails(env, creds.user.email);
  const url = `${creds.apiUrl}/public/v1/cli/me?emails=${encodeURIComponent(emails.join(","))}`;
  const res = await getJson(url, bearer(creds.token));
  return { creds, me: res.data };
}
async function runWhoami(args, env = process.env) {
  const { creds, me } = await fetchMe(env);
  if (flagBool(args.flags, "json")) {
    console.log(JSON.stringify(me, null, 2));
    return;
  }
  console.log(`organization: ${me.organization.name} (${me.organization.id})`);
  console.log(
    `user: ${me.user.email}${me.user.name ? ` (${me.user.name})` : ""} role=${me.user.role ?? "-"} token expires ${creds.expiresAt}`
  );
  console.log(`candidate emails: ${me.candidateEmails.join(", ") || "-"}`);
  console.log(
    `otel key created at: ${me.otelKeyCreatedAt ?? "- (OTel \u9023\u643A\u306F\u672A\u8A2D\u5B9A)"}`
  );
  if (me.match) {
    console.log(
      `member: ${me.match.memberName} (${me.match.memberId}) via ${me.match.via}${me.match.email ? ` [${me.match.email}]` : ""}`
    );
  } else {
    console.log(
      "member: \u672A\u7D10\u3065\u3051\u3002`supateam link-member --member-id <id>` \u304B `--create <\u540D\u524D>` \u3067\u78BA\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044"
    );
  }
  console.log(`members (${me.members.length}):`);
  for (const m of me.members) {
    console.log(
      `  ${m.id}  ${m.name}${m.hasWorkEmails ? "" : "  (\u696D\u52D9\u30E1\u30FC\u30EB\u672A\u767B\u9332)"}`
    );
  }
}
async function runLinkMember(args, env = process.env) {
  const creds = requireCredentials(env);
  const memberId = flagString(args.flags, "member-id");
  const createName = flagString(args.flags, "create");
  if ((memberId ? 1 : 0) + (createName ? 1 : 0) !== 1) {
    throw new Error(
      "--member-id <uuid> \u304B --create <\u540D\u524D> \u306E\u3069\u3061\u3089\u304B\u4E00\u65B9\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044"
    );
  }
  const emailsFlag = flagString(args.flags, "emails");
  const emails = emailsFlag ? emailsFlag.split(",").map((e) => e.trim()).filter(Boolean) : [creds.user.email];
  const body = memberId ? { memberId, emails } : { create: { name: createName }, emails };
  const res = await postJson(
    `${creds.apiUrl}/public/v1/cli/member-link`,
    body,
    bearer(creds.token)
  );
  const m = res.data.member;
  console.log(
    `${memberId ? "\u7D10\u3065\u3051\u307E\u3057\u305F" : "\u4F5C\u6210\u3057\u3066\u7D10\u3065\u3051\u307E\u3057\u305F"}: ${m.name} (${m.id}) emails=${m.workEmails.join(", ")}`
  );
  if (flagBool(args.flags, "json"))
    console.log(JSON.stringify(res.data, null, 2));
  return res.data;
}

// src/commands/import.ts
var IMPORT_EVENT_DATE_HEADER = "X-Supateam-Import-Event-Date";
var MAX_POST_BYTES = 85e3;
var MAX_COMPLETE_RANGE_DAYS = 89;
var DEFAULT_SINCE_DAYS = 398;
var SOURCES2 = ["claude-code", "codex"];
function parseImportOptions(args, now = Date.now()) {
  const sourceFlag = flagString(args.flags, "source") ?? "all";
  const sources = sourceFlag === "all" ? SOURCES2 : sourceFlag === "claude-code" || sourceFlag === "codex" ? [sourceFlag] : (() => {
    throw new Error(
      "--source \u306F claude-code | codex | all \u306E\u3044\u305A\u308C\u304B\u3067\u3059"
    );
  })();
  const sinceMs = parseDateFlag(args.flags, "since") ?? now - DEFAULT_SINCE_DAYS * 24 * 60 * 60 * 1e3;
  const untilFlag = parseDateFlag(args.flags, "until", true);
  const untilMs = untilFlag ?? now;
  if (sinceMs > untilMs)
    throw new Error("--since \u306F --until \u4EE5\u524D\u306B\u3057\u3066\u304F\u3060\u3055\u3044");
  return {
    sources,
    sinceMs,
    untilMs,
    allowOtelOverlap: flagBool(args.flags, "allow-otel-overlap"),
    dryRun: flagBool(args.flags, "dry-run"),
    json: flagBool(args.flags, "json"),
    yes: flagBool(args.flags, "yes"),
    email: flagString(args.flags, "email") ?? null
  };
}
function otelOverlapWarning(prepared, otelKeyCreatedAt) {
  if (!otelKeyCreatedAt) return null;
  const cutoff = Date.parse(otelKeyCreatedAt);
  if (Number.isNaN(cutoff)) return null;
  const overlapping = prepared.reduce(
    (n, p) => n + p.sessions.filter((s) => s.lastMs >= cutoff).length,
    0
  );
  if (overlapping === 0) return null;
  const day = new Date(cutoff).toISOString().slice(0, 10);
  const before = new Date(cutoff - 864e5).toISOString().slice(0, 10);
  return `\u26A0 \u3053\u306E\u7D44\u7E54\u3067\u306F ${day} \u306B OTel \u7528\u30AD\u30FC\u304C\u767A\u884C\u3055\u308C\u3066\u3044\u307E\u3059\u3002OTel \u9023\u643A\u3092\u65E2\u306B\u8A2D\u5B9A\u3057\u3066\u3044\u308B\u5834\u5408\u3001\u305D\u308C\u4EE5\u964D\u306E\u30BB\u30C3\u30B7\u30E7\u30F3 (${overlapping} \u4EF6) \u306F OTel \u3067\u53D7\u4FE1\u6E08\u307F\u306E\u53EF\u80FD\u6027\u304C\u3042\u308A\u4E8C\u91CD\u8A08\u4E0A\u306B\u306A\u308A\u307E\u3059\u3002\u8A2D\u5B9A\u65E5\u306E\u524D\u65E5\u3092 --until \u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044 (\u4F8B: --until ${before})\u3002\u672A\u8A2D\u5B9A\u306A\u3089\u3001\u3053\u306E\u307E\u307E\u9001\u4FE1\u3057\u3066\u554F\u984C\u3042\u308A\u307E\u305B\u3093`;
}
function prepareSource(source, result, ledger, untilMs) {
  let skipped = 0;
  const sessions = [];
  for (const s of result.sessions) {
    if (s.endMs > untilMs) {
      skipped++;
      continue;
    }
    const ordered = [...s.events].sort((a, b) => a.timestampMs - b.timestampMs);
    const events = filterUnsent(ledger, source, s.sessionId, ordered);
    if (events.length === 0) {
      skipped++;
      continue;
    }
    sessions.push({
      ...s,
      events,
      firstMs: events[0].timestampMs,
      lastMs: events[events.length - 1].timestampMs
    });
  }
  return {
    source,
    sessions,
    summary: summarizeSource(
      source,
      sessions,
      skipped,
      result.identity.email,
      result.identity.note,
      result.warnings
    )
  };
}
function groupByUtcDate(sessions) {
  const byDate = /* @__PURE__ */ new Map();
  for (const session of sessions) {
    const perDate = /* @__PURE__ */ new Map();
    for (const e of session.events) {
      const d = utcDate(e.timestampMs);
      const list = perDate.get(d);
      if (list) list.push(e);
      else perDate.set(d, [e]);
    }
    for (const [d, events] of perDate) {
      const list = byDate.get(d);
      const batch = { session, events };
      if (list) list.push(batch);
      else byDate.set(d, [batch]);
    }
  }
  return [...byDate.entries()].sort(([a], [b]) => a < b ? -1 : 1);
}
var IMPORT_BATCH_ID_HEADER = "X-Supateam-Import-Batch-Id";
function deterministicBatchId(included) {
  const h = createHash("sha256");
  for (const { session, events } of included) {
    h.update(session.sessionId).update("\0");
    for (const e of events) h.update(e.recordId).update("\n");
    h.update("\0");
  }
  const hex = h.digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
function splitIntoPayloads(batches, maxBytes = MAX_POST_BYTES) {
  const chunks = [];
  let current = [];
  let currentIncluded = [];
  let currentBytes = 0;
  const flush = () => {
    if (current.length > 0)
      chunks.push({
        payload: { resourceLogs: current },
        included: currentIncluded,
        batchId: deterministicBatchId(currentIncluded)
      });
    current = [];
    currentIncluded = [];
    currentBytes = 0;
  };
  for (const { session, events } of batches) {
    const resourceBytes = JSON.stringify(session.resource).length + 80;
    let entry = null;
    let included = null;
    for (const e of events) {
      const bytes = JSON.stringify(e.record).length + 1;
      if (entry && currentBytes + bytes > maxBytes) {
        flush();
        entry = null;
        included = null;
      }
      if (!entry) {
        entry = {
          resource: { attributes: session.resource },
          scopeLogs: [{ scope: { name: SCOPE_NAME }, logRecords: [] }]
        };
        current.push(entry);
        included = { session, events: [] };
        currentIncluded.push(included);
        currentBytes += resourceBytes;
      }
      entry.scopeLogs[0].logRecords.push(e.record);
      included?.events.push(e);
      currentBytes += bytes;
    }
  }
  flush();
  return chunks;
}
function splitDateRange(startDate, endDate) {
  const ranges = [];
  let cursor = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    const windowEnd = Math.min(
      cursor + (MAX_COMPLETE_RANGE_DAYS - 1) * 864e5,
      end
    );
    ranges.push({ startDate: utcDate(cursor), endDate: utcDate(windowEnd) });
    cursor = windowEnd + 864e5;
  }
  return ranges;
}
function coalesceDateRanges(ranges) {
  const sorted = [...ranges].sort(
    (a, b) => a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0
  );
  const merged = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && Date.parse(`${r.startDate}T00:00:00Z`) <= Date.parse(`${last.endDate}T00:00:00Z`) + 864e5) {
      if (r.endDate > last.endDate) last.endDate = r.endDate;
    } else {
      merged.push({ ...r });
    }
  }
  return merged.map((r) => ({
    window: r,
    parts: splitDateRange(r.startDate, r.endDate)
  }));
}
async function completePendingWindows(ledger, source, counts, sender, log, env, prefix = "") {
  let completed = 0;
  for (const { window, parts } of coalesceDateRanges(
    ledger.pendingComplete[source]
  )) {
    for (const range of parts) {
      const workflowId = await sender.complete({
        source,
        startDate: range.startDate,
        endDate: range.endDate,
        ...counts
      });
      completed++;
      log(
        `  ${source}: ${prefix}\u518D\u96C6\u8A08\u3092\u4F9D\u983C\u3057\u307E\u3057\u305F (${range.startDate} .. ${range.endDate})${workflowId ? ` workflow=${workflowId}` : ""}`
      );
    }
    removePendingCompleteWithin(ledger, source, window);
    saveLedger(ledger, env);
  }
  return completed;
}
async function confirm(question) {
  const rl = createInterface2({ input: process.stdin, output: process.stdout });
  const answer = await new Promise(
    (resolve) => rl.question(question, resolve)
  );
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}
var httpSender = (creds) => ({
  postLogs: async (source, eventDate, batchId, payload) => {
    const res = await requestWithRetry(
      `${creds.apiUrl}/public/v1/otel/${source}/v1/logs`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [IMPORT_EVENT_DATE_HEADER]: eventDate,
          [IMPORT_BATCH_ID_HEADER]: batchId,
          ...bearer(creds.token)
        },
        body: JSON.stringify(payload)
      }
    );
    if (!res.ok) {
      throw new Error(
        `\u9001\u4FE1\u306B\u5931\u6557\u3057\u307E\u3057\u305F (${source} ${eventDate}): HTTP ${res.status} ${(await res.text()).slice(0, 300)}`
      );
    }
  },
  complete: async (body) => {
    const res = await postJson(
      `${creds.apiUrl}/public/v1/cli/import/complete`,
      body,
      bearer(creds.token)
    );
    return res.data?.workflowInstanceId ?? null;
  }
});
var eventKey = (sessionId, recordId) => `${sessionId}\0${recordId}`;
async function sendPrepared(prepared, ledger, sender, log, env = process.env) {
  const { source, sessions } = prepared;
  if (sessions.length === 0) return { dates: 0, posts: 0 };
  let posts = 0;
  const postChunk = async (date, batchId, included, payload) => {
    addInFlight(ledger, source, {
      batchId,
      date,
      records: included.map((b) => ({
        sessionId: b.session.sessionId,
        recordIds: b.events.map((e) => e.recordId)
      }))
    });
    saveLedger(ledger, env);
    await sender.postLogs(source, date, batchId, payload);
    posts++;
    for (const { session, events } of included) {
      advanceLedger(ledger, source, session.sessionId, events);
    }
    removeInFlight(ledger, source, batchId);
    addPendingComplete(ledger, source, { startDate: date, endDate: date });
    saveLedger(ledger, env);
  };
  const bySession = new Map(sessions.map((s) => [s.sessionId, s]));
  const resent = /* @__PURE__ */ new Set();
  for (const inflight of [...ledger.inFlight[source]]) {
    const included = [];
    for (const r of inflight.records) {
      const session = bySession.get(r.sessionId);
      if (!session) continue;
      const wanted = new Set(r.recordIds);
      const events = session.events.filter((e) => wanted.has(e.recordId));
      if (events.length > 0) included.push({ session, events });
    }
    if (included.length === 0) {
      removeInFlight(ledger, source, inflight.batchId);
      saveLedger(ledger, env);
      continue;
    }
    const [chunk] = splitIntoPayloads(included, Number.POSITIVE_INFINITY);
    await postChunk(inflight.date, inflight.batchId, included, chunk.payload);
    for (const { session, events } of included) {
      for (const e of events)
        resent.add(eventKey(session.sessionId, e.recordId));
    }
    log(
      `  ${source} ${inflight.date}: \u524D\u56DE\u5FDC\u7B54\u3092\u78BA\u8A8D\u3067\u304D\u306A\u304B\u3063\u305F 1 \u901A\u3092\u518D\u9001\u3057\u307E\u3057\u305F`
    );
  }
  const remaining = sessions.map((s) => ({
    ...s,
    events: s.events.filter(
      (e) => !resent.has(eventKey(s.sessionId, e.recordId))
    )
  })).filter((s) => s.events.length > 0);
  const grouped = groupByUtcDate(remaining);
  for (const [date, batches] of grouped) {
    const chunks = splitIntoPayloads(batches);
    for (const { payload, included, batchId } of chunks) {
      await postChunk(date, batchId, included, payload);
    }
    log(
      `  ${source} ${date}: ${batches.length} sessions, ${chunks.length} request(s)`
    );
  }
  const eventCount = sessions.reduce((n, s) => n + s.events.length, 0);
  await completePendingWindows(
    ledger,
    source,
    { sessionCount: sessions.length, eventCount },
    sender,
    log,
    env
  );
  return { dates: grouped.length, posts };
}
async function flushPendingCompletes(ledger, sources, sender, log, env = process.env) {
  let flushed = 0;
  for (const source of sources) {
    flushed += await completePendingWindows(
      ledger,
      source,
      { sessionCount: 0, eventCount: 0 },
      sender,
      log,
      env,
      "\u524D\u56DE\u672A\u7533\u544A\u306E"
    );
  }
  return flushed;
}
async function runImport(args, env = process.env) {
  const options = parseImportOptions(args);
  const ledger = loadLedger(env);
  const { table: priceTable, overridePath } = options.sources.includes(
    "claude-code"
  ) ? loadPriceTable(env) : { table: {}, overridePath: null };
  const convertOptions = {
    email: options.email,
    sinceMs: options.sinceMs,
    untilMs: options.untilMs
  };
  const prepared = [];
  for (const source of options.sources) {
    const result = source === "claude-code" ? await convertClaudeCode(convertOptions, { env, priceTable }) : await convertCodex(convertOptions, { env });
    prepared.push(prepareSource(source, result, ledger, options.untilMs));
  }
  const creds = options.dryRun ? loadCredentials(env) : requireCredentials(env);
  const summaries = prepared.map((p) => p.summary);
  let otelWarning = null;
  if (creds) {
    const { me } = await fetchMe(env);
    otelWarning = otelOverlapWarning(prepared, me.otelKeyCreatedAt);
  }
  if (options.json) {
    console.log(
      JSON.stringify(
        { dryRun: options.dryRun, sources: summaries, otelWarning },
        null,
        2
      )
    );
  } else {
    console.log(
      renderSummary(summaries, {
        dryRun: options.dryRun,
        apiUrl: creds?.apiUrl ?? "",
        organizationName: creds?.organization.name ?? null,
        priceTable: options.sources.includes("claude-code") ? priceTable : null,
        priceOverridePath: overridePath
      })
    );
  }
  if (otelWarning && !options.json) console.log(`
${otelWarning}
`);
  if (options.dryRun || !creds) return { sent: false, summaries };
  if (otelWarning && !options.allowOtelOverlap) {
    throw new Error(
      "OTel \u9023\u643A\u3068\u91CD\u306A\u308B\u671F\u9593\u304C\u3042\u308B\u305F\u3081\u9001\u4FE1\u3092\u4E2D\u6B62\u3057\u307E\u3057\u305F\u3002--until \u3067\u671F\u9593\u3092\u5207\u308B\u304B\u3001\u4E8C\u91CD\u8A08\u4E0A\u3092\u627F\u77E5\u306E\u4E0A\u3067 --allow-otel-overlap \u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044"
    );
  }
  const sender = httpSender(creds);
  const flushed = await flushPendingCompletes(
    ledger,
    options.sources,
    sender,
    console.log,
    env
  );
  const total = prepared.reduce((n, p) => n + p.summary.events, 0);
  if (total === 0) {
    console.log(
      "\u9001\u4FE1\u5BFE\u8C61\u306E\u30A4\u30D9\u30F3\u30C8\u306F\u3042\u308A\u307E\u305B\u3093 (\u3059\u3079\u3066\u9001\u4FE1\u6E08\u307F\u304B\u3001\u671F\u9593\u5185\u306B\u30BB\u30C3\u30B7\u30E7\u30F3\u304C\u3042\u308A\u307E\u305B\u3093)"
    );
    return { sent: flushed > 0, summaries };
  }
  if (!options.yes && process.stdin.isTTY) {
    const ok = await confirm("\u4E0A\u8A18\u306E\u5185\u5BB9\u3092 supateam \u306B\u9001\u4FE1\u3057\u307E\u3059\u304B? [y/N] ");
    if (!ok) {
      console.log("\u4E2D\u6B62\u3057\u307E\u3057\u305F");
      return { sent: false, summaries };
    }
  }
  for (const p of prepared) {
    const { dates, posts } = await sendPrepared(
      p,
      ledger,
      sender,
      console.log,
      env
    );
    console.log(
      `${p.source}: ${p.sessions.length} sessions / ${dates} days / ${posts} requests \u3092\u9001\u4FE1\u3057\u307E\u3057\u305F`
    );
  }
  console.log(
    "\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002\u96C6\u8A08\u306F\u6570\u5206\u301C\u5341\u6570\u5206\u3067\u53CD\u6620\u3055\u308C\u307E\u3059\u3002\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306E AI \u6D3B\u7528\u5206\u6790\u3067\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044"
  );
  return { sent: true, summaries };
}

// src/commands/login.ts
import { spawn } from "child_process";
import { hostname, platform, release } from "os";

// src/version.ts
var VERSION = "0.1.0";

// src/commands/login.ts
var LOGIN_TIMEOUT_MS = 10 * 60 * 1e3;
function openBrowser(url) {
  const [cmd, args] = process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  try {
    spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
    return true;
  } catch {
    return false;
  }
}
function clientInfo(env = process.env) {
  const tool = env.CLAUDE_PLUGIN_ROOT ? "claude-code" : env.CODEX_HOME || env.CODEX_SANDBOX ? "codex" : "cli";
  return {
    hostname: hostname(),
    os: `${platform()} ${release()}`,
    tool,
    cliVersion: VERSION
  };
}
async function requestDeviceCode(apiUrl, client, fetchImpl = fetch) {
  const res = await requestWithRetry(
    `${apiUrl}/cli/device/code`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client })
    },
    fetchImpl
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `\u30ED\u30B0\u30A4\u30F3\u3092\u958B\u59CB\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F (HTTP ${res.status}): ${extractErrorMessage(text)}`
    );
  }
  return JSON.parse(text);
}
async function pollDeviceToken(apiUrl, deviceCode, fetchImpl = fetch) {
  const res = await requestWithRetry(
    `${apiUrl}/cli/device/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceCode })
    },
    fetchImpl
  );
  const text = await res.text();
  if (res.ok) {
    return { status: "approved", data: JSON.parse(text).data };
  }
  if (res.status === 400) {
    let error;
    try {
      error = JSON.parse(text).error;
    } catch {
      error = void 0;
    }
    switch (error) {
      case "authorization_pending":
        return { status: "pending" };
      case "slow_down":
        return { status: "slow_down" };
      case "access_denied":
        return { status: "denied" };
      case "expired_token":
        return { status: "expired" };
    }
  }
  throw new Error(
    `\u30ED\u30B0\u30A4\u30F3\u306E\u78BA\u8A8D\u306B\u5931\u6557\u3057\u307E\u3057\u305F (HTTP ${res.status}): ${extractErrorMessage(text)}`
  );
}
var sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitForApproval(apiUrl, device, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepImpl = options.sleepImpl ?? sleep2;
  const now = options.now ?? Date.now;
  const deadline = now() + (options.timeoutMs ?? LOGIN_TIMEOUT_MS);
  let intervalMs = Math.max(1, device.interval) * 1e3;
  while (now() < deadline) {
    await sleepImpl(intervalMs);
    const result = await pollDeviceToken(apiUrl, device.deviceCode, fetchImpl);
    switch (result.status) {
      case "approved":
        return result.data;
      case "pending":
        continue;
      case "slow_down":
        intervalMs += 5e3;
        continue;
      case "denied":
        throw new Error("\u30D6\u30E9\u30A6\u30B6\u3067\u30ED\u30B0\u30A4\u30F3\u304C\u62D2\u5426\u3055\u308C\u307E\u3057\u305F");
      case "expired":
        throw new Error(
          "\u30B3\u30FC\u30C9\u306E\u6709\u52B9\u671F\u9650 (10 \u5206) \u304C\u5207\u308C\u307E\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6 login \u3092\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044"
        );
    }
  }
  throw new Error("\u30D6\u30E9\u30A6\u30B6\u3067\u306E\u627F\u8A8D\u304C\u30BF\u30A4\u30E0\u30A2\u30A6\u30C8\u3057\u307E\u3057\u305F (10 \u5206)");
}
async function runLogin(args, env = process.env) {
  const { apiUrl, appUrl } = resolveUrls(
    {
      apiUrl: flagString(args.flags, "api-url"),
      appUrl: flagString(args.flags, "app-url")
    },
    env
  );
  const device = await requestDeviceCode(apiUrl, clientInfo(env));
  const verificationUri = `${appUrl}/cli/device?code=${encodeURIComponent(device.userCode)}`;
  const noBrowser = args.flags.browser === false || flagBool(args.flags, "no-browser");
  const opened = noBrowser ? false : openBrowser(verificationUri);
  console.log(
    [
      opened ? "\u30D6\u30E9\u30A6\u30B6\u3067 supateam \u3092\u958B\u304D\u307E\u3057\u305F\u3002" : "\u6B21\u306E URL \u3092\u30D6\u30E9\u30A6\u30B6\u3067\u958B\u3044\u3066\u304F\u3060\u3055\u3044 (\u5225\u306E\u30DE\u30B7\u30F3\u306E\u30D6\u30E9\u30A6\u30B6\u3067\u3082\u69CB\u3044\u307E\u305B\u3093):",
      `  ${verificationUri}`,
      "",
      `\u753B\u9762\u306B\u30B3\u30FC\u30C9 ${device.userCode} \u304C\u8868\u793A\u3055\u308C\u3066\u3044\u308B\u3053\u3068\u3092\u78BA\u8A8D\u3057\u3066\u300C\u8A31\u53EF\u3059\u308B\u300D\u3092\u62BC\u3057\u3066\u304F\u3060\u3055\u3044\u3002`,
      `(\u6709\u52B9\u671F\u9650 ${Math.round(device.expiresIn / 60)} \u5206)`
    ].join("\n")
  );
  const data = await waitForApproval(apiUrl, device);
  const creds = {
    apiUrl,
    appUrl,
    token: data.token,
    expiresAt: data.expiresAt,
    organization: data.organization,
    user: data.user
  };
  const path = saveCredentials(creds, env);
  console.log(
    `\u30ED\u30B0\u30A4\u30F3\u3057\u307E\u3057\u305F: ${creds.user.email} @ ${creds.organization.name}
\u8A8D\u8A3C\u60C5\u5831\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F: ${path} (\u6709\u52B9\u671F\u9650 ${creds.expiresAt})`
  );
  return creds;
}

// src/commands/mcp-headers.ts
function runMcpHeaders(env = process.env) {
  const creds = requireCredentials(env);
  process.stdout.write(
    `${JSON.stringify({ Authorization: `Bearer ${creds.token}` })}
`
  );
}

// src/cli.ts
var USAGE = `supateam ${VERSION} \u2014 Claude Code / Codex \u306E\u30ED\u30FC\u30AB\u30EB\u5C65\u6B74\u3092 supateam \u306B\u53D6\u308A\u8FBC\u3080 (ADR-0022)

\u4F7F\u3044\u65B9:
  supateam login [--api-url <url>] [--app-url <url>] [--no-browser]
      \u30D6\u30E9\u30A6\u30B6\u3067 supateam \u306B\u30ED\u30B0\u30A4\u30F3\u3057\u3001\u30E6\u30FC\u30B6\u30FC\u7D10\u3065\u304D\u30C8\u30FC\u30AF\u30F3\u3092 ~/.supateam/credentials.json \u306B\u4FDD\u5B58\u3059\u308B
  supateam whoami [--json]
      \u7D44\u7E54\u30FB\u30E6\u30FC\u30B6\u30FC\u30FB\u30E1\u30F3\u30D0\u30FC\u7D10\u3065\u3051\u306E\u72B6\u614B\u3068\u3001\u5728\u7C4D\u30E1\u30F3\u30D0\u30FC\u4E00\u89A7\u3092\u8868\u793A\u3059\u308B
  supateam link-member (--member-id <uuid> | --create <\u540D\u524D>) [--emails a,b] [--json]
      \u81EA\u5206\u306E\u8A08\u6E2C\u5BFE\u8C61\u30E1\u30F3\u30D0\u30FC\u3092\u65E2\u5B58\u304B\u3089\u9078\u3076\u3001\u307E\u305F\u306F\u65B0\u898F\u4F5C\u6210\u3057\u3066\u7D10\u3065\u3051\u308B
  supateam import [--source claude-code|codex|all] [--since YYYY-MM-DD] [--until YYYY-MM-DD]
                  [--dry-run] [--json] [--yes] [--email <addr>] [--allow-otel-overlap]
      \u30ED\u30FC\u30AB\u30EB\u306E\u30BB\u30C3\u30B7\u30E7\u30F3\u5C65\u6B74\u3092 OTel \u5F62\u5F0F\u306B\u5909\u63DB\u3057\u3066\u9001\u4FE1\u3059\u308B\u3002\u9001\u4FE1\u524D\u306B\u5FC5\u305A\u5185\u5BB9\u306E\u8981\u7D04\u3092\u8868\u793A\u3059\u308B
  supateam mcp-headers
      Claude Code \u306E MCP headersHelper \u7528\u306B Authorization \u30D8\u30C3\u30C0\u3092 JSON \u3067\u51FA\u529B\u3059\u308B

\u74B0\u5883\u5909\u6570:
  SUPATEAM_API_URL / SUPATEAM_APP_URL  \u63A5\u7D9A\u5148 (\u65E2\u5B9A: https://api.supateam.com / https://app.supateam.com)
  SUPATEAM_HOME                        \u8A8D\u8A3C\u60C5\u5831\u3068\u53F0\u5E33\u306E\u4FDD\u5B58\u5148 (\u65E2\u5B9A: ~/.supateam)
  SUPATEAM_CLAUDE_PRICES               Claude \u30E2\u30C7\u30EB\u5358\u4FA1\u8868 (JSON) \u3067\u540C\u68B1\u8868\u3092\u4E0A\u66F8\u304D\u30FB\u62E1\u5F35
  CLAUDE_CONFIG_DIR / CODEX_HOME       \u30ED\u30B0\u306E\u5834\u6240 (\u65E2\u5B9A: ~/.claude / ~/.codex)

\u9001\u4FE1\u3057\u306A\u3044\u5185\u5BB9: \u30D7\u30ED\u30F3\u30D7\u30C8\u672C\u6587\u3001\u30C4\u30FC\u30EB\u306E\u51FA\u529B\u3001reasoning\u3001\u30D5\u30A1\u30A4\u30EB\u5185\u5BB9\u3001heredoc \u672C\u6587
`;
async function main(argv) {
  const args = parseArgs(argv);
  if (args.flags.version === true || args.command === "version") {
    console.log(VERSION);
    return 0;
  }
  if (args.flags.help === true || args.command === null || args.command === "help") {
    console.log(USAGE);
    return args.command === null && args.flags.help !== true ? 1 : 0;
  }
  try {
    switch (args.command) {
      case "login":
        await runLogin(args);
        return 0;
      case "whoami":
        await runWhoami(args);
        return 0;
      case "link-member":
        await runLinkMember(args);
        return 0;
      case "import":
        await runImport(args);
        return 0;
      case "mcp-headers":
        runMcpHeaders();
        return 0;
      default:
        console.error(`\u4E0D\u660E\u306A\u30B3\u30DE\u30F3\u30C9\u3067\u3059: ${args.command}
`);
        console.log(USAGE);
        return 1;
    }
  } catch (error) {
    if (error instanceof NotLoggedInError) {
      console.error(error.message);
      return 1;
    }
    if (error instanceof HttpError) {
      console.error(
        `supateam API \u30A8\u30E9\u30FC (HTTP ${error.status}): ${error.message}`
      );
      return 1;
    }
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
export {
  USAGE,
  main
};
