// img/projects/ 의 원본 사진마다 띠에 쓸 가벼운 WebP(높이 600px)를 img/projects/web/ 에 만든다.
// 원본은 그대로 두고, 이미 만든 파일은 건너뛴다. GitHub Actions 에서 sharp 로 실행된다.
import { readdirSync, mkdirSync, existsSync } from "node:fs";
import sharp from "sharp";

const SRC = "img/projects";
const OUT = "img/projects/web";
mkdirSync(OUT, { recursive: true });

let made = 0;
for (const f of readdirSync(SRC)) {
  if (!/\.(png|jpe?g|webp|gif|avif|tiff?)$/i.test(f)) continue;
  const src = `${SRC}/${f}`;
  const out = `${OUT}/${f.replace(/\.[^.]+$/, "")}.webp`;
  if (existsSync(out)) continue;
  await sharp(src).rotate().resize({ height: 600, withoutEnlargement: true }).webp({ quality: 80 }).toFile(out);
  made++;
  console.log("만듦:", out);
}
console.log(`띠용 이미지 ${made}장 새로 만듦`);
