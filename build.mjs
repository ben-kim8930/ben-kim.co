// content.txt 의 문구를 template.html 에 넣어 index.html 을 만든다.
// 형식이 어긋나면 실패로 끝나고, 그때는 이전 버전이 사이트에 그대로 남는다.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SECTIONS = 6;
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (t) => esc(t).replace(/"/g, "&quot;");
// [글자](주소) 를 새 창으로 열리는 링크로 바꾼다
const inline = (t) => {
  let out = "", last = 0;
  for (const m of t.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)) {
    out += esc(t.slice(last, m.index));
    out += `<a target="_blank" rel="noopener" href="${escAttr(m[2])}">${esc(m[1])}</a>`;
    last = m.index + m[0].length;
  }
  return out + esc(t.slice(last));
};
const fail = (msg) => { console.error("content.txt 오류: " + msg); process.exit(1); };

const items = [];
let cur = null;
readFileSync("content.txt", "utf8").split(/\r?\n/).forEach((raw, n) => {
  const line = raw.trim();
  if (!line || line.startsWith("#")) return;
  if (line.startsWith("==")) { cur = { bullets: [] }; items.push(cur); return; }
  if (!cur) fail(`${n + 1}번째 줄: '== 1' 구분 줄보다 앞에 내용이 있습니다.`);
  const f = line.match(/^(연도|이름|직함)\s*[:：]\s*(.*)$/);
  if (f) { cur[{ 연도: "year", 이름: "name", 직함: "role" }[f[1]]] = f[2].trim(); return; }
  if (/^[-–•]\s*/.test(line)) { cur.bullets.push(line.replace(/^[-–•]\s*/, "")); return; }
  fail(`${n + 1}번째 줄을 읽을 수 없습니다: "${line}"`);
});
if (items.length !== SECTIONS) fail(`구분 줄(==)이 ${SECTIONS}개여야 하는데 ${items.length}개입니다.`);
items.forEach((it, i) => {
  for (const [k, label] of [["year", "연도"], ["name", "이름"], ["role", "직함"]])
    if (!it[k]) fail(`${i + 1}번 항목에 '${label}:' 줄이 없거나 비어 있습니다.`);
  if (!it.bullets.length) fail(`${i + 1}번 항목에 '- ' 로 시작하는 줄이 하나도 없습니다.`);
});

let html = readFileSync("template.html", "utf8");
items.forEach((it, i) => {
  const ul = "<ul>\n" + it.bullets.map((b) => `          <li>${inline(b)}</li>`).join("\n") + "\n        </ul>";
  const map = { year: esc(it.year), name: esc(it.name), role: inline(it.role), bullets: ul };
  for (const [k, v] of Object.entries(map)) {
    const key = `{{${i}.${k}}}`;
    if (!html.includes(key)) fail(`template.html 에 ${key} 자리가 없습니다.`);
    html = html.split(key).join(v);
  }
});
// 프로젝트 이미지 띠: /admin 에서 관리하는 projects.json 을 읽는다. 보일 이미지가 없으면 띠를 아예 넣지 않는다.
// 원본 대신 scripts/optimize-images.mjs 가 만든 가벼운 WebP 가 있으면 그것을 쓴다
const webVersion = (p) => {
  const m = p.match(/^\/img\/projects\/([^/]+)\.[^./]+$/);
  if (!m) return p;
  const web = `img/projects/web/${m[1]}.webp`;
  return existsSync(web) ? "/" + web : p;
};
let reelItems = [];
if (existsSync("projects.json")) {
  let data;
  try { data = JSON.parse(readFileSync("projects.json", "utf8")); } catch (e) { fail("projects.json 을 읽을 수 없습니다: " + e.message); }
  reelItems = (Array.isArray(data?.items) ? data.items : [])
    .filter((it) => it && it.image && !it.hidden)
    .map((it) => ({
      image: webVersion(String(it.image)),
      title: String(it.title || ""),
      year: String(it.year || ""),
      link: /^https?:\/\//.test(it.link || "") ? String(it.link) : "",
    }));
}
if (!html.includes("{{reel}}")) fail("template.html 에 {{reel}} 자리가 없습니다.");
const reelHtml = reelItems.length
  ? readFileSync("parts/reel.html", "utf8").replace("{{reel.data}}", () => JSON.stringify(reelItems).replace(/</g, "\\u003c"))
  : "";
html = html.replace(/\{\{reel\}\}\n?/, () => reelHtml);

writeFileSync("index.html", html);
console.log(`index.html 생성 완료 (${items.length}개 항목, 프로젝트 이미지 ${reelItems.length}장)`);
