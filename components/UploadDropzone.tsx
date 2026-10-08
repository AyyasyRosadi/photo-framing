"use client";
import { useState, type ReactNode } from "react";
import { ImageUp } from "lucide-react";

type UploadDropzoneProps = {
  onFile: (file: File) => void;
  accept?: string;
  disabled?: boolean;
  className?: string;
  /** Custom content. Falls back to a default icon + text. */
  children?: ReactNode;
};

export default function UploadDropzone({
  onFile,
  accept = "image/*",
  disabled = false,
  className = "",
  children,
}: UploadDropzoneProps) {
  const [over, setOver] = useState(false);
  const take = (f?: File | null) => {
    if (f && f.type.startsWith("image/")) onFile(f);
  };

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files[0]);
      }}
      className={`flex cursor-pointer items-center justify-center transition-colors ${
        over ? "border-primary bg-primary/10" : ""
      } ${disabled ? "pointer-events-none opacity-50" : ""} ${className}`}
    >
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          take(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {children ?? (
        <div className="flex flex-col items-center gap-3 text-center text-zinc-500">
          <ImageUp size={36} />
          <p className="font-medium text-zinc-700">Drop a photo here or click to upload</p>
          <p className="text-sm">JPG, PNG, WebP — processed only in your browser</p>
        </div>
      )}
    </label>
  );
}
