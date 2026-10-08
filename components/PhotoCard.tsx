"use client";
import type { ReactNode } from "react";
import { FONT_CSS, FRAMES, getCaption, type FrameId, type PhotoMeta } from "@/lib/photo";

type PhotoCardProps = {
  src: string;
  meta: PhotoMeta;
  frame?: FrameId;
  alt?: string;
  className?: string;
  /** Optional extra content rendered on top of the card (stamp, watermark, etc.). */
  children?: ReactNode;
};

export default function PhotoCard({ src, meta, frame = "white", alt = "Uploaded photo", className = "", children }: PhotoCardProps) {
  const f = FRAMES[frame];
  return (
    <div className={`relative w-full @container ${className}`} style={{ fontFamily: FONT_CSS }}>
      <figure className="m-0 shadow-xl" style={{ background: f.bg, padding: `${f.pad * 100}cqw`, paddingBottom: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="block h-auto w-full" />
        <figcaption className="relative" style={{ height: `${f.cap * 100}cqw` }}>
          {getCaption(meta, frame).map((line, n) => (
            <div
              key={n}
              className="absolute inset-x-0 flex -translate-y-1/2 items-center justify-center whitespace-nowrap leading-none"
              style={{ top: `${line.y * 100}%`, fontSize: `${line.size * 100}cqw`, gap: `${line.gap * 100}cqw` }}
            >
              {line.items.map((it, i) => (
                <span key={i} style={{ fontWeight: it.weight, color: it.color }}>
                  {it.text}
                </span>
              ))}
            </div>
          ))}
        </figcaption>
      </figure>
      {children}
    </div>
  );
}