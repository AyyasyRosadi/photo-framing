import exifr from "exifr";

export type PhotoMeta = {
  shotBy: string;
  brand: string;
  focalLength: string;
  aperture: string;
  shutter: string;
  iso: string;
  resolution: string;
  extra: string; // custom text line (location, date, signature...)
};
export type Preset = { id: string; name: string; meta: PhotoMeta };

export const EMPTY_META: PhotoMeta = {
  shotBy: "",
  brand: "",
  focalLength: "",
  aperture: "",
  shutter: "",
  iso: "",
  resolution: "",
  extra: "",
};
export const DEFAULT_META: PhotoMeta = {
  ...EMPTY_META,
  shotBy: "iPhone 18 Pro",
  brand: "Apple",
  focalLength: "100",
  aperture: "2.8",
  shutter: "1/607",
  iso: "50",
};

/* ---------- Font (Inter via next/font, exposed as --font-inter) ---------- */
const FALLBACK = `-apple-system, "Helvetica Neue", Arial, sans-serif`;
export const FONT_CSS = `var(--font-inter), ${FALLBACK}`;

function getFontStack() {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-inter")
    .trim();
  return v ? `${v}, ${FALLBACK}` : FALLBACK;
}

/* ---------- Helpers ---------- */
export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const isHeic = (f: File) =>
  /image\/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name);
export const isImage = (f: File) => f.type.startsWith("image/") || isHeic(f);

/** Converts HEIC/HEIF to JPEG so every browser can show and export it. Other files pass through. */
export async function normalizeImage(file: File): Promise<File> {
  if (!isHeic(file)) return file;
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92,
  });
  const blob = Array.isArray(out) ? out[0] : out;
  return new File([blob], file.name.replace(/\.hei[cf]$/i, ".jpg"), {
    type: "image/jpeg",
  });
}

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

/* ---------- Caption ---------- */
export type CaptionItem = { text: string; weight: number; color: string };
/** size/gap are ratios of card width; y is a ratio of caption height. */
export type CaptionLine = {
  items: CaptionItem[];
  size: number;
  gap: number;
  y: number;
};

const Y: Record<number, number[]> = {
  1: [0.5],
  2: [0.4, 0.63],
  3: [0.28, 0.5, 0.72],
};
const strip = (v: string, re: RegExp) => v.trim().replace(re, "").trim();

export function getCaption(
  m: PhotoMeta,
  frameId: FrameId = "white",
): CaptionLine[] {
  const { tone: t, scale: s } = FRAMES[frameId];
  const headline: CaptionItem[] = [];
  if (m.shotBy.trim())
    headline.push(
      { text: "Shot on", weight: 400, color: t.label },
      { text: m.shotBy.trim(), weight: 700, color: t.strong },
    );
  if (m.brand.trim())
    headline.push({ text: m.brand.trim(), weight: 400, color: t.normal });

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
    .filter((x): x is string => Boolean(x))
    .map((text) => ({ text, weight: 400, color: t.spec }));

  const extra = m.extra.trim();
  const rows = [
    { items: headline, size: 0.019 * s, gap: 0.0065 * s },
    { items: specs, size: 0.014 * s, gap: 0.011 * s },
    {
      items: extra ? [{ text: extra, weight: 400, color: t.normal }] : [],
      size: 0.015 * s,
      gap: 0,
    },
  ].filter((r) => r.items.length);

  return rows.map((r, i) => ({ ...r, y: Y[rows.length][i] }));
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
  const stack = getFontStack();
  await Promise.all([
    document.fonts.load(`400 20px ${stack}`),
    document.fonts.load(`700 20px ${stack}`),
  ]).catch(() => {});

  // createImageBitmap applies EXIF rotation explicitly, so portrait photos are never exported sideways.
  const img = await createImageBitmap(await (await fetch(src)).blob(), {
    imageOrientation: "from-image",
  });

  const W = Math.round(
    Math.min(3200, Math.max(1200, img.width / (1 - f.pad * 2))),
  );
  const pad = W * f.pad;
  const pw = W - pad * 2;
  const ph = (pw * img.height) / img.width;
  const cap = W * f.cap;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = Math.round(pad + ph + cap);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = f.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, pad, pad, pw, ph);
  img.close();

  ctx.textBaseline = "middle";
  for (const line of getCaption(meta, frameId)) {
    const size = W * line.size;
    const gap = W * line.gap;
    const font = (it: CaptionItem) => `${it.weight} ${size}px ${stack}`;
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

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Export failed"))),
      "image/png",
    ),
  );
}
