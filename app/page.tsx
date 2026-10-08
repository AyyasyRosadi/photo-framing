"use client";
import { useState } from "react";
import { Button, Input } from "@heroui/react";
import { Download, RefreshCw } from "lucide-react";
import PhotoCard from "@/components/PhotoCard";
import UploadDropzone from "@/components/UploadDropzone";
import { DEFAULT_META, renderCardBlob, type PhotoMeta } from "@/lib/photo";

type Photo = { url: string; name: string; w: number; h: number };

export default function Page() {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [meta, setMeta] = useState<PhotoMeta>(DEFAULT_META);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof PhotoMeta) => (v: string) => setMeta((m) => ({ ...m, [k]: v }));

  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () =>
      setPhoto((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { url, name: file.name, w: im.naturalWidth, h: im.naturalHeight };
      });
    im.src = url;
  };

  const handleDownload = async () => {
    if (!photo) return;
    setBusy(true);
    try {
      const blob = await renderCardBlob(photo.url, meta);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${photo.name.replace(/\.[^.]+$/, "")}-framed.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setBusy(false);
    }
  };

  const detected = photo ? `${photo.w}×${photo.h}` : "e.g. 4032×3024";

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Photo Frame</h1>
      <p className="mt-1 text-zinc-500">Upload a photo and get a printed-style card with camera details.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[340px_1fr]">
        <section className="flex flex-col gap-3 self-start rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-medium">Caption details</h2>
          <Input variant="bordered" size="sm" label="Shot by" value={meta.shotBy} onValueChange={set("shotBy")} />
          <Input variant="bordered" size="sm" label="Brand" value={meta.brand} onValueChange={set("brand")} />
          <div className="grid grid-cols-2 gap-3">
            <Input variant="bordered" size="sm" label="Focal length" endContent="mm" value={meta.focalLength} onValueChange={set("focalLength")} />
            <Input variant="bordered" size="sm" label="Aperture" startContent="f/" value={meta.aperture} onValueChange={set("aperture")} />
            <Input variant="bordered" size="sm" label="Shutter" placeholder="1/607" value={meta.shutter} onValueChange={set("shutter")} />
            <Input variant="bordered" size="sm" label="ISO" value={meta.iso} onValueChange={set("iso")} />
          </div>
          <Input
            variant="bordered"
            size="sm"
            label="Resolution"
            placeholder={detected}
            description={photo ? `Detected: ${detected}. Leave empty to hide.` : "Leave empty to hide."}
            value={meta.resolution}
            onValueChange={set("resolution")}
          />
        </section>

        <section>
          {photo ? (
            <div className="mx-auto flex max-w-xl flex-col gap-5">
              <PhotoCard src={photo.url} meta={meta} />
              <div className="flex flex-wrap justify-center gap-3">
                <Button color="primary" isLoading={busy} onPress={handleDownload} startContent={!busy && <Download size={16} />}>
                  Download PNG
                </Button>
                <UploadDropzone onFile={handleFile} className="rounded-medium border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50">
                  <span className="flex items-center gap-2">
                    <RefreshCw size={16} /> Replace photo
                  </span>
                </UploadDropzone>
              </div>
            </div>
          ) : (
            <UploadDropzone onFile={handleFile} className="min-h-[420px] rounded-2xl border-2 border-dashed border-zinc-300 bg-white" />
          )}
        </section>
      </div>
    </main>
  );
}
