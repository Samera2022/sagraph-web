interface Env {
  RELEASES_BUCKET: R2Bucket;
  DB?: D1Database;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_BASE_URL?: string;
  LICENSE_SIGNING_PRIVATE_KEY?: string;
  REQUIRE_LICENSE?: string;
}

interface ReleaseCatalog {
  releases: CatalogRelease[];
}

interface CatalogRelease {
  channel: string;
  version: string;
  published: boolean;
  pub_date: string;
  notes: string;
  platforms: Record<string, ReleasePlatform>;
}

interface ReleasePlatform {
  artifact: string;
  signature: string;
  sha256?: string;
  size?: number;
}

interface UpdateProof {
  provider: "paypal" | "microsoft_store";
  license_token?: string;
  device_id?: string;
  supported?: boolean;
  package_identity_available?: boolean;
  active?: boolean;
  entitlement_kind?: string;
  expiration_unix_ms?: number | null;
}

interface PayPalOrderRequest {
  plan_id: string;
}

interface ActivationRequest {
  order_id: string;
  machine_code: string;
}

interface PayPalOrder {
  id: string;
  status: string;
  purchase_units?: Array<{
    custom_id?: string;
    amount?: { currency_code?: string; value?: string };
    payments?: { captures?: Array<{ amount?: { currency_code?: string; value?: string } }> };
  }>;
  payer?: { email_address?: string };
}

interface OrderRecord {
  order_id: string;
  status: string;
  plan_id: string;
  amount: string;
  currency: string;
  machine_code: string | null;
  activation_hash: string | null;
  term: string | null;
  expires_on: string | null;
}

const plans = {
  "1m": { label: "1 month", amount: "0.99", term: "1M", days: 30 },
  "3m": { label: "3 months", amount: "3.99", term: "3M", days: 90 },
  "6m": { label: "6 months", amount: "6.99", term: "6M", days: 180 },
  "1y": { label: "1 year", amount: "12.99", term: "1Y", days: 365 },
  lifetime: { label: "Lifetime", amount: "19.99", term: "LIFETIME", days: null },
} as const;

type PlanId = keyof typeof plans;

const jsonHeaders = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

const json = (body: unknown, status = 200, headers: HeadersInit = {}): Response =>
  Response.json(body, { status, headers: { ...jsonHeaders, ...headers } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
      if (url.hostname === "download.sagraph.top") return cors(await handleDownload(request, env, url));
      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
        return cors(json({ ok: true, service: "sagraph-api" }));
      }
      if (url.pathname.startsWith("/api/v1/updates/")) return cors(await handleUpdateCheck(request, env, url));
      if (url.pathname === "/api/v1/releases/catalog" || url.pathname === "/api/v1/changelog/manifest") {
        return cors(await handleReleaseCatalog(request, env));
      }
      if (url.pathname === "/api/v1/paypal/config") return cors(await handlePayPalConfig(request, env));
      if (url.pathname === "/api/v1/paypal/orders") return cors(await handleCreatePayPalOrder(request, env));
      if (/^\/api\/v1\/paypal\/orders\/[^/]+\/capture$/.test(url.pathname)) {
        return cors(await handleCapturePayPalOrder(request, env, url));
      }
      if (url.pathname === "/api/v1/licenses/activate") return cors(await handleActivation(request, env));
      return cors(json({ error: "not_found" }, 404));
    } catch (error) {
      console.error(JSON.stringify({ event: "request_failed", path: url.pathname, error: String(error) }));
      return cors(json({ error: "service_unavailable" }, 503));
    }
  },
} satisfies ExportedHandler<Env>;

async function handleUpdateCheck(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 6) return json({ error: "invalid_update_path" }, 400);

  const target = parts[3];
  const arch = parts[4];
  const currentVersion = parts[5];
  const channel = url.searchParams.get("channel") ?? "stable";
  const platformKey = `${target}-${arch}`;
  const catalog = await readCatalog(env.RELEASES_BUCKET);
  if (!catalog) return json({ error: "release_catalog_unavailable" }, 503);

  const releases = catalog.releases
    .filter((release) => release.published && release.channel === channel)
    .sort((left, right) => compareVersions(right.version, left.version));
  if (releases.length === 0) return new Response(null, { status: 204 });

  const metadata = releases.find((release) => release.platforms[platformKey]);
  if (!metadata) return json({ error: "platform_not_found" }, 404);

  if (requiresLicense(env)) {
    const authorization = await authorizeRequest(request, env);
    if (!authorization.ok) return authorization.response;
  }

  if (compareVersions(metadata.version, currentVersion) <= 0) return new Response(null, { status: 204 });

  const platform = metadata.platforms[platformKey];
  const signature = await readObjectText(env.RELEASES_BUCKET, platform.signature);
  if (signature === null) return json({ error: "signature_not_found" }, 503);

  return json({
    version: metadata.version,
    notes: metadata.notes,
    pub_date: metadata.pub_date,
    url: `https://download.sagraph.top/api/v1/releases/${encodePath(platform.artifact)}`,
    signature,
  });
}

