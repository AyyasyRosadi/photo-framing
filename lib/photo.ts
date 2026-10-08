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
  shotBy: "iPhone 14 pro",
  brand: "Apple",
  focalLength: "100",
  aperture: "2.8",
  shutter: "1/607",
  iso: "50",
};

/* ---------- Font (self-hosted Inter: loaded by CSS in the page and by FontFace inside the worker) ---------- */
export const FONT_FAMILY = "PF Inter";
export const FONT_FILES = [
  { weight: 400, url: "/fonts/inter-latin-400-normal.woff2" },
  { weight: 700, url: "/fonts/inter-latin-700-normal.woff2" },
];
export const FONT_STACK = `"${FONT_FAMILY}", -apple-system, "Helvetica Neue", Arial, sans-serif`;
export const FONT_CSS = FONT_STACK;

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

/* ---------- Crop (aspect) + export settings ---------- */
export type AspectId = "original" | "1:1" | "4:5" | "3:2" | "9:16";
export const ASPECTS: Record<AspectId, { label: string; ratio?: number }> = {
  original: { label: "Original" },
  "1:1": { label: "1:1", ratio: 1 },
  "4:5": { label: "4:5", ratio: 4 / 5 },
  "3:2": { label: "3:2", ratio: 3 / 2 },
  "9:16": { label: "9:16", ratio: 9 / 16 },
};

/** Crop position inside the photo, 0–1 per axis. 0.5 / 0.5 = centered. */
export type Focus = { x: number; y: number };
export const CENTER: Focus = { x: 0.5, y: 0.5 };

export type ExportFormat = "png" | "jpg" | "webp";
export type ExportSettings = { format: ExportFormat; quality: number };
export const FORMATS: Record<ExportFormat, { mime: string; ext: string }> = {
  png: { mime: "image/png", ext: "png" },
  jpg: { mime: "image/jpeg", ext: "jpg" },
  webp: { mime: "image/webp", ext: "webp" },
};
export type RenderOptions = {
  frame: FrameId;
  aspect: AspectId;
  focus: Focus;
} & ExportSettings;

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
    const exifr = (await import("exifr")).default;
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
