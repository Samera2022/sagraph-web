interface Env {
  RELEASES_BUCKET: R2Bucket;
}

const json = (body: unknown, status = 200): Response =>
  Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "method_not_allowed" }, 405);
    }

    if (url.hostname === "download.sagraph.top") {
      return handleDownload(request, env, url);
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ ok: true, service: "sagraph-api" });
    }

    return json({ error: "not_found" }, 404);
  },
} satisfies ExportedHandler<Env>;

async function handleDownload(request: Request, env: Env, url: URL): Promise<Response> {
  const prefix = "/api/v1/releases/";
  if (!url.pathname.startsWith(prefix)) {
    return json({ error: "not_found" }, 404);
  }

  const objectKey = decodeURIComponent(url.pathname.slice(prefix.length));
  if (!objectKey || objectKey.includes("..")) {
    return json({ error: "invalid_object_key" }, 400);
  }

  const object = await env.RELEASES_BUCKET.get(`releases/${objectKey}`);
  if (!object) {
    return json({ error: "release_not_found" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=300");
  headers.set("x-content-type-options", "nosniff");

  return new Response(request.method === "HEAD" ? null : object.body, { headers });
}
