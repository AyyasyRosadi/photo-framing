import {
  ASPECTS,
  FONT_FAMILY,
  FONT_FILES,
  FONT_STACK,
  FORMATS,
  FRAMES,
  getCaption,
  type CaptionItem,
  type PhotoMeta,
  type RenderOptions,
} from "./photo";

/* Runs inside a Web Worker (see render.worker.ts) and also works on the main thread as a fallback. */

export type Job =
  | {
      kind: "render";
      source: Blob;
      meta: PhotoMeta;
      options: Partial<RenderOptions>;
    }
  | { kind: "preview"; source: Blob; max?: number };
export type JobResult = { blob: Blob; w?: number; h?: number };

type Canvas = OffscreenCanvas | HTMLCanvasElement;
type Ctx = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

let fontsReady: Promise<void> | null = null;
function loadFonts(): Promise<void> {
  fontsReady ??= (async () => {
    try {
      if (typeof document !== "undefined") {
        await Promise.all(
          FONT_FILES.map((f) =>
            document.fonts.load(`${f.weight} 20px "${FONT_FAMILY}"`),
          ),
        );
      } else {
        const set = (self as unknown as { fonts: FontFaceSet }).fonts;
        await Promise.all(
          FONT_FILES.map(async (f) => {
            set.add(
              await new FontFace(FONT_FAMILY, `url(${f.url})`, {
                weight: String(f.weight),
              }).load(),
            );
          }),
        );
      }
    } catch {
      /* fall back to system fonts */
    }
  })();
  return fontsReady;
}

function makeCanvas(w: number, h: number): Canvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function canvasToBlob(c: Canvas, type: string, quality: number): Promise<Blob> {
  if ("convertToBlob" in c) return c.convertToBlob({ type, quality });
  return new Promise((res, rej) =>
    c.toBlob(
      (b) => (b ? res(b) : rej(new Error("Export failed"))),
      type,
      quality,
    ),
  );
}

/** Small JPEG copy for the interface (keeps memory low). Also reports the original size. */
async function makePreview(source: Blob, max = 1200): Promise<JobResult> {
  const bmp = await createImageBitmap(source, {
    imageOrientation: "from-image",
  });
  const { width: w, height: h } = bmp;
  const scale = Math.min(1, max / Math.max(w, h));
  let blob: Blob = source;
  if (scale < 1) {
    const c = makeCanvas(Math.round(w * scale), Math.round(h * scale));
    const ctx = c.getContext("2d") as Ctx;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    blob = await canvasToBlob(c, "image/jpeg", 0.85);
  }
  bmp.close();
  return { blob, w, h };
}

/** Draws the finished card from the ORIGINAL photo and returns the encoded image. */
async function renderCard(
  source: Blob,
  meta: PhotoMeta,
  o: Partial<RenderOptions>,
): Promise<JobResult> {
  const {
    frame: frameId = "white",
    aspect = "original",
    focus = { x: 0.5, y: 0.5 },
    format = "png",
    quality = 0.92,
  } = o;
  const f = FRAMES[frameId];
  await loadFonts();

  const img = await createImageBitmap(source, {
    imageOrientation: "from-image",
  });
  const ratio = ASPECTS[aspect].ratio ?? img.width / img.height;
  const sw = Math.min(img.width, img.height * ratio);
  const sh = sw / ratio;

  const W = Math.round(Math.min(3200, Math.max(1200, sw / (1 - f.pad * 2))));
  const pad = W * f.pad;
  const pw = W - pad * 2;
  const ph = pw / ratio;
  const cap = W * f.cap;

  const canvas = makeCanvas(W, Math.round(pad + ph + cap));
  const ctx = canvas.getContext("2d") as Ctx;
  ctx.fillStyle = f.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    img,
    (img.width - sw) * focus.x,
    (img.height - sh) * focus.y,
    sw,
    sh,
    pad,
    pad,
    pw,
    ph,
  );
  img.close();

  ctx.textBaseline = "middle";
  for (const line of getCaption(meta, frameId)) {
    const size = W * line.size;
    const gap = W * line.gap;
    const font = (it: CaptionItem) => `${it.weight} ${size}px ${FONT_STACK}`;
    const widths = line.items.map((it) => {
      ctx.font = font(it);
      return ctx.measureText(it.text).width;
    });
    let x =
      (W -
        (widths.reduce((a, b) => a + b, 0) + gap * (line.items.length - 1))) /
      2;
    const y = pad + ph + cap * line.y;
    line.items.forEach((it, i) => {
      ctx.font = font(it);
      ctx.fillStyle = it.color;
      ctx.fillText(it.text, x, y);
      x += widths[i] + gap;
    });
  }

  return { blob: await canvasToBlob(canvas, FORMATS[format].mime, quality) };
}

export function execute(job: Job): Promise<JobResult> {
  return job.kind === "preview"
    ? makePreview(job.source, job.max)
    : renderCard(job.source, job.meta, job.options);
}
