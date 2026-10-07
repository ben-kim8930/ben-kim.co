// 방문 수 카운터. KV 네임스페이스를 VISITS 라는 이름으로 연결해야 동작한다.
// POST: 1 증가 후 반환, GET: 현재 값만 반환.
export async function onRequest({ request, env }) {
  if (!env.VISITS) return new Response("{}", { status: 503 });
  let n = parseInt((await env.VISITS.get("total")) || "0", 10) || 0;
  if (request.method === "POST") {
    n += 1;
    await env.VISITS.put("total", String(n));
  }
  return Response.json({ count: n }, { headers: { "cache-control": "no-store" } });
}
