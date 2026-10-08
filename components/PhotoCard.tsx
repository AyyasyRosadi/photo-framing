"use client";
import type { ReactNode } from "react";
import { FONT, FRAMES, LINE, getCaption, type CaptionItem, type FrameId, type PhotoMeta } from "@/lib/photo";

type PhotoCardProps = {
  src: string;
  meta: PhotoMeta;
  frame?: FrameId;
  alt?: string;
  className?: string;
  /** Optional extra content rendered on top of the card (stamp, watermark, etc.). */
  children?: ReactNode;
};

function Row({ items, size, gap, top }: { items: CaptionItem[]; size: number; gap: number; top: number }) {
  return (
    <div
      className="absolute inset-x-0 flex -translate-y-1/2 items-center justify-center whitespace-nowrap leading-none"
      style={{ top: `${top * 100}%`, fontSize: `${size * 100}cqw`, gap: `${gap * 100}cqw` }}
    >
      {items.map((it, i) => (
        <span key={i} style={{ fontWeight: it.weight, color: it.color }}>
          {it.text}
        </span>
      ))}
    </div>
  );
}

export default function PhotoCard({ src, meta, frame = "white", alt = "Uploaded photo", className = "", children }: PhotoCardProps) {
  const f = FRAMES[frame];
  const { headline, specs } = getCaption(meta, frame);
  return (
    <div className={`relative w-full [container-type:inline-size] ${className}`} style={{ fontFamily: FONT }}>
      <figure className="m-0 shadow-xl" style={{ background: f.bg, padding: `${f.pad * 100}cqw`, paddingBottom: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="block h-auto w-full" />
        <figcaption className="relative" style={{ height: `${f.cap * 100}cqw` }}>
          <Row items={headline} size={LINE.size1 * f.scale} gap={LINE.gap1 * f.scale} top={LINE.y1} />
          <Row items={specs} size={LINE.size2 * f.scale} gap={LINE.gap2 * f.scale} top={LINE.y2} />
        </figcaption>
      </figure>
      {children}
    </div>
  );
}