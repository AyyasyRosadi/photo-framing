"use client";
import { useState } from "react";
import JSZip from "jszip";
import { Button, Progress } from "@heroui/react";
import { ClipboardCopy, Copy, Download, FolderDown, Layers, Loader2, Plus, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import BottomSheet from "@/components/BottomSheet";
import ExportOptions from "@/components/ExportOptions";
import FramePicker from "@/components/FramePicker";
import MetaForm from "@/components/MetaForm";
import OptionButtons from "@/components/OptionButtons";
import PhotoCard from "@/components/PhotoCard";
import PresetBar from "@/components/PresetBar";
import UploadDropzone from "@/components/UploadDropzone";
import { useLocalState } from "@/lib/useLocalState";
import { runJob } from "@/lib/renderpool";
import { openZipTarget, writeZip, type ZipTarget } from "@/lib/zip";
import {
  ASPECTS, CENTER, DEFAULT_META, EMPTY_META, FORMATS, downloadBlob, normalizeImage, readExif, uid,
  type AspectId, type ExportSettings, type Focus, type FrameId, type PhotoMeta, type Preset, type RenderOptions,
} from "@/lib/photo";

type Item = { id: string; name: string; file: File; url: string; w: number; h: number; meta: PhotoMeta; frame: FrameId; aspect: AspectId; focus: Focus };

const ASPECT_OPTIONS = (Object.keys(ASPECTS) as AspectId[]).map((value) => ({ value, label: ASPECTS[value].label }));

const baseName = (n: string) => n.replace(/\.[^.]+$/, "");

export default function Page() {
  const [items, setItems] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [defaultFrame, setDefaultFrame] = useLocalState<FrameId>("pf:frame", "white");
  const [exportSettings, setExportSettings] = useLocalState<ExportSettings>("pf:export", { format: "png", quality: 0.92 });
  const [presets, setPresets] = useLocalState<Preset[]>("pf:presets", []);
  const [busy, setBusy] = useState<"" | "one" | "all">("");
  const [progress, setProgress] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [sheet, setSheet] = useState(false);
  const [copied, setCopied] = useState(false);

  const active = items.find((i) => i.id === activeId) ?? items[0];
  const addError = (m: string) => setErrors((e) => [...e, m]);
  const ext = FORMATS[exportSettings.format].ext;
  const optsOf = (it: Item) => ({ frame: it.frame, aspect: it.aspect, focus: it.focus, ...exportSettings });
  // Renders on the worker pool, from the original file.
  const render = async (it: Item, o: Partial<RenderOptions>) => (await runJob({ kind: "render", source: it.file, meta: it.meta, options: o })).blob;

  const handleFiles = async (files: File[]) => {
    setLoading(true);
    const results = await Promise.allSettled(
      files.map(async (orig): Promise<Item> => {
        const exif = await readExif(orig); // read before HEIC conversion (conversion drops EXIF)
        const file = await normalizeImage(orig);
        // The UI only keeps a small preview in memory; the original File is used at export time.
        const { blob, w, h } = await runJob({ kind: "preview", source: file });
        const url = URL.createObjectURL(blob);
        const meta = Object.keys(exif).length ? { ...EMPTY_META, ...exif } : { ...DEFAULT_META };
        return { id: uid(), name: file.name, file, url, w: w ?? 0, h: h ?? 0, meta, frame: defaultFrame, aspect: "original", focus: CENTER };
      }),
    );
    const ok: Item[] = [];
    results.forEach((r, i) => (r.status === "fulfilled" ? ok.push(r.value) : addError(`"${files[i].name}" could not be opened (unsupported or corrupt file).`)));
    setItems((p) => [...p, ...ok]);
    setActiveId((a) => a ?? ok[0]?.id ?? null);
    setLoading(false);
  };

  const patch = (fn: (i: Item) => Item) => {
    if (!active) return;
    setItems((p) => p.map((i) => (i.id === active.id ? fn(i) : i)));
  };
  const setField = (k: keyof PhotoMeta) => (v: string) => patch((i) => ({ ...i, meta: { ...i.meta, [k]: v } }));
  const setFrame = (frame: FrameId) => {
    patch((i) => ({ ...i, frame }));
    setDefaultFrame(frame);
  };

  const applyDetailsToAll = () => {
    if (!active) return;
    setItems((p) => p.map((i) => ({ ...i, meta: { ...active.meta, resolution: i.meta.resolution } })));
  };
  const applyLookToAll = () => {
    if (!active) return;
    setItems((p) => p.map((i) => ({ ...i, frame: active.frame, aspect: active.aspect })));
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
      downloadBlob(await render(active, optsOf(active)), `${baseName(active.name)}-framed.${ext}`);
    } catch {
      addError("Export failed. Please try again.");
    } finally {
      setBusy("");
    }
  };

  const copyOne = async () => {
    if (!active) return;
    try {
      const blob = await render(active, { ...optsOf(active), format: "png" });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      addError("Copying images isn't supported in this browser. Use Download instead.");
    }
  };

  const downloadAll = async () => {
    // Ask where to save first (needs the click's user activation). null = normal download fallback.
    let target: ZipTarget | null = null;
    try {
      target = await openZipTarget("photo-frames.zip");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
    setBusy("all");
    setProgress(0);
    try {
      const zip = new JSZip();
      let done = 0;
      // Up to 3 photos render in parallel on the worker pool.
      await Promise.all(
        items.map(async (it, i) => {
          zip.file(`${i + 1}-${baseName(it.name)}-framed.${ext}`, await render(it, optsOf(it)));
          setProgress(Math.round((++done / items.length) * 100));
        }),
      );
      await writeZip(zip, "photo-frames.zip", target);
    } catch {
      target?.close().catch(() => { });
      addError("Batch export failed. Try fewer photos at once.");
    } finally {
      setBusy("");
      setProgress(null);
    }
  };

  const detected = active ? `${active.w}×${active.h}` : undefined;

  // One form element, rendered in the sidebar on desktop and in the bottom sheet on mobile.
  const form = (
    <MetaForm
      meta={active?.meta ?? DEFAULT_META}
      onField={setField}
      detected={detected}
      hasPhoto={!!active}
      footer={
        <Button size="sm" variant="flat" isDisabled={items.length < 2} onPress={applyDetailsToAll} startContent={<Copy size={14} />}>
          Apply these details to all
        </Button>
      }
    >
      <PresetBar
        presets={presets}
        disabled={!active}
        onApply={(m) => patch((i) => ({ ...i, meta: { ...m, resolution: i.meta.resolution } }))}
        onSave={savePreset}
        onDelete={(id) => setPresets((p) => p.filter((x) => x.id !== id))}
      />
      <hr className="border-zinc-100" />
    </MetaForm>
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Photo Frame</h1>
      <p className="mt-1 text-sm text-zinc-500 sm:text-base">Upload photos, pick a frame, and export printed-style cards.</p>

      {errors.length > 0 && (
        <div className="mt-4 flex items-start justify-between gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <ul className="list-disc pl-5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          <button type="button" aria-label="Dismiss errors" onClick={() => setErrors([])}><X size={16} /></button>
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-[340px_1fr]">
        <aside className="hidden self-start rounded-2xl bg-white p-5 shadow-sm lg:block">{form}</aside>

        <section>
          {loading && (
            <p className="mb-4 flex items-center justify-center gap-2 text-sm text-zinc-500">
              <Loader2 size={16} className="animate-spin" /> Reading photos…
            </p>
          )}
          {active ? (
            <div className="mx-auto flex max-w-xl flex-col gap-5">
              <div className="flex flex-col gap-2">
                <FramePicker value={active.frame} onChange={setFrame}>
                  <Button size="sm" variant="light" onPress={applyLookToAll} isDisabled={items.length < 2} startContent={<Layers size={14} />}>
                    Frame & crop to all
                  </Button>
                </FramePicker>
                <OptionButtons options={ASPECT_OPTIONS} value={active.aspect} onChange={(aspect) => patch((i) => ({ ...i, aspect }))}>
                  {active.aspect !== "original" && (
                    <Button size="sm" variant="light" onPress={() => patch((i) => ({ ...i, focus: CENTER }))} startContent={<RotateCcw size={14} />}>
                      Center
                    </Button>
                  )}
                </OptionButtons>
                {active.aspect !== "original" && <p className="text-xs text-zinc-500">Drag the photo (or use the arrow keys) to choose what stays in the frame.</p>}
              </div>

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

              <PhotoCard src={active.url} meta={active.meta} frame={active.frame} aspect={active.aspect} focus={active.focus} onFocusChange={(focus) => patch((i) => ({ ...i, focus }))} />

              <ExportOptions value={exportSettings} onChange={setExportSettings} />

              {progress !== null && <Progress aria-label="Exporting photos" size="sm" value={progress} showValueLabel />}

              <div className="sticky bottom-0 -mx-4 flex flex-wrap justify-center gap-2 bg-zinc-100/90 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                <Button className="lg:hidden" variant="flat" onPress={() => setSheet(true)} startContent={<SlidersHorizontal size={16} />}>
                  Details
                </Button>
                <Button color="primary" isDisabled={busy !== ""} isLoading={busy === "one"} onPress={downloadOne} startContent={busy !== "one" && <Download size={16} />}>
                  Download
                </Button>
                <Button variant="bordered" isDisabled={busy !== ""} onPress={copyOne} startContent={<ClipboardCopy size={16} />}>
                  {copied ? "Copied!" : "Copy"}
                </Button>
                <Button variant="bordered" isDisabled={items.length < 2 || busy !== ""} isLoading={busy === "all"} onPress={downloadAll} startContent={busy !== "all" && <FolderDown size={16} />}>
                  ZIP ({items.length})
                </Button>
              </div>
            </div>
          ) : (
            !loading && <UploadDropzone onFiles={handleFiles} className="min-h-80 rounded-2xl border-2 border-dashed border-zinc-300 bg-white sm:min-h-105" />
          )}
        </section>
      </div>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Edit details" className="lg:hidden">
        {form}
      </BottomSheet>
    </main>
  );
}