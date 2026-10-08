export type PhotoMeta = {
  shotBy: string;
  brand: string;
  focalLength: string;
  aperture: string;
  shutter: string;
  iso: string;
  resolution: string;
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

export type CaptionItem = { text: string; weight: number; color: string };

const TONE = {
  label: { weight: 400, color: "#8a8a8a" },
  strong: { weight: 700, color: "#111111" },
  normal: { weight: 400, color: "#3f3f3f" },
  spec: { weight: 400, color: "#9a9a9a" },
};

const strip = (v: string, re: RegExp) => v.trim().replace(re, "").trim();

/** Builds the two caption lines shared by the HTML preview and the PNG export. */
export function getCaption(m: PhotoMeta) {
  const headline: CaptionItem[] = [];
  const shotBy = m.shotBy.trim();
  const brand = m.brand.trim();
  if (shotBy) headline.push({ text: "Shot on", ...TONE.label }, { text: shotBy, ...TONE.strong });
  if (brand) headline.push({ text: brand, ...TONE.normal });

  const focal = strip(m.focalLength, /mm$/i);
  const ap = strip(m.aperture, /^f\/?/i);
  const sh = m.shutter.trim();
  const iso = strip(m.iso, /^iso/i);
  const res = m.resolution.trim();

  const specs: CaptionItem[] = [
    focal && `${focal}mm`,
    ap && `f/${ap}`,
    sh && (sh.endsWith("s") ? sh : `${sh}s`),
    iso && `ISO${iso}`,
    res,
  ]
    .filter((s): s is string => Boolean(s))
    .map((text) => ({ text, ...TONE.spec }));

  return { headline, specs };
}

// Layout ratios (relative to card width) — the PhotoCard preview uses the same numbers via cqw.
export const LAYOUT = { pad: 0.025, caption: 0.12, line1Y: 0.4, line2Y: 0.63, size1: 0.019, size2: 0.014, gap1: 0.0065, gap2: 0.011 };

/** Draws the finished card on a canvas and returns a PNG blob. */
export async function renderCardBlob(src: string, meta: PhotoMeta): Promise<Blob> {
  const img = new Image();
  img.src = src;
  await img.decode();

  const W = Math.round(Math.min(3200, Math.max(1200, img.naturalWidth / 0.95)));
  const pad = W * LAYOUT.pad;
  const pw = W - pad * 2;
  const ph = (pw * img.naturalHeight) / img.naturalWidth;
  const cap = W * LAYOUT.caption;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = Math.round(pad + ph + cap);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, pad, pad, pw, ph);

  ctx.textBaseline = "middle";
  const row = (items: CaptionItem[], size: number, gap: number, y: number) => {
    const widths = items.map((it) => {
      ctx.font = `${it.weight} ${size}px ${FONT}`;
      return ctx.measureText(it.text).width;
    });
    const total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, items.length - 1);
    let x = (W - total) / 2;
    items.forEach((it, i) => {
      ctx.font = `${it.weight} ${size}px ${FONT}`;
      ctx.fillStyle = it.color;
      ctx.fillText(it.text, x, y);
      x += widths[i] + gap;
    });
  };

  const { headline, specs } = getCaption(meta);
  const top = pad + ph;
  row(headline, W * LAYOUT.size1, W * LAYOUT.gap1, top + cap * LAYOUT.line1Y);
  row(specs, W * LAYOUT.size2, W * LAYOUT.gap2, top + cap * LAYOUT.line2Y);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), "image/png"),
  );
}
