// 글 조회수. 방문 수와 같은 KV(VISITS)에 "post:<글주소>" 로 저장한다.
// POST /api/views?slug=글주소   → 1 증가 후 반환 (실제로 있는 글만)
// GET  /api/views?slugs=a,b,c   → 여러 글의 조회수를 한 번에 반환
const ok = (s) => typeof s === "string" && s.length > 0 && s.length <= 200 && !/[\/\\?#]/.test(s);

export async function onRequest({ request, env }) {
  const headers = { "cache-control": "no-store" };
  if (!env.VISITS) return new Response("{}", { status: 503, headers });
  const url = new URL(request.url);

  if (request.method === "POST") {
    const slug = url.searchParams.get("slug");
    if (!ok(slug)) return new Response("{}", { status: 400, headers });
    // 없는 글 주소로 숫자가 쌓이지 않도록, 그 글 페이지가 실제로 있는지 확인한다
    const page = await env.ASSETS.fetch(new URL(`/blog/${encodeURIComponent(slug)}/`, url.origin));
    if (page.status !== 200) return new Response("{}", { status: 404, headers });
    const key = "post:" + slug;
    const n = (parseInt((await env.VISITS.get(key)) || "0", 10) || 0) + 1;
    await env.VISITS.put(key, String(n));
    return Response.json({ count: n }, { headers });
  }

  const slugs = (url.searchParams.get("slugs") || "").split(",").filter(ok).slice(0, 100);
  const counts = {};
  await Promise.all(slugs.map(async (s) => {
    counts[s] = parseInt((await env.VISITS.get("post:" + s)) || "0", 10) || 0;
  }));
  return Response.json({ counts }, { headers });
}
