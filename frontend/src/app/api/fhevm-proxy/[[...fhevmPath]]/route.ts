import { NextResponse } from "next/server";

const RELAYER_BASE = "https://relayer.testnet.zama.org/v2";

// ── Helpers ────────────────────────────────────────────────────────────────────

function snakeToCamel(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(v => snakeToCamel(v));
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj as object).reduce((acc: Record<string, unknown>, key) => ({
      ...acc,
      [key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())]: snakeToCamel((obj as Record<string, unknown>)[key]),
    }), {});
  }
  return obj;
}

async function fetchUpstream(url: string, init: RequestInit): Promise<{ status: number; data: unknown }> {
  const res = await fetch(url, init);
  const text = await res.text();
  console.log(`[Proxy] ← ${res.status} from ${url.replace(RELAYER_BASE, '')} | ${text.substring(0, 200)}`);
  let data: unknown;
  try { data = snakeToCamel(JSON.parse(text)); }
  catch { data = text; }
  return { status: res.status, data };
}

/**
 * Poll a v2 async job until completion.
 * Returns the final camelCased job object.
 */
async function pollV2Job(endpoint: string, jobId: string, maxMs = 45_000): Promise<Record<string, unknown>> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1500));
    const { data } = await fetchUpstream(`${RELAYER_BASE}/${endpoint}/${jobId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const d = data as Record<string, unknown>;
    const status = d.status as string | undefined;
    console.log(`[Proxy poll ${endpoint}/${jobId}] status=${status}`);
    if (status === "succeeded" || status === "failed") return d;
  }
  throw new Error(`Timeout waiting for ${endpoint} job ${jobId}`);
}

// ── user-decrypt bridge: SDK posts v1 style → we do async v2 dance internally ──

async function handleUserDecryptPost(request: Request): Promise<Response> {
  const body = await request.json().catch(() => ({}));
  console.log("[Proxy user-decrypt POST] Forwarding to v2 start endpoint");

  // 1. Start the async v2 job
  const { status: startStatus, data: startData } = await fetchUpstream(
    `${RELAYER_BASE}/user-decrypt`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );

  if (startStatus >= 400) {
    console.error("[Proxy user-decrypt POST] Upstream error:", JSON.stringify(startData));
    return NextResponse.json(startData, { status: startStatus });
  }

  const sd = startData as Record<string, unknown>;
  const jobId = (sd.jobId ?? sd.id) as string | undefined;

  if (!jobId) {
    // The relayer may have returned shares synchronously (v1 upstream compat).
    // If it already has a `response` key, just pass it through.
    if ("response" in sd) {
      console.log("[Proxy user-decrypt POST] Got synchronous v1-style response, passing through");
      return NextResponse.json(sd, { status: 200 });
    }
    console.error("[Proxy user-decrypt POST] No jobId in start response:", JSON.stringify(sd));
    return NextResponse.json({ error: "No jobId returned", raw: sd }, { status: 502 });
  }

  console.log(`[Proxy user-decrypt POST] Job started: ${jobId}, polling...`);

  // 2. Poll until done
  const finalData = await pollV2Job("user-decrypt", jobId);
  const finalStatus = finalData.status as string;

  if (finalStatus === "failed") {
    console.error("[Proxy user-decrypt POST] Job failed:", JSON.stringify(finalData));
    return NextResponse.json({ error: "KMS decryption job failed", raw: finalData }, { status: 500 });
  }

  // 3. Transform v2 result → v1 format expected by 0.3.0-8 SDK: { response: [...shares] }
  const outerResult = finalData.result as Record<string, unknown> | undefined;
  const shares = (outerResult?.result ?? []) as unknown[];

  console.log(`[Proxy user-decrypt POST] Done — ${shares.length} shares, transforming to v1 format`);
  console.log("[Proxy user-decrypt POST] Shares sample:", JSON.stringify(shares[0] ?? {}));

  // v1 SDK reads json.response and passes it directly to the WASM
  const v1Response = { response: shares };
  return NextResponse.json(v1Response, { status: 200 });
}

// ── input-proof bridge (also synchronous in 0.3.0-8 SDK) ────────────────────

async function handleInputProofPost(request: Request): Promise<Response> {
  const body = await request.json().catch(() => ({}));
  console.log("[Proxy input-proof POST] Starting v2 async job");

  const { status: startStatus, data: startData } = await fetchUpstream(
    `${RELAYER_BASE}/input-proof`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );

  if (startStatus >= 400) {
    return NextResponse.json(startData, { status: startStatus });
  }

  const sd = startData as Record<string, unknown>;

  // If already has a v1 `response` key or known result keys, pass through
  if ("response" in sd || (sd.result && typeof sd.result === "object" && "handles" in (sd.result as object))) {
    return NextResponse.json(sd, { status: 200 });
  }

  const jobId = (sd.jobId ?? sd.id) as string | undefined;
  if (!jobId) {
    return NextResponse.json(sd, { status: startStatus });
  }

  const finalData = await pollV2Job("input-proof", jobId);
  const outerResult = finalData.result as Record<string, unknown> | undefined;

  // v1 SDK reads json.response.handles / json.response.signatures
  const v1Response = {
    response: {
      handles: outerResult?.handles ?? [],
      signatures: outerResult?.signatures ?? [],
      extraData: outerResult?.extraData ?? "0x",
    },
  };
  return NextResponse.json(v1Response, { status: 200 });
}

// ── Generic passthrough ───────────────────────────────────────────────────────

async function proxyRequest(
  request: Request,
  params: { fhevmPath?: string[] },
  method: string
): Promise<Response> {
  const pathParts = params.fhevmPath ?? [];
  // Strip version prefixes (v1, v2) — the SDK uses v1, we always target v2 upstream
  const subPath = pathParts.filter(p => p !== "v1" && p !== "v2").join("/");

  // Intercept user-decrypt and input-proof POSTs for async bridging
  if (method === "POST" && subPath === "user-decrypt") {
    return handleUserDecryptPost(request);
  }
  if (method === "POST" && subPath === "input-proof") {
    return handleInputProofPost(request);
  }

  const targetUrl = `${RELAYER_BASE}/${subPath}`.replace(/\/$/, "");
  console.log(`[Proxy ${method}] → ${targetUrl}`);

  const fetchOptions: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (method === "POST" || method === "PUT") {
    const bodyData = await request.json().catch(() => null);
    if (bodyData) fetchOptions.body = JSON.stringify(bodyData);
  }

  const { status, data } = await fetchUpstream(targetUrl, fetchOptions);
  return NextResponse.json(data, { status });
}

// ── Route exports ─────────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: { fhevmPath?: string[] } }
) {
  try { return await proxyRequest(request, params, "POST"); }
  catch (err: unknown) {
    console.error("[Proxy POST error]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: { fhevmPath?: string[] } }
) {
  try { return await proxyRequest(request, params, "GET"); }
  catch (err: unknown) {
    console.error("[Proxy GET error]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
