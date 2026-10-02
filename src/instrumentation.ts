export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getDb } = await import("./lib/db");
    const { startHealthWorker } = await import("./lib/health");
    getDb();
    startHealthWorker();
  }
}
