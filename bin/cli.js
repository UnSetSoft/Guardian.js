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
  exclude: [],
  exactInstall: false,
};

const configFiles = ["guardian.config.json", ".guardianrc.json"];
for (const file of configFiles) {
  const fullPath = path.join(process.cwd(), file);
  if (existsSync(fullPath)) {
    try {
      const userConfig = JSON.parse(readFileSync(fullPath, "utf8"));
      if (userConfig.minAge !== undefined) userConfig.minAge = parseMinAge(userConfig.minAge);
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
  .scriptName("guardian")
  .usage("Use: $0 <command> [options]")
  .version(version)
  .command(
    "install [packages..]",
    "Install packages with minimum release age restriction",
    (y) =>
      y
        .positional("packages", {
          describe: "Packages to install, e.g.: react@18 lodash@5 @scope/pkg@1.2.3",
          type: "string",
        })
        .option("min-age", {
          alias: "m",
          type: "string",
          describe: "Minimum version age (e.g. 30, 1d, 1w, 1m, 24h, 24hs)",
        })
        .option("dev", {
          type: "boolean",
          alias: "D",
          describe: "Install as devDependency (--save-dev)",
          default: false,
        })
        .option("exact", {
          type: "boolean",
          describe: "Install exact version (--save-exact)",
          default: false,
        }),
    (argv) => Install(argv)
  )
  .demandCommand(1, "You must specify a command")
  .help()
  .argv;

function Install(argv) {
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
  run(argv.packages, argv.dev, argv.exact);
}

function parseMinAge(input) {
  if (typeof input === "number") return input;
  if (/^\d+$/.test(input)) return parseInt(input, 10);
  const match = input.match(/^(\d+)(d|w|m|h|hs)$/i);
  if (!match) throw new Error(`Invalid format for minAge: ${input}`);
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case "d": return value;
    case "w": return value * 7;
    case "m": return value * 30;
    case "h": return value / 24;
    case "hs": return value / 24;
    default: throw new Error(`Unsupported unit for minAge: ${unit}`);
  }
}

function splitPkgSpec(pkgSpec) {
  const atIndex = pkgSpec.lastIndexOf("@");
  if (pkgSpec.startsWith("@")) {
    if (atIndex > 0) return [pkgSpec.slice(0, atIndex), pkgSpec.slice(atIndex + 1)];
    return [pkgSpec, null];
  } else {
    if (atIndex > 0) return [pkgSpec.slice(0, atIndex), pkgSpec.slice(atIndex + 1)];
    return [pkgSpec, null];
  }
}

async function checkVulnerabilities(pkg, version) {
  try {
    const output = execSync(`npm audit --json --package=${pkg}@${version}`, { encoding: "utf8" });
    const audit = JSON.parse(output);

    const vulnList = Object.values(audit.vulnerabilities).filter(v => v.name === pkg);

    if (vulnList.length > 0) {
      if (config.mode === "block" || config.mode === "warn") {
        console.error(`🚨 Vulnerabilities found in ${pkg}@${version}:`);
        for (const vuln of vulnList) {
          console.error(` - ${vuln.name} (${vuln.severity}) → ${vuln.title || "Security issue"}`);
        }
      }
      if (config.mode === "block") process.exit(1);
      if (config.mode === "warn") console.warn("⚠️ Installation will proceed due to 'warn' mode.");

    } else {
      console.log(`✅ No vulnerabilities found for ${pkg}@${version}`);
    }
  } catch (err) {
    if (err.stdout) {
      try {
        const audit = JSON.parse(err.stdout.toString());
        const vulnList = Object.values(audit.vulnerabilities).filter(v => v.name === pkg);

        if (vulnList.length > 0) {

          if (config.mode === "block" || config.mode === "warn") {
            console.error(`🚨 Vulnerabilities found in ${pkg}@${version}:`);
            for (const vuln of vulnList) {
              console.error(` - ${vuln.name} (${vuln.severity}) → ${vuln.title || "Security issue"}`);
            }
          }

          if (config.mode === "block") process.exit(1);
          if (config.mode === "warn") console.warn("⚠️ Installation will proceed due to 'warn' mode.");

        } else {
          console.log(`✅ No vulnerabilities found for ${pkg}@${version}`);
        }
      } catch (_) { }
    }
  }
}


async function checkAndInstall(pkgSpec, asDev = false, exact = false) {
  const [pkg, versionRange] = splitPkgSpec(pkgSpec);
  if (config.exclude.includes(pkg)) {
    console.log(`⚠️  ${pkg} is excluded from restrictions. Installing without validation.`);
    execSync(`npm install ${pkgSpec}${asDev ? " --save-dev" : ""}${exact || config.exactInstall ? " --save-exact" : ""}`, { stdio: "inherit" });
    return;
  }
  const res = await fetch(`https://registry.npmjs.org/${pkg}`);
  if (!res.ok) {
    console.error(`❌ Failed to fetch metadata for ${pkg}`);
    process.exit(1);
  }
  const meta = await res.json();
  const versions = Object.keys(meta.versions);
  let resolvedVersion;
  if (!versionRange) resolvedVersion = meta["dist-tags"].latest;
  else {
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
    const msg = `🚫 ${pkg}@${resolvedVersion} is too new (${ageDays} days)`;
    console.error(msg);
    process.exit(1);
  }

  await checkVulnerabilities(pkg, resolvedVersion);

  console.log(`✅ Installing ${pkg}@${resolvedVersion} (published ${ageDays} days ago)`);
  execSync(`npm install ${pkg}@${resolvedVersion} --silent --no-audit ${asDev ? " --save-dev" : ""}${exact || config.exactInstall ? " --save-exact" : ""}`, { stdio: "inherit" });
}


async function run(packages, asDev = false, exact = false) {
  const validModes = ["block", "warn", "off"];
  if (!validModes.includes(config.mode)) {
    console.error(`❌ Invalid mode in configuration: ${config.mode}. Valid options are: ${validModes.join(", ")}`);
    process.exit(1);
  }
  for (const pkgSpec of packages) {
    await checkAndInstall(pkgSpec, asDev, exact);
  }
}
