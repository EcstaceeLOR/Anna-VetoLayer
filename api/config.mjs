import { preflight } from "./_lib/http.mjs";

export default function handler(request, response) {
  response.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  if (preflight(request, response)) return;
  if (request.method !== "GET") return response.status(405).json({ error: "method_not_allowed" });

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) return response.status(503).json({ error: "portal_not_configured" });
  return response.status(200).json({ publishableKey });
}