async function handleReleaseCatalog(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const catalog = await readCatalog(env.RELEASES_BUCKET);
  return catalog
    ? json(catalog, 200, { "cache-control": "public, max-age=300" })
    : json({ error: "release_catalog_unavailable" }, 503);
}

async function handlePayPalConfig(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  if (!env.PAYPAL_CLIENT_ID) return json({ error: "paypal_not_configured" }, 503);
  return json({
    client_id: env.PAYPAL_CLIENT_ID,
    currency: "USD",
    plans: Object.entries(plans).map(([id, plan]) => ({ id, label: plan.label, amount: plan.amount, term: plan.term })),
  }, 200, { "cache-control": "public, max-age=300" });
}

async function handleCreatePayPalOrder(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!commerceConfigured(env)) return json({ error: "commerce_not_configured" }, 503);
  const input = await readRequestJson<PayPalOrderRequest>(request);
  if (!input || !isPlanId(input.plan_id)) return json({ error: "invalid_plan" }, 400);

  const plan = plans[input.plan_id];
  const order = await paypalRequest<PayPalOrder>(env, "/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: "sagraph-license",
        custom_id: input.plan_id,
        description: `saGraph ${plan.label} license`,
        amount: { currency_code: "USD", value: plan.amount },
      }],
      payment_source: { paypal: { experience_context: { brand_name: "saGraph", shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" } } },
    }),
  });

  await upsertOrder(env.DB!, order, input.plan_id, plan.amount);
  return json({ id: order.id });
}

async function handleCapturePayPalOrder(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!commerceConfigured(env)) return json({ error: "commerce_not_configured" }, 503);
  const input = await readRequestJson<ActivationRequest>(request);
  if (!input) return json({ error: "invalid_json" }, 400);
  const machineCode = input.machine_code?.trim().toUpperCase();
  if (!machineCode || !isMachineCode(machineCode)) return json({ error: "machine_code_invalid" }, 400);
  const orderId = decodeURIComponent(url.pathname.split("/").filter(Boolean)[4]);

  let order = await getPayPalOrder(env, orderId);
  if (order.status !== "COMPLETED") {
    order = await paypalRequest<PayPalOrder>(env, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: "POST",
      body: "{}",
    });
  }
  if (order.status !== "COMPLETED") order = await getPayPalOrder(env, orderId);
  return issueActivation(env, order, machineCode);
}

async function handleActivation(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!commerceConfigured(env)) return json({ error: "commerce_not_configured" }, 503);
  const input = await readRequestJson<ActivationRequest>(request);
  if (!input) return json({ error: "invalid_json" }, 400);
  const orderId = input.order_id?.trim();
  const machineCode = input.machine_code?.trim().toUpperCase();
  if (!orderId) return json({ error: "order_id_required" }, 400);
  if (!machineCode || !isMachineCode(machineCode)) return json({ error: "machine_code_invalid" }, 400);

  const order = await getPayPalOrder(env, orderId);
  return issueActivation(env, order, machineCode);
}

async function issueActivation(env: Env, order: PayPalOrder, machineCode: string): Promise<Response> {
  if (!env.DB || !env.LICENSE_SIGNING_PRIVATE_KEY) return json({ error: "commerce_not_configured" }, 503);
  if (order.status !== "COMPLETED") return json({ error: "paypal_order_not_completed" }, 409);

  const purchase = resolvePurchase(order);
  if (!purchase) return json({ error: "paypal_order_invalid" }, 400);
  const plan = plans[purchase.planId];
  if (purchase.currency !== "USD" || purchase.amount !== plan.amount) return json({ error: "paypal_amount_mismatch" }, 400);

  await upsertOrder(env.DB, order, purchase.planId, purchase.amount);
  const current = await env.DB.prepare(
    "SELECT order_id, status, plan_id, amount, currency, machine_code, activation_hash, term, expires_on FROM orders WHERE order_id = ? LIMIT 1",
  ).bind(order.id).first<OrderRecord>();
  if (current?.machine_code && current.machine_code !== machineCode) {
    return json({ error: "order_already_activated" }, 409);
  }

  const expiresOn = current?.expires_on ?? expirationFor(plan.days);
  const activationCode = await createActivationCode(env.LICENSE_SIGNING_PRIVATE_KEY, machineCode, plan.term, expiresOn);
  const activationHash = await sha256Hex(activationCode);
  const result = await env.DB.prepare(
    "UPDATE orders SET status = 'COMPLETED', machine_code = ?, activation_hash = ?, term = ?, expires_on = ?, payer_email = ?, activated_at = ?, updated_at = ? WHERE order_id = ? AND (machine_code IS NULL OR machine_code = ?)",
  ).bind(
    machineCode,
    activationHash,
    plan.term,
    expiresOn,
    order.payer?.email_address ?? null,
    new Date().toISOString(),
    new Date().toISOString(),
    order.id,
    machineCode,
  ).run();
  if (!result.success || result.meta.changes !== 1) return json({ error: "order_already_activated" }, 409);

  return json({
    activation_key: activationCode,
    order_id: order.id,
    machine_code: machineCode,
    term: plan.term,
    expires_on: expiresOn,
  });
}

