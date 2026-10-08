"use client";
import type { ReactNode } from "react";
import { FONT, getCaption, type CaptionItem, type PhotoMeta } from "@/lib/photo";

type PhotoCardProps = {
  src: string;
  meta: PhotoMeta;
  alt?: string;
  className?: string;
  /** Optional extra content rendered on top of the card (stamp, watermark, etc.). */
  children?: ReactNode;
};

function Row({ items, size, gap, top }: { items: CaptionItem[]; size: string; gap: string; top: string }) {
  return (
    <div
      className="absolute inset-x-0 flex -translate-y-1/2 items-center justify-center whitespace-nowrap leading-none"
      style={{ top, fontSize: size, gap }}
    >
      {items.map((it, i) => (
        <span key={i} style={{ fontWeight: it.weight, color: it.color }}>
          {it.text}
        </span>
      ))}
    </div>
  );
}

export default function PhotoCard({ src, meta, alt = "Uploaded photo", className = "", children }: PhotoCardProps) {
  const { headline, specs } = getCaption(meta);
  return (
    <div className={`relative w-full [container-type:inline-size] ${className}`} style={{ fontFamily: FONT }}>
      <figure className="m-0 bg-white p-[2.5cqw] pb-0 shadow-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="block h-auto w-full" />
        <figcaption className="relative h-[12cqw]">
          <Row items={headline} size="1.9cqw" gap="0.65cqw" top="40%" />
          <Row items={specs} size="1.4cqw" gap="1.1cqw" top="63%" />
        </figcaption>
      </figure>
      {children}
    </div>
  );
}
