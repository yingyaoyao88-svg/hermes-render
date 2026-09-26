// 逐帧渲染视频：node render.mjs [--fps 30] [--from 秒] [--to 秒] [--stills 1,5.5,20]
import { chromium } from "playwright";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.join(HERE, "build");
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) =>
  v.startsWith("--") ? [...a, [v.slice(2), arr[i + 1]]] : a, []));
const fps = +(args.fps || 30);
const timeline = JSON.parse(fs.readFileSync(path.join(BUILD, "timeline.json"), "utf8"));

function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { return execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim(); }
  catch { return "ffmpeg"; }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => { console.error("页面错误:", e.message); process.exitCode = 1; });
await page.goto(pathToFileURL(path.join(HERE, "page", "index.html")).href);
await page.evaluate(async (tl) => {
  window.initTimeline(tl);
  await document.fonts.ready;
  // 预加载所有用到的汉字字形
  await Promise.all(["400", "500", "700", "900"].map((w) => document.fonts.load(`${w} 20px "Noto Sans SC"`, document.body.innerText)));
}, timeline);

if (args.stills) {
  const out = path.join(BUILD, "stills");
  fs.mkdirSync(out, { recursive: true });
  for (const s of args.stills.split(",")) {
    await page.evaluate((t) => window.renderAt(t), +s);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(out, `t${(+s).toFixed(1).padStart(6, "0")}.png`) });
  }
  console.log("已输出截图到", out);
  await browser.close();
  process.exit();
}

const from = +(args.from || 0), to = +(args.to || timeline.duration);
const outFile = args.out || path.join(BUILD, "workbuddy-ep01.mp4");
const frames = Math.ceil((to - from) * fps);
const ff = spawn(ffmpegPath(), [
  "-y", "-loglevel", "error",
  "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
  "-ss", String(from), "-i", path.join(BUILD, "voice.wav"),
  "-map", "0:v", "-map", "1:a",
  "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(fps),
  "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", outFile,
], { stdio: ["pipe", "inherit", "inherit"] });

const t0 = Date.now();
for (let i = 0; i < frames; i++) {
  await page.evaluate((t) => window.renderAt(t), from + i / fps);
  const buf = await page.screenshot({ type: "jpeg", quality: 92 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % (fps * 10) === 0) {
    const el = (Date.now() - t0) / 1000;
    console.log(`帧 ${i}/${frames}  (${(from + i / fps).toFixed(1)}s)  已用 ${el.toFixed(0)}s`);
  }
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
console.log("完成:", outFile);