async function handleDownload(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "method_not_allowed" }, 405);
  const prefix = "/api/v1/releases/";
  if (!url.pathname.startsWith(prefix)) return json({ error: "not_found" }, 404);

  if (requiresLicense(env)) {
    const authorization = await authorizeRequest(request, env);
    if (!authorization.ok) return authorization.response;
  }

  let objectKey: string;
  try {
    objectKey = decodeURIComponent(url.pathname.slice(prefix.length));
  } catch {
    return json({ error: "invalid_object_key" }, 400);
  }
  if (!isSafeReleaseKey(objectKey)) return json({ error: "invalid_object_key" }, 400);

  const object = await env.RELEASES_BUCKET.get(`releases/${objectKey}`);
  if (!object) return json({ error: "release_not_found" }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=300");
  headers.set("x-content-type-options", "nosniff");
  return new Response(request.method === "HEAD" ? null : object.body, { headers });
}

async function upsertOrder(db: D1Database, order: PayPalOrder, planId: PlanId, amount: string): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(
    "INSERT INTO orders (order_id, status, plan_id, amount, currency, payer_email, created_at, updated_at) VALUES (?, ?, ?, ?, 'USD', ?, ?, ?) ON CONFLICT(order_id) DO UPDATE SET status = excluded.status, payer_email = COALESCE(excluded.payer_email, orders.payer_email), updated_at = excluded.updated_at",
  ).bind(order.id, order.status, planId, amount, order.payer?.email_address ?? null, now, now).run();
}

async function getPayPalOrder(env: Env, orderId: string): Promise<PayPalOrder> {
  return paypalRequest<PayPalOrder>(env, `/v2/checkout/orders/${encodeURIComponent(orderId)}`);
}

async function paypalRequest<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  const clientId = env.PAYPAL_CLIENT_ID;
  const clientSecret = env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("paypal_not_configured");
  const baseUrl = env.PAYPAL_BASE_URL ?? "https://api-m.paypal.com";
  const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!tokenResponse.ok) throw new Error(`paypal_oauth_${tokenResponse.status}`);
  const token = await tokenResponse.json<{ access_token?: string }>();
  if (!token.access_token) throw new Error("paypal_access_token_missing");

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token.access_token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`paypal_api_${response.status}`);
  return response.json<T>();
}

function resolvePurchase(order: PayPalOrder): { planId: PlanId; amount: string; currency: string } | null {
  const unit = order.purchase_units?.[0];
  const captured = unit?.payments?.captures?.[0]?.amount;
  const amount = captured?.value ?? unit?.amount?.value;
  const currency = captured?.currency_code ?? unit?.amount?.currency_code;
  if (!amount || !currency || !unit?.custom_id || !isPlanId(unit.custom_id)) return null;
  return { planId: unit.custom_id, amount, currency };
}

async function createActivationCode(privateKeyPem: string, machineCode: string, term: string, expiresOn: string): Promise<string> {
  const data = `type=PERSONAL;term=${term};id=${machineCode};exp=${expiresOn}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemBytes(privateKeyPem, "PRIVATE KEY"),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(data));
  const signatureHex = Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return btoa(`${data}|${signatureHex}`);
}

function pemBytes(pem: string, label: string): ArrayBuffer {
  const contents = pem
    .replace(`-----BEGIN ${label}-----`, "")
    .replace(`-----END ${label}-----`, "")
    .replace(/\s+/g, "");
  const binary = atob(contents);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer;
}

function expirationFor(days: number | null): string {
  if (days === null) return "NEVER";
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isExpired(expiresOn: string | null): boolean {
  return !expiresOn || (expiresOn !== "NEVER" && expiresOn < new Date().toISOString().slice(0, 10));
}

function commerceConfigured(env: Env): boolean {
  return Boolean(env.DB && env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET && env.LICENSE_SIGNING_PRIVATE_KEY);
}

function isPlanId(value: string): value is PlanId {
  return Object.prototype.hasOwnProperty.call(plans, value);
}

function isMachineCode(value: string): boolean {
  return /^SAG-[A-Z0-9]{12,}$/.test(value);
}

async function readRequestJson<T>(request: Request): Promise<T | null> {
  try {
    return await request.json<T>();
  } catch {
    return null;
  }
}

async function readJson<T>(bucket: R2Bucket, key: string): Promise<T | null> {
  const object = await bucket.get(key);
  if (!object) return null;
  try {
    return JSON.parse(await object.text()) as T;
  } catch {
    return null;
  }
}

async function readObjectText(bucket: R2Bucket, key: string): Promise<string | null> {
  const object = await bucket.get(key);
  return object ? object.text() : null;
}

async function readCatalog(bucket: R2Bucket): Promise<ReleaseCatalog | null> {
  const raw = await readJson<Record<string, unknown>>(bucket, "releases/catalog.json");
  if (!raw) return null;
  if (Array.isArray(raw.releases)) return { releases: raw.releases as CatalogRelease[] };
  if (typeof raw.signed_payload === "string") {
    try {
      const legacy = JSON.parse(raw.signed_payload) as { document?: { releases?: CatalogRelease[] } };
      if (Array.isArray(legacy.document?.releases)) return { releases: legacy.document.releases };
    } catch {
      return null;
    }
  }
  return null;
}

async function authorizeRequest(request: Request, env: Env): Promise<{ ok: true } | { ok: false; response: Response }> {
  const proof = decodeUpdateProof(request.headers.get("x-sagraph-license-proof"));
  if (!proof) return { ok: false, response: json({ error: "license_proof_required" }, 401) };
  if (proof.provider === "paypal") return authorizePayPalProof(proof, env);
  return authorizeMicrosoftStoreProof(proof);
}

async function authorizePayPalProof(proof: UpdateProof, env: Env): Promise<{ ok: true } | { ok: false; response: Response }> {
  const licenseToken = proof.license_token?.trim();
  const machineCode = proof.device_id?.trim().toUpperCase();
  if (!env.DB || !licenseToken || !machineCode || !isMachineCode(machineCode)) {
    return { ok: false, response: json({ error: "license_proof_invalid" }, 403) };
  }
  const activationHash = await sha256Hex(licenseToken);
  const order = await env.DB.prepare(
    "SELECT status, expires_on FROM orders WHERE activation_hash = ? AND machine_code = ? LIMIT 1",
  ).bind(activationHash, machineCode).first<{ status: string; expires_on: string | null }>();
  return order?.status === "COMPLETED" && !isExpired(order.expires_on)
    ? { ok: true }
    : { ok: false, response: json({ error: "license_not_authorized" }, 403) };
}

function authorizeMicrosoftStoreProof(proof: UpdateProof): { ok: true } | { ok: false; response: Response } {
  const expiration = proof.expiration_unix_ms;
  const active = proof.supported === true
    && proof.package_identity_available === true
    && proof.active === true
    && ["SUBSCRIPTION", "PERPETUAL"].includes(proof.entitlement_kind ?? "")
    && (expiration === null || (typeof expiration === "number" && expiration > Date.now()));
  return active
    ? { ok: true }
    : { ok: false, response: json({ error: "microsoft_store_not_authorized" }, 403) };
}

function decodeUpdateProof(value: string | null): UpdateProof | null {
  if (!value || value.length > 16_384) return null;
  try {
    const proof = JSON.parse(new TextDecoder().decode(base64UrlDecode(value))) as UpdateProof;
    return proof && (proof.provider === "paypal" || proof.provider === "microsoft_store") ? proof : null;
  } catch {
    return null;
  }
}

function requiresLicense(env: Env): boolean {
  return env.REQUIRE_LICENSE === "1" || env.REQUIRE_LICENSE === "true";
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function compareVersions(left: string, right: string): number {
  const parse = (value: string) => value.replace(/^v/, "").split("-")[0].split(".").map((part) => Number.parseInt(part, 10) || 0);
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) - (b[index] ?? 0);
  }
  return 0;
}

function isSafeReleaseKey(key: string): boolean {
  return key.length > 0 && !key.includes("..") && !key.startsWith("/") && !key.includes("\\");
}

function encodePath(value: string): string {
  const releasePrefix = "releases/";
  const relative = value.startsWith(releasePrefix) ? value.slice(releasePrefix.length) : value;
  return relative.split("/").map(encodeURIComponent).join("/");
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function cors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET,HEAD,POST,OPTIONS");
  headers.set("access-control-allow-headers", "Authorization,Content-Type,X-SaGraph-License-Proof");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
