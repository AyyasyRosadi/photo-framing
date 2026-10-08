"use client";
import { useState } from "react";
import JSZip from "jszip";
import { Button, Input, Progress } from "@heroui/react";
import { Copy, Download, FolderDown, Loader2, Plus, X } from "lucide-react";
import FramePicker from "@/components/FramePicker";
import PhotoCard from "@/components/PhotoCard";
import PresetBar from "@/components/PresetBar";
import UploadDropzone from "@/components/UploadDropzone";
import { useLocalState } from "@/lib/useLocalState";
import {
  DEFAULT_META, EMPTY_META, downloadBlob, normalizeImage, readExif, renderCardBlob, uid,
  type FrameId, type PhotoMeta, type Preset,
} from "@/lib/photo";

type Item = { id: string; name: string; url: string; w: number; h: number; meta: PhotoMeta };

const loadDims = (url: string) =>
  new Promise<{ w: number; h: number }>((res, rej) => {
    const im = new Image();
    im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => rej(new Error("unreadable"));
    im.src = url;
  });

const baseName = (n: string) => n.replace(/\.[^.]+$/, "");

export default function Page() {
  const [items, setItems] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [frame, setFrame] = useLocalState<FrameId>("pf:frame", "white");
  const [presets, setPresets] = useLocalState<Preset[]>("pf:presets", []);
  const [busy, setBusy] = useState<"" | "one" | "all">("");
  const [progress, setProgress] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const active = items.find((i) => i.id === activeId) ?? items[0];
  const addError = (m: string) => setErrors((e) => [...e, m]);

  const handleFiles = async (files: File[]) => {
    setLoading(true);
    const results = await Promise.allSettled(
      files.map(async (orig): Promise<Item> => {
        const exif = await readExif(orig); // read before HEIC conversion (conversion drops EXIF)
        const file = await normalizeImage(orig);
        const url = URL.createObjectURL(file);
        try {
          const { w, h } = await loadDims(url);
          const meta = Object.keys(exif).length ? { ...EMPTY_META, ...exif } : { ...DEFAULT_META };
          return { id: uid(), name: file.name, url, w, h, meta };
        } catch (e) {
          URL.revokeObjectURL(url);
          throw e;
        }
      }),
    );
    const ok: Item[] = [];
    results.forEach((r, i) => (r.status === "fulfilled" ? ok.push(r.value) : addError(`"${files[i].name}" could not be opened (unsupported or corrupt file).`)));
    setItems((p) => [...p, ...ok]);
    setActiveId((a) => a ?? ok[0]?.id ?? null);
    setLoading(false);
  };

  const patchActive = (fn: (m: PhotoMeta) => PhotoMeta) => {
    if (!active) return;
    setItems((p) => p.map((i) => (i.id === active.id ? { ...i, meta: fn(i.meta) } : i)));
  };
  const setField = (k: keyof PhotoMeta) => (v: string) => patchActive((m) => ({ ...m, [k]: v }));

  const applyToAll = () => {
    if (!active) return;
    setItems((p) => p.map((i) => ({ ...i, meta: { ...active.meta, resolution: i.meta.resolution } })));
  };

  const savePreset = () => {
    if (!active) return;
    const name = window.prompt("Preset name?")?.trim();
    if (name) setPresets((p) => [...p, { id: uid(), name, meta: { ...active.meta, resolution: "" } }]);
  };

  const remove = (id: string) => {
    setItems((p) => {
      const t = p.find((i) => i.id === id);
      if (t) URL.revokeObjectURL(t.url);
      return p.filter((i) => i.id !== id);
    });
    if (activeId === id) setActiveId(null);
  };

  const downloadOne = async () => {
    if (!active) return;
    setBusy("one");
    try {
      downloadBlob(await renderCardBlob(active.url, active.meta, frame), `${baseName(active.name)}-framed.png`);
    } catch {
      addError("Export failed. Please try again.");
    } finally {
      setBusy("");
    }
  };

  const downloadAll = async () => {
    setBusy("all");
    setProgress(0);
    try {
      const zip = new JSZip();
      for (const [i, it] of items.entries()) {
        zip.file(`${i + 1}-${baseName(it.name)}-framed.png`, await renderCardBlob(it.url, it.meta, frame));
        setProgress(Math.round(((i + 1) / items.length) * 100));
        await new Promise((r) => setTimeout(r)); // let the UI repaint between photos
      }
      downloadBlob(await zip.generateAsync({ type: "blob" }), "photo-frames.zip");
    } catch {
      addError("Batch export failed. Try fewer photos at once.");
    } finally {
      setBusy("");
      setProgress(null);
    }
  };

  const meta = active?.meta ?? DEFAULT_META;
  const detected = active ? `${active.w}×${active.h}` : "e.g. 4032×3024";

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Photo Frame</h1>
      <p className="mt-1 text-zinc-500">Upload photos, pick a frame, and export printed-style cards.</p>

      {errors.length > 0 && (
        <div className="mt-4 flex items-start justify-between gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <ul className="list-disc pl-5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          <button type="button" aria-label="Dismiss errors" onClick={() => setErrors([])}><X size={16} /></button>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[340px_1fr]">
        <section className="flex flex-col gap-3 self-start rounded-2xl bg-white p-5 shadow-sm">
          <PresetBar presets={presets} disabled={!active} onApply={(m) => patchActive((cur) => ({ ...m, resolution: cur.resolution }))} onSave={savePreset} onDelete={(id) => setPresets((p) => p.filter((x) => x.id !== id))} />
          <hr className="border-zinc-100" />
          <h2 className="font-medium">Caption details</h2>
          <Input variant="bordered" size="sm" label="Shot by" value={meta.shotBy} onValueChange={setField("shotBy")} />
          <Input variant="bordered" size="sm" label="Brand" value={meta.brand} onValueChange={setField("brand")} />
          <div className="grid grid-cols-2 gap-3">
            <Input variant="bordered" size="sm" label="Focal length" endContent="mm" value={meta.focalLength} onValueChange={setField("focalLength")} />
            <Input variant="bordered" size="sm" label="Aperture" startContent="f/" value={meta.aperture} onValueChange={setField("aperture")} />
            <Input variant="bordered" size="sm" label="Shutter" placeholder="1/607" value={meta.shutter} onValueChange={setField("shutter")} />
            <Input variant="bordered" size="sm" label="ISO" value={meta.iso} onValueChange={setField("iso")} />
          </div>
          <Input variant="bordered" size="sm" label="Resolution" placeholder={detected} description={active ? `Detected: ${detected}. Leave empty to hide.` : "Leave empty to hide."} value={meta.resolution} onValueChange={setField("resolution")} />
          <Input variant="bordered" size="sm" label="Custom text" placeholder="e.g. Bandung, Oct 2026" description="Shown as an extra line under the details." value={meta.extra} onValueChange={setField("extra")} />
          <Button size="sm" variant="flat" isDisabled={items.length < 2} onPress={applyToAll} startContent={<Copy size={14} />}>
            Apply these details to all
          </Button>
        </section>

        <section>
          {loading && (
            <p className="mb-4 flex items-center justify-center gap-2 text-sm text-zinc-500">
              <Loader2 size={16} className="animate-spin" /> Reading photos…
            </p>
          )}
          {active ? (
            <div className="mx-auto flex max-w-xl flex-col gap-5">
              <FramePicker value={frame} onChange={setFrame} />

              <div className="flex flex-wrap items-center gap-2">
                {items.map((it) => (
                  <div key={it.id} className="relative">
                    <button type="button" onClick={() => setActiveId(it.id)} className={`block overflow-hidden rounded-lg ring-2 ${it.id === active.id ? "ring-primary" : "ring-transparent"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={it.url} alt={it.name} className="h-14 w-14 object-cover" />
                    </button>
                    <button type="button" aria-label={`Remove ${it.name}`} onClick={() => remove(it.id)} className="absolute -right-1.5 -top-1.5 rounded-full bg-zinc-800 p-0.5 text-white">
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <UploadDropzone onFiles={handleFiles} className="h-14 w-14 rounded-lg border-2 border-dashed border-zinc-300 bg-white text-zinc-500">
                  <Plus size={20} />
                </UploadDropzone>
              </div>

              <PhotoCard src={active.url} meta={active.meta} frame={frame} />

              {progress !== null && <Progress aria-label="Exporting photos" size="sm" value={progress} showValueLabel />}

              <div className="flex flex-wrap justify-center gap-3">
                <Button color="primary" isDisabled={busy !== ""} isLoading={busy === "one"} onPress={downloadOne} startContent={busy !== "one" && <Download size={16} />}>
                  Download PNG
                </Button>
                <Button variant="bordered" isDisabled={items.length < 2 || busy !== ""} isLoading={busy === "all"} onPress={downloadAll} startContent={busy !== "all" && <FolderDown size={16} />}>
                  Download all ({items.length}) as ZIP
                </Button>
              </div>
            </div>
          ) : (
            !loading && <UploadDropzone onFiles={handleFiles} className="min-h-105 rounded-2xl border-2 border-dashed border-zinc-300 bg-white" />
          )}
        </section>
      </div>
    </main>
  );
}