"use client";
import { useState, type ReactNode } from "react";
import { ImageUp } from "lucide-react";

type UploadDropzoneProps = {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  disabled?: boolean;
  className?: string;
  /** Custom content. Falls back to a default icon + text. */
  children?: ReactNode;
};

export default function UploadDropzone({
  onFiles,
  multiple = true,
  accept = "image/*",
  disabled = false,
  className = "",
  children,
}: UploadDropzoneProps) {
  const [over, setOver] = useState(false);
  const take = (list?: FileList | null) => {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
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
        take(e.dataTransfer.files);
      }}
      className={`flex cursor-pointer items-center justify-center transition-colors ${over ? "border-primary bg-primary/10" : ""
        } ${disabled ? "pointer-events-none opacity-50" : ""} ${className}`}
    >
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
      {children ?? (
        <div className="flex flex-col items-center gap-3 text-center text-zinc-500">
          <ImageUp size={36} />
          <p className="font-medium text-zinc-700">Drop photos here or click to upload</p>
          <p className="text-sm">Select one or many — details are read from EXIF automatically</p>
        </div>
      )}
    </label>
  );
}