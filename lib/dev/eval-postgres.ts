import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";

/*
 * A private Postgres for the API eval, from the binaries embedded-postgres
 * ships. The cluster lives in .test-results/eval-pg and is kept between runs,
 * so only the first run pays for initdb (about 10 s on Windows). pg_ctl stops
 * it cleanly, unlike embedded-postgres's own stop(), which force-kills on Windows.
 */

// No pipes: the server pg_ctl starts would inherit them, and waiting for them
// to close would wait for the server to exit. Output goes to eval-pg.log.
function run(file: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { stdio: "ignore", windowsHide: true });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${path.basename(file)} ${args[0]} exited with code ${code}`)),
    );
  });
}

const DIR = path.join(process.cwd(), ".test-results", "eval-pg");
const USER = "eval";

type Binaries = { initdb: string; pg_ctl: string };

function binaries(): Promise<Binaries> {
  const os = process.platform === "win32" ? "windows" : process.platform;
  return import(`@embedded-postgres/${os}-${process.arch}`);
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer().listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

export async function startEvalPostgres(): Promise<{ url: string; stop: () => Promise<void> }> {
  const { initdb, pg_ctl } = await binaries();
  if (!existsSync(path.join(DIR, "PG_VERSION"))) {
    // Trust auth is fine: it only listens on localhost and holds fixture data.
    await run(initdb, ["-D", DIR, "-U", USER, "--auth=trust", "--encoding=UTF8", "--locale=C", "--no-instructions"]);
  }
  const stop = () => run(pg_ctl, ["stop", "-D", DIR, "-m", "fast", "-w"]);
  // A run that died midway leaves its server up.
  await stop().catch(() => {});
  const port = await freePort();
  await run(pg_ctl, [
    // The log stays outside the data directory: after an unclean stop, recovery
    // fsyncs every file in it, and Windows won't open the log the server holds.
    "start", "-D", DIR, "-w", "-l", `${DIR}.log`,
    "-o", `-p ${port} -c listen_addresses=localhost`,
  ]);
  return { url: `postgres://${USER}@localhost:${port}/postgres`, stop };
}
