"use client";
import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { ASPECTS, FONT_CSS, FRAMES, getCaption, type AspectId, type Focus, type FrameId, type PhotoMeta } from "@/lib/photo";

type PhotoCardProps = {
  src: string;
  meta: PhotoMeta;
  frame?: FrameId;
  aspect?: AspectId;
  /** Crop position, 0–1 on each axis (0.5 / 0.5 = centered). */
  focus?: Focus;
  /** When set (and the aspect isn't "original"), the photo can be dragged or nudged with arrow keys to reposition the crop. */
  onFocusChange?: (focus: Focus) => void;
  alt?: string;
  className?: string;
  /** Optional extra content rendered on top of the card (stamp, watermark, etc.). */
  children?: ReactNode;
};

const clamp = (n: number) => Math.min(1, Math.max(0, n));
const MOVES: Record<string, [number, number]> = { ArrowLeft: [-0.05, 0], ArrowRight: [0.05, 0], ArrowUp: [0, -0.05], ArrowDown: [0, 0.05] };

export default function PhotoCard({
  src,
  meta,
  frame = "white",
  aspect = "original",
  focus = { x: 0.5, y: 0.5 },
  onFocusChange,
  alt = "Uploaded photo",
  className = "",
  children,
}: PhotoCardProps) {
  const f = FRAMES[frame];
  const draggable = Boolean(onFocusChange) && aspect !== "original";
  const drag = useRef<{ x: number; y: number; start: Focus } | null>(null);

  const onDown = (e: PointerEvent<HTMLImageElement>) => {
    if (!draggable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, start: focus };
  };

  const onMove = (e: PointerEvent<HTMLImageElement>) => {
    const d = drag.current;
    if (!d || !onFocusChange) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    // How far the (cover-scaled) photo overflows the frame on each axis, in screen pixels.
    const scale = Math.max(r.width / el.naturalWidth, r.height / el.naturalHeight);
    const ox = el.naturalWidth * scale - r.width;
    const oy = el.naturalHeight * scale - r.height;
    // Dragging the photo right reveals more of its left side, so focus moves the opposite way.
    onFocusChange({
      x: ox > 1 ? clamp(d.start.x - (e.clientX - d.x) / ox) : d.start.x,
      y: oy > 1 ? clamp(d.start.y - (e.clientY - d.y) / oy) : d.start.y,
    });
  };

  const onKey = (e: KeyboardEvent<HTMLImageElement>) => {
    const m = MOVES[e.key];
    if (!m || !onFocusChange) return;
    e.preventDefault();
    onFocusChange({ x: clamp(focus.x + m[0]), y: clamp(focus.y + m[1]) });
  };

  return (
    <div className={`relative w-full @container ${className}`} style={{ fontFamily: FONT_CSS }}>
      <figure className="m-0 shadow-xl" style={{ background: f.bg, padding: `${f.pad * 100}cqw`, paddingBottom: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className={`block h-auto w-full select-none object-cover ${draggable ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
          style={{ aspectRatio: ASPECTS[aspect].ratio, objectPosition: `${focus.x * 100}% ${focus.y * 100}%` }}
          {...(draggable && {
            tabIndex: 0,
            "aria-label": "Photo position. Drag, or use the arrow keys, to choose the crop.",
            onPointerDown: onDown,
            onPointerMove: onMove,
            onPointerUp: () => (drag.current = null),
            onPointerCancel: () => (drag.current = null),
            onKeyDown: onKey,
          })}
        />
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