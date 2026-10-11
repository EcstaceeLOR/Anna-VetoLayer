import { verifyToken } from "@clerk/backend";

export async function authenticate(request) {
  const header = String(request.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw Object.assign(new Error("Authentication required."), { statusCode: 401 });
  if (!process.env.CLERK_SECRET_KEY) throw new Error("CLERK_SECRET_KEY is not configured.");
  const authorizedParties = String(process.env.REVIEW_AUTHORIZED_PARTIES || "").split(",").map((value) => value.trim()).filter(Boolean);
  try {
    const claims = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY, ...(authorizedParties.length ? { authorizedParties } : {}) });
    return { userId: claims.sub };
  } catch {
    throw Object.assign(new Error("Invalid authentication token."), { statusCode: 401 });
  }
}
