import type JSZip from "jszip";
import { downloadBlob } from "./photo";

export type ZipTarget = {
  write(chunk: Uint8Array): Promise<void>;
  close(): Promise<void>;
};
type Picker = (o: {
  suggestedName: string;
  types: object[];
}) => Promise<{ createWritable(): Promise<ZipTarget> }>;
type ZipStream = {
  on(event: "data", cb: (chunk: Uint8Array) => void): ZipStream;
  on(event: "end", cb: () => void): ZipStream;
  on(event: "error", cb: (e: Error) => void): ZipStream;
  resume(): ZipStream;
};

/**
 * Chrome/Edge: asks where to save and returns a writable file, so the ZIP is streamed straight to disk.
 * Other browsers: returns null and writeZip falls back to a normal download.
 * Call it directly inside the click handler (it needs the click's user activation).
 */
export async function openZipTarget(name: string): Promise<ZipTarget | null> {
  const pick = (window as unknown as { showSaveFilePicker?: Picker })
    .showSaveFilePicker;
  if (!pick) return null;
  const handle = await pick({
    suggestedName: name,
    types: [
      { description: "ZIP archive", accept: { "application/zip": [".zip"] } },
    ],
  });
  return handle.createWritable();
}

export async function writeZip(
  zip: JSZip,
  name: string,
  target: ZipTarget | null,
) {
  // Images are already compressed, so STORE skips useless CPU work.
  if (!target) {
    downloadBlob(
      await zip.generateAsync({ type: "blob", compression: "STORE" }),
      name,
    );
    return;
  }
  const stream = (
    zip as unknown as { generateInternalStream(o: object): ZipStream }
  ).generateInternalStream({
    type: "uint8array",
    streamFiles: true,
    compression: "STORE",
  });
  let chain: Promise<void> = Promise.resolve();
  await new Promise<void>((resolve, reject) => {
    stream
      .on("data", (chunk) => {
        chain = chain.then(() => target.write(chunk));
      })
      .on("error", reject)
      .on("end", () => {
        chain.then(() => target.close()).then(resolve, reject);
      })
      .resume();
  });
}
