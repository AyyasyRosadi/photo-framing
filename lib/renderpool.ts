import { execute, type Job, type JobResult } from "./render";

type Queued = {
  job: Job;
  resolve: (r: JobResult) => void;
  reject: (e: Error) => void;
};
type Slot = { worker: Worker; current: Queued | null };

const MAX_WORKERS = 3;
const slots: Slot[] = [];
const queue: Queued[] = [];
let broken = typeof Worker === "undefined";

const poolSize = () =>
  Math.max(1, Math.min(MAX_WORKERS, (navigator.hardwareConcurrency || 2) - 1));

function runQueueLocally() {
  while (queue.length) {
    const q = queue.shift()!;
    execute(q.job).then(q.resolve, q.reject);
  }
}

function spawn(): Slot | null {
  try {
    const worker = new Worker(new URL("./render.worker.ts", import.meta.url), {
      type: "module",
    });
    const slot: Slot = { worker, current: null };
    worker.onmessage = (e: MessageEvent<JobResult & { error?: string }>) => {
      const q = slot.current;
      slot.current = null;
      if (e.data.error) q?.reject(new Error(e.data.error));
      else q?.resolve(e.data);
      pump();
    };
    worker.onerror = () => {
      // Workers unavailable (old browser, blocked, etc.): continue on the main thread.
      broken = true;
      const q = slot.current;
      slot.current = null;
      worker.terminate();
      if (q) execute(q.job).then(q.resolve, q.reject);
      runQueueLocally();
    };
    slots.push(slot);
    return slot;
  } catch {
    broken = true;
    return null;
  }
}

function pump() {
  while (queue.length && !broken) {
    let slot = slots.find((s) => !s.current);
    if (!slot && slots.length < poolSize()) slot = spawn() ?? undefined;
    if (!slot) break;
    const q = queue.shift()!;
    slot.current = q;
    slot.worker.postMessage(q.job);
  }
  if (broken) runQueueLocally();
}

/** Runs a render/preview job on a small pool of Web Workers (up to 3 in parallel). */
export function runJob(job: Job): Promise<JobResult> {
  if (broken) return execute(job);
  return new Promise((resolve, reject) => {
    queue.push({ job, resolve, reject });
    pump();
  });
}
