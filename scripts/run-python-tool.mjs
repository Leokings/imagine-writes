import {existsSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {delimiter, join} from "node:path";

const [tool, ...args] = process.argv.slice(2);

if (!tool) {
  process.stderr.write("Usage: node scripts/run-python-tool.mjs <tool> [...args]\n");
  process.exit(2);
}

const executable = process.platform === "win32" ? `${tool}.exe` : tool;
const virtualEnvironmentBin = join(
  process.cwd(),
  ".venv",
  process.platform === "win32" ? "Scripts" : "bin",
);
const localTool = join(virtualEnvironmentBin, executable);
const command = existsSync(localTool) ? localTool : tool;
const pathValue = process.env.PATH ?? process.env.Path ?? "";
const result = spawnSync(command, args, {
  stdio: "inherit",
  shell: false,
  env: {
    ...process.env,
    PATH: existsSync(virtualEnvironmentBin)
      ? `${virtualEnvironmentBin}${delimiter}${pathValue}`
      : pathValue,
  },
});

if (result.error) {
  process.stderr.write(
    `Could not run ${tool}. Install requirements-dev.txt into .venv or activate an environment containing it.\n`,
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
