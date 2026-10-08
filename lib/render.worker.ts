import { execute, type Job } from "./render";

const ctx = self as unknown as Worker;

ctx.onmessage = async (e: MessageEvent<Job>) => {
  try {
    ctx.postMessage(await execute(e.data));
  } catch (err) {
    ctx.postMessage({
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
