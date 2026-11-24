// posts/*.md (관리 화면의 '글')를 읽어 /blog 목록과 글 페이지를 만든다.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";

const SITE = "https://ben-kim.co";
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (t) => esc(t).replace(/"/g, "&quot;");

// 관리 화면이 쓰는 머리말(--- 사이)을 읽는다: 한 줄 값, 따옴표 값, 여러 줄(| >) 값
function parseFront(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: src };
  const data = {}, lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let [, k, v] = kv;
    if (/^[|>][-+]?$/.test(v)) {
      const fold = v[0] === ">", buf = [];
      while (i + 1 < lines.length && (/^\s+/.test(lines[i + 1]) || lines[i + 1] === "")) buf.push(lines[++i].replace(/^\s{2}/, ""));
      v = fold ? buf.join(" ").replace(/\s+/g, " ").trim() : buf.join("\n").trim();
    } else if (/^".*"$/.test(v)) {
      try { v = JSON.parse(v); } catch { v = v.slice(1, -1); }
    } else if (/^'.*'$/.test(v)) {
      v = v.slice(1, -1).replace(/''/g, "'");
    } else if (v === "true" || v === "false") {
      v = v === "true";
    }
    data[k] = v;
  }
  return { data, body: m[2] };
}

const plain = (html) => html.replace(/<\/(p|h\d|li|blockquote|pre|tr)>|<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&[a-z#0-9]+;/gi, (e) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" }[e] || " ")).replace(/\s+/g, " ").trim();
const cut = (t, n) => (t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + "…" : t);
const fmtDate = (d) => (d || "").replace(/-/g, ".");

export function loadPosts() {
  if (!existsSync("posts")) return [];
  const require = createRequire(import.meta.url);
  const { marked } = require("marked");
  const posts = [];
  for (const f of readdirSync("posts")) {
    if (!f.endsWith(".md")) continue;
    const { data, body } = parseFront(readFileSync(`posts/${f}`, "utf8"));
    if (data.draft === true || !data.title) continue;
    const slug = f.replace(/\.md$/, "");
    const html = marked.parse(body, { gfm: true, breaks: true });
    const text = plain(html);
    // 날짜는 "2026-11-24 12:10" 처럼 시간까지 들어온다: 화면엔 날짜만, 정렬은 시간까지
    const stamp = String(data.date || "").trim().replace("T", " ");
    const date = stamp.slice(0, 10);
    posts.push({
      slug, title: String(data.title), date, stamp, category: String(data.category || ""),
      summary: String(data.summary || "") || cut(text, 110),
      html, url: `/blog/${encodeURIComponent(slug)}/`,
    });
  }
  return posts.sort((a, b) => b.stamp.localeCompare(a.stamp) || b.slug.localeCompare(a.slug));
}

// 메인 페이지 강연 아래 '글' 묶음: 최근 3개
export function recentHtml(posts) {
  if (!posts.length) return "";
  const rows = posts.slice(0, 3).map((p) => `      <a class="post-row" href="${escAttr(p.url)}"><span class="year">${esc(fmtDate(p.date))}</span><span class="post-main"><span class="post-title">${esc(p.title)}</span><span class="post-sum">${esc(p.summary)}</span></span></a>`).join("\n");
  return `  <div class="group">
    <h2 class="label">글</h2>
    <div class="posts">
${rows}
    </div>
    <a class="post-more" href="/blog/">전체 보기 ${posts.length}</a>
  </div>
`;
}

export function buildBlog(posts, templateHtml) {
  const head = templateHtml.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/)[0];
  const style = templateHtml.match(/<style>[\s\S]*?<\/style>/)[0];
  const tpl = readFileSync("parts/blog.html", "utf8");
  const page = (v) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in v ? v[k] : ""));
  const common = { fonts: head, style };

  rmSync("blog", { recursive: true, force: true });
  mkdirSync("blog", { recursive: true });

  const cats = [...new Set(posts.map((p) => p.category).filter(Boolean))];
  const list = posts.length
    ? posts.map((p) => `      <a class="post-row" href="${escAttr(p.url)}" data-cat="${escAttr(p.category)}"><span class="year">${esc(fmtDate(p.date))}</span><span class="post-main">${p.category ? `<span class="post-cat">${esc(p.category)}</span>` : ""}<span class="post-title">${esc(p.title)}</span><span class="post-sum">${esc(p.summary)}</span></span></a>`).join("\n")
    : `      <p class="post-empty">아직 글이 없습니다.</p>`;
  const filters = cats.length > 1
    ? `    <div class="post-filters" role="group" aria-label="분류"><button type="button" class="on" data-f="">전체</button>${cats.map((c) => `<button type="button" data-f="${escAttr(c)}">${esc(c)}</button>`).join("")}</div>\n`
    : "";
  writeFileSync("blog/index.html", page({
    ...common,
    title: "글 · 김종원",
    desc: "김종원이 쓰고 모은 글.",
    canonical: `${SITE}/blog/`,
    ogtype: "website",
    main: `  <div class="group">
    <h1 class="label blog-h">글</h1>
${filters}    <div class="posts">
${list}
    </div>
  </div>`,
  }));

  for (const p of posts) {
    mkdirSync(`blog/${p.slug}`, { recursive: true });
    writeFileSync(`blog/${p.slug}/index.html`, page({
      ...common,
      title: `${esc(p.title)} · 김종원`,
      desc: escAttr(p.summary),
      canonical: `${SITE}${p.url}`,
      ogtype: "article",
      main: `  <article class="post">
    <p class="post-meta">${esc(fmtDate(p.date))}${p.category ? ` · ${esc(p.category)}` : ""}</p>
    <h1 class="post-h">${esc(p.title)}</h1>
    <div class="prose">
${p.html}
    </div>
  </article>
  <a class="post-more" href="/blog/">← 글 목록</a>`,
    }));
  }
}

export function writeSitemap(posts) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${SITE}/`, lastmod: today },
    ...(posts.length ? [{ loc: `${SITE}/blog/`, lastmod: posts[0].date || today }] : []),
    ...posts.map((p) => ({ loc: `${SITE}${p.url}`, lastmod: p.date || today })),
  ];
  writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>\n    <loc>${esc(u.loc)}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n  </url>`).join("\n")}
</urlset>
`);
}
