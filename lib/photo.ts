import exifr from "exifr";

export type PhotoMeta = {
  shotBy: string;
  brand: string;
  focalLength: string;
  aperture: string;
  shutter: string;
  iso: string;
  resolution: string;
};

export const EMPTY_META: PhotoMeta = {
  shotBy: "",
  brand: "",
  focalLength: "",
  aperture: "",
  shutter: "",
  iso: "",
  resolution: "",
};
export const DEFAULT_META: PhotoMeta = {
  shotBy: "iPhone 18 Pro",
  brand: "Apple",
  focalLength: "100",
  aperture: "2.8",
  shutter: "1/607",
  iso: "50",
  resolution: "",
};

export const FONT = `-apple-system, "SF Pro Text", "Helvetica Neue", Inter, Arial, sans-serif`;

/* ---------- Frame styles ---------- */
export type FrameId = "white" | "black" | "polaroid";
type Tone = { label: string; strong: string; normal: string; spec: string };
export type Frame = {
  label: string;
  bg: string;
  pad: number;
  cap: number;
  scale: number;
  tone: Tone;
};

const LIGHT: Tone = {
  label: "#8a8a8a",
  strong: "#111111",
  normal: "#3f3f3f",
  spec: "#9a9a9a",
};

export const FRAMES: Record<FrameId, Frame> = {
  white: {
    label: "White",
    bg: "#ffffff",
    pad: 0.025,
    cap: 0.12,
    scale: 1,
    tone: LIGHT,
  },
  black: {
    label: "Black",
    bg: "#0b0b0c",
    pad: 0.025,
    cap: 0.12,
    scale: 1,
    tone: {
      label: "#8a8a8a",
      strong: "#f5f5f5",
      normal: "#c4c4c4",
      spec: "#7a7a7a",
    },
  },
  polaroid: {
    label: "Polaroid",
    bg: "#fbfaf6",
    pad: 0.05,
    cap: 0.22,
    scale: 1.35,
    tone: LIGHT,
  },
};

/* Caption line geometry, as ratios of card width (PhotoCard uses the same numbers via cqw). */
export const LINE = {
  y1: 0.4,
  y2: 0.63,
  size1: 0.019,
  size2: 0.014,
  gap1: 0.0065,
  gap2: 0.011,
};

export type CaptionItem = { text: string; weight: number; color: string };

const strip = (v: string, re: RegExp) => v.trim().replace(re, "").trim();

export function getCaption(m: PhotoMeta, frame: FrameId = "white") {
  const t = FRAMES[frame].tone;
  const headline: CaptionItem[] = [];
  const shotBy = m.shotBy.trim();
  const brand = m.brand.trim();
  if (shotBy)
    headline.push(
      { text: "Shot on", weight: 400, color: t.label },
      { text: shotBy, weight: 700, color: t.strong },
    );
  if (brand) headline.push({ text: brand, weight: 400, color: t.normal });

  const focal = strip(m.focalLength, /mm$/i);
  const ap = strip(m.aperture, /^f\/?/i);
  const sh = m.shutter.trim();
  const iso = strip(m.iso, /^iso/i);

  const specs: CaptionItem[] = [
    focal && `${focal}mm`,
    ap && `f/${ap}`,
    sh && (sh.endsWith("s") ? sh : `${sh}s`),
    iso && `ISO${iso}`,
    m.resolution.trim(),
  ]
    .filter((s): s is string => Boolean(s))
    .map((text) => ({ text, weight: 400, color: t.spec }));

  return { headline, specs };
}

/* ---------- EXIF auto-fill ---------- */
export async function readExif(file: File): Promise<Partial<PhotoMeta>> {
  try {
    const e = await exifr.parse(file, [
      "Make",
      "Model",
      "FocalLength",
      "FocalLengthIn35mmFormat",
      "FNumber",
      "ExposureTime",
      "ISO",
    ]);
    if (!e) return {};
    const out: Partial<PhotoMeta> = {};
    const model = String(e.Model ?? "").trim();
    const make = String(e.Make ?? "").trim();
    if (model) out.shotBy = model;
    if (make && !model.toLowerCase().startsWith(make.toLowerCase()))
      out.brand = make;
    const focal = e.FocalLengthIn35mmFormat ?? e.FocalLength;
    if (focal) out.focalLength = String(Math.round(focal));
    if (e.FNumber) out.aperture = String(Math.round(e.FNumber * 10) / 10);
    if (e.ExposureTime)
      out.shutter =
        e.ExposureTime < 1
          ? `1/${Math.round(1 / e.ExposureTime)}`
          : String(e.ExposureTime);
    if (e.ISO) out.iso = String(Array.isArray(e.ISO) ? e.ISO[0] : e.ISO);
    return out;
  } catch {
    return {};
  }
}

/* ---------- Export ---------- */
export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function renderCardBlob(
  src: string,
  meta: PhotoMeta,
  frameId: FrameId = "white",
): Promise<Blob> {
  const f = FRAMES[frameId];
  const img = new Image();
  img.src = src;
  await img.decode();

  const W = Math.round(
    Math.min(3200, Math.max(1200, img.naturalWidth / (1 - f.pad * 2))),
  );
  const pad = W * f.pad;
  const pw = W - pad * 2;
  const ph = (pw * img.naturalHeight) / img.naturalWidth;
  const cap = W * f.cap;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = Math.round(pad + ph + cap);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = f.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, pad, pad, pw, ph);

  ctx.textBaseline = "middle";
  const row = (items: CaptionItem[], size: number, gap: number, y: number) => {
    const font = (it: CaptionItem) => `${it.weight} ${size}px ${FONT}`;
    const widths = items.map((it) => {
      ctx.font = font(it);
      return ctx.measureText(it.text).width;
    });
    let x =
      (W -
        (widths.reduce((a, b) => a + b, 0) +
          gap * Math.max(0, items.length - 1))) /
      2;
    items.forEach((it, i) => {
      ctx.font = font(it);
      ctx.fillStyle = it.color;
      ctx.fillText(it.text, x, y);
      x += widths[i] + gap;
    });
  };

  const { headline, specs } = getCaption(meta, frameId);
  const top = pad + ph;
  row(
    headline,
    W * LINE.size1 * f.scale,
    W * LINE.gap1 * f.scale,
    top + cap * LINE.y1,
  );
  row(
    specs,
    W * LINE.size2 * f.scale,
    W * LINE.gap2 * f.scale,
    top + cap * LINE.y2,
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Export failed"))),
      "image/png",
    ),
  );
}
