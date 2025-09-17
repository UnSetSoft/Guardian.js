#!/usr/bin/env node
import fetch from "node-fetch";
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import semver from "semver";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { version } = require("../package.json");

let config = {
  minAge: 0,
  mode: "block",
  exclude: []
};

const configFiles = ["shield.config.json", ".shieldrc.json"];
for (const file of configFiles) {
  const fullPath = path.join(process.cwd(), file);
  if (existsSync(fullPath)) {
    try {
      const userConfig = JSON.parse(readFileSync(fullPath, "utf8"));
      config = { ...config, ...userConfig };
      console.log(`⚙️  Configuration loaded from ${file}`);
      break;
    } catch (err) {
      console.error(`❌ Error reading ${file}:`, err.message);
      process.exit(1);
    }
  }
}

const argv = yargs(hideBin(process.argv))
  .scriptName("shield")
  .usage("Use: $0 <command> [options]")
  .version(version)
  .command(
    "install [packages..]",
    "Install packages with minimum release age restriction",
    (y) =>
      y
        .positional("packages", {
          describe: "Packages to install, e.g.: react@18 lodash@5",
          type: "string",
        })
        .option("min-age", {
          alias: "m",
          type: "number",
          describe: "Minimum version age in days",
        })
        .option("dev", {
          type: "boolean",
          alias: "D",
          describe: "Install as devDependency (--save-dev)",
          default: false,
        }),
    (argv) => Install(argv)
  )
  .demandCommand(1, "You must specify a command")
  .help()
  .argv;

function Install(argv) {
  // Implementation for the Install function
  if (argv["min-age"]) {
    try {
      config.minAge = parseMinAge(argv["min-age"]);
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  }
  if (!argv.packages || argv.packages.length === 0) {
    console.error("❌ You must specify at least one package to install");
    process.exit(1);
  }
  run(argv.packages, argv.dev);
}

function parseMinAge(input) {
  if (typeof input === "number") return input; // already in days

  const match = input.match(/^(\d+)(d|w|m|h|hs)$/i);
  if (!match) {
    throw new Error(`Invalid format for --min-age: ${input}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case "d": return value;
    case "w": return value * 7;
    case "m": return value * 30;
    case "h": return value / 24 / 60;
    case "hs": return value / 24;
    default:
      throw new Error(`Unsupported unit for --min-age: ${unit}`);
  }
}


async function checkAndInstall(pkgSpec, asDev = false) {
  const [pkg, versionRange] = pkgSpec.split("@");

  if (config.exclude.includes(pkg)) {
    console.log(`⚠️  ${pkg} is excluded from restrictions. Installing without validation.`);
    execSync(`npm install ${pkgSpec}${asDev ? " --save-dev" : ""}`, { stdio: "inherit" });
    return;
  }

  const res = await fetch(`https://registry.npmjs.org/${pkg}`);
  if (!res.ok) {
    console.error(`❌ Failed to fetch metadata for ${pkg}`);
    process.exit(1);
  }

  const meta = await res.json();
  const versions = Object.keys(meta.versions);

  // Resolve newest version that satisfies the range
  let resolvedVersion;
  if (!versionRange) {
    resolvedVersion = meta["dist-tags"].latest;
  } else {
    // Use semver to find the highest version that satisfies
    const max = semver.maxSatisfying(versions, versionRange);
    if (!max) {
      console.error(`❌ No version of ${pkg} satisfies ${versionRange}`);
      process.exit(1);
    }
    resolvedVersion = max;
  }

  const published = new Date(meta.time[resolvedVersion]).getTime();
  const ageDays = Math.floor((Date.now() - published) / (1000 * 60 * 60 * 24));

  if (ageDays < config.minAge) {
    const msg = `🚫 ${pkg}@${resolvedVersion} is too new (${ageDays} days, minimum ${config.minAge})`;
    if (config.mode === "block") {
      console.error(msg);
      process.exit(1);
    } else {
      console.warn(`⚠️ [WARN] ${msg}`);
    }
  }

  console.log(`✅ Installing ${pkg}@${resolvedVersion} (published ${ageDays} days ago)`);
  execSync(`npm install ${pkg}@${resolvedVersion}${asDev ? " --save-dev" : ""}`, { stdio: "inherit" });
}

async function run(packages, asDev = false) {
  for (const pkgSpec of packages) {
    await checkAndInstall(pkgSpec, asDev);
  }
}
