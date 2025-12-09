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

// Helper to execute shell commands and capture output for better error reporting.
function execCmdSync(cmd, options = {}) {
  try {
    if (options.inherit) {
      // Keep behavior similar to { stdio: 'inherit' }
      execSync(cmd, { stdio: "inherit", shell: true });
      return null;
    }

    const encoding = options.encoding || "utf8";
    const out = execSync(cmd, { encoding, stdio: "pipe", shell: true });
    // Only print if it's not npm audit JSON output
    if (out && !options.suppressOutput) {
      // If the command is 'npm audit --json', don't print the output
      if (!(cmd.includes('npm audit') && cmd.includes('--json'))) {
        process.stdout.write(out);
      }
    }
    return out;
  } catch (err) {
    // Check if error is ERESOLVE (peer dependency conflict)
    const errOutput = err.stdout?.toString() || err.stderr?.toString() || "";
    if (err.status === 1 && errOutput.includes("ERESOLVE") && cmd.includes("npm install")) {
      console.warn(`⚠️  Peer dependency conflict detected. Retrying with --legacy-peer-deps...`);
      try {
        // Retry with --legacy-peer-deps flag
        const cmdWithFlag = cmd.replace("npm install", "npm install --legacy-peer-deps");
        if (options.inherit) {
          execSync(cmdWithFlag, { stdio: "inherit", shell: true });
          return null;
        }
        const encoding = options.encoding || "utf8";
        const out = execSync(cmdWithFlag, { encoding, stdio: "pipe", shell: true });
        if (out && !options.suppressOutput) process.stdout.write(out);
        return out;
      } catch (retryErr) {
        if (retryErr.stdout) process.stdout.write(retryErr.stdout.toString());
        if (retryErr.stderr) process.stderr.write(retryErr.stderr.toString());
        console.error(`❌ Command failed even with --legacy-peer-deps: ${cmd}`);
        if (typeof retryErr.status === "number") console.error(`Exit status: ${retryErr.status}`);
        throw retryErr;
      }
    }

    // Handle other errors normally
    // Avoid printing the JSON if the command is npm audit --json
    if (err.stdout && !(cmd.includes('npm audit') && cmd.includes('--json'))) process.stdout.write(err.stdout.toString());
    if (err.stderr && !(cmd.includes('npm audit') && cmd.includes('--json'))) process.stderr.write(err.stderr.toString());
    // Don't show an error message if it's npm audit --json
    if (!(cmd.includes('npm audit') && cmd.includes('--json'))) {
      console.error(`❌ Command failed: ${cmd}`);
      if (typeof err.status === "number") console.error(`Exit status: ${err.status}`);
    }
    throw err;
  }
}

let config = {
  minAge: 0,
  mode: "block",
  exclude: [],
  excludeUpdate: [],
  excludeInstall: [],
  exactInstall: false
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
        })
        .option("all", {
          type: "boolean",
          describe: "Install all dependencies from package.json",
          default: false,
        }),
    (argv) => Install(argv))
  .command(
    "audit [packages..]",
    "Audit packages for vulnerabilities",
    (y) =>
      y
        .positional("packages", {
          describe: "Packages to audit, e.g.: react@18 lodash@5 @scope/pkg@1.2.3",
          type: "string",
        })
        .option("min-age", {
          alias: "m",
          type: "string",
          describe: "Minimum version age (e.g. 30, 1d, 1w, 1m, 24h, 24hs)",
        }),
    (argv) => runAudit(argv)
)
  .command("init", "Create a default guardian.config.json file", () => {
    const defaultConfig = {
        minAge: "1d",
        exclude: [],
        excludeUpdate: [],
        excludeInstall: [],
        exactInstall: true,
    };
    const filePath = path.join(process.cwd(), "guardian.config.json");
    if (existsSync(filePath)) {
      console.error("❌ guardian.config.json already exists in this directory.");
      process.exit(1);
    }
    try {
      require("fs").writeFileSync(filePath, JSON.stringify(defaultConfig, null, 2));
      console.log("✅ guardian.config.json created with default settings.");
    } catch (err) {
      console.error("❌ Error creating guardian.config.json:", err.message);
      process.exit(1);
    }
  })
  .command(
    "update",
    "Update installed packages (or all with --all) to the latest safe version",
    (y) =>
      y
        .option("all", {
          type: "boolean",
          describe: "Update all dependencies from package.json",
          default: true,
        })
        .option("min-age", {
          alias: "m",
          type: "string",
          describe: "Minimum version age (e.g. 30, 1d, 1w, 1m, 24h, 24hs)",
        })
        .option("exact", {
          type: "boolean",
          describe: "Install exact version (--save-exact)",
          default: false,
        }),
    (argv) => Update(argv)
)
  .command("use [package]", "allow developers to execute Node.js packages directly from the npm registry without needing to globally install them", (y) =>
    y
      .option("package", {

        type: "string",
        describe: "",

      })
      .option("min-age", {
        alias: "m",
        type: "string",
        describe: "Minimum version age (e.g. 30, 1d, 1w, 1m, 24h, 24hs)",
      }),
    (argv) => runNPX(argv)
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
  
  let packages = argv.packages;

  if (argv.all) {
    const pkgPath = path.join(process.cwd(), "package.json");
    if (!existsSync(pkgPath)) {
      console.error("❌ No package.json found in current directory");
      process.exit(1);
    }
    const pkgJson = JSON.parse(readFileSync(pkgPath, "utf8"));
    const deps = Object.keys(pkgJson.dependencies || {});
    const devDeps = Object.keys(pkgJson.devDependencies || {});
    packages = [...deps, ...devDeps];
    if (packages.length === 0) {
      console.log("✅ No dependencies found to install");
      return;
    }
    console.log(`📦 Found ${packages.length} dependencies in package.json`);
  }

  if (!packages || packages.length === 0) {
    console.error("❌ You must specify at least one package to install or use --all");
    process.exit(1);
  }
  run(packages, argv.dev, argv.exact);
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

async function checkAndUpdate(pkg, asDev = false, exact = false) {
  const isExcluded = Array.isArray(config.exclude) && config.exclude.includes(pkg);
  const isExcludedUpdate = Array.isArray(config.excludeUpdate) && config.excludeUpdate.includes(pkg);
  if (isExcludedUpdate) {
    console.log(`⚠️  ${pkg} is excluded from updates. Skipping update.`);
    return;
  }
  if (isExcluded) {
    console.log(`⚠️  ${pkg} is excluded from restrictions. Updating without validation.`);
    execCmdSync(`npm install ${pkg}@latest --silent --no-audit ${asDev ? "--save-dev" : ""}${exact || config.exactInstall ? " --save-exact" : ""}`, { inherit: true });
    return;
  }

  const res = await fetch(`https://registry.npmjs.org/${pkg}`);
  if (!res.ok) {
    console.error(`❌ Failed to fetch metadata for ${pkg}`);
    process.exit(1);
  }
  const meta = await res.json();
  const versions = Object.keys(meta.versions);
  const time = meta.time;

  // Filter versions that meet the age requirement
  const candidates = versions.filter((v) => {
    const publishedDate = time[v];
    if (!publishedDate) return false;
    const published = new Date(publishedDate).getTime();
    const ageDays = Math.floor((Date.now() - published) / (1000 * 60 * 60 * 24));
    return ageDays >= config.minAge;
  });

  if (candidates.length === 0) {
    console.error(`❌ No versions of ${pkg} are at least ${config.minAge} days old`);
    return;
  }

  // Resolve the latest valid version
  const latestValidVersion = semver.maxSatisfying(candidates, "*");
  if (!latestValidVersion) {
    console.error(`❌ Could not resolve a valid version for ${pkg}`);
    return;
  }

  const installedVersion = getInstalledVersion(pkg);
  if (installedVersion && semver.eq(installedVersion, latestValidVersion)) {
    console.log(`✅ ${pkg}@${latestValidVersion} is already installed and meets the minimum age requirement.`);
    return;
  }

  const publishedDate = time[latestValidVersion];
  const published = new Date(publishedDate).getTime();
  const ageDays = Math.floor((Date.now() - published) / (1000 * 60 * 60 * 24));

  console.log(`⬆️  Updating ${pkg} to ${latestValidVersion} (published ${ageDays} days ago)`);
  execCmdSync(`npm install ${pkg}@${latestValidVersion} --silent --no-audit ${asDev ? "--save-dev" : ""}${exact || config.exactInstall ? " --save-exact" : ""}`, { inherit: true });

  await checkVulnerabilities(pkg);
}

function getInstalledVersion(pkg) {
  try {
    const pkgJsonPath = path.join(process.cwd(), "node_modules", pkg, "package.json");
    if (existsSync(pkgJsonPath)) {
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
      return pkgJson.version;
    }
  } catch (err) {
    console.error(`❌ Error checking installed version for ${pkg}: ${err.message}`);
  }
  return null;
}

async function Update(argv) {
  if (argv["min-age"]) {
    try {
      console.log("Update command is not perfect, and can have some issues.")
      config.minAge = parseMinAge(argv["min-age"]);
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  }

  let packages = argv.packages;

  if (argv.all) {
    const pkgPath = path.join(process.cwd(), "package.json");
    if (!existsSync(pkgPath)) {
      console.error("❌ No package.json found in current directory");
      process.exit(1);
    }
    const pkgJson = JSON.parse(readFileSync(pkgPath, "utf8"));
    const deps = Object.keys(pkgJson.dependencies || {});
    const devDeps = Object.keys(pkgJson.devDependencies || {});
    packages = [...deps, ...devDeps];
    if (packages.length === 0) {
      console.log("✅ No dependencies found to update");
      return;
    }
    console.log(`📦 Found ${packages.length} dependencies in package.json`);
  }

  if (!packages || packages.length === 0) {
    console.error("❌ You must specify at least one package to update or use --all");
    process.exit(1);
  }

  for (const pkg of packages) {
    await checkAndUpdate(pkg, argv.dev, argv.exact);
  }
}

const severityObj = {
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4
}


async function checkVulnerabilities(pkg) {
  try {
    const output = execCmdSync(`npm audit --json`, { encoding: "utf8", suppressOutput: true });
    let audit;
    try {
      audit = JSON.parse(output);
    } catch {
      audit = null;
    }
    // Direct access to the specific package
    const vuln = audit && audit.vulnerabilities ? audit.vulnerabilities[pkg] : null;

    if (vuln) {
      const getSeverityValue = (level) => severityObj[level] || 1;
      const vulnSeverity = getSeverityValue(vuln.severity);
      const viaSeverity = Array.isArray(vuln.via)
        ? vuln.via.reduce((max, issue) => {
          if (typeof issue === "object" && issue.severity) {
            const severityValue = getSeverityValue(issue.severity);
            return severityValue > max ? severityValue : max;
          }
          return max;
        }, 0)
        : 0;
      const highestSeverity = Math.max(vulnSeverity, viaSeverity);

      if (vuln.via && vuln.via.length >= 1) {
        console.error(`🚨 Vulnerabilities found in ${pkg}:`);
        if (typeof vuln.via === "object" && !Array.isArray(vuln.via)) {
          for (const issue of Object.values(vuln.via)) {
            console.error(` - ${issue.title || issue} (${issue.severity})`);
          }
        } else {
          for (const issue of vuln.via) {
            if (typeof issue === "object" && issue.title && issue.severity) {
              console.error(` - ${issue.title} (${issue.severity})`);
            } else {
              console.error(` - ${issue} (dependency level)`);
            }
          }
        }
      } else {
        console.error(`🚨 Vulnerabilities found in ${pkg}`);
      }

      if (config.mode === "block" && highestSeverity >= 3) {
        console.error(`For security, the package ${pkg} was uninstalled. Reason: This package has high or critical vulnerabilities.`);
        execCmdSync(`npm uninstall ${pkg} --no-audit`, { inherit: true });
      }
      if (config.mode === "warn") console.warn("⚠️ Installation will proceed due to 'warn' mode.");
    } else {
      console.log(`✅ No vulnerabilities found for ${pkg}`);
    }
  } catch (err) {
    if (err.stdout) {
      try {
        const audit = JSON.parse(err.stdout.toString());
        const vuln = audit.vulnerabilities[pkg];

        if (vuln) {
          const getSeverityValue = (level) => severityObj[level] || 1;
          const vulnSeverity = getSeverityValue(vuln.severity);
          const viaSeverity = Array.isArray(vuln.via)
            ? vuln.via.reduce((max, issue) => {
              if (typeof issue === "object" && issue.severity) {
                const severityValue = getSeverityValue(issue.severity);
                return severityValue > max ? severityValue : max;
              }
              return max;
            }, 0)
            : 0;

          const highestSeverity = Math.max(vulnSeverity, viaSeverity);

          if (vuln.via && vuln.via.length >= 1) {
            console.error(`🚨 Vulnerabilities found in ${pkg}:`);
            if (typeof vuln.via === "object" && !Array.isArray(vuln.via)) {
              for (const issue of Object.values(vuln.via)) {
                console.error(` - ${issue.title || issue} (${issue.severity})`);
              }
            } else {
              for (const issue of vuln.via) {
                if (typeof issue === "object" && issue.title && issue.severity) {
                  console.error(` - ${issue.title} (${issue.severity})`);
                } else {
                  console.error(` - ${issue} [sub-dependency level] recommended action: send an issue to the maintainer of this sub-dependency.`);
                }
              }
            }
          } else {
            console.error(`🚨 Vulnerabilities found in ${pkg}`);
          }

          if (config.mode === "block" && highestSeverity >= 3) {
            console.error(`For security, the package ${pkg} was uninstalled. Reason: This package has high or critical vulnerabilities.`);
            execCmdSync(`npm uninstall ${pkg} --no-audit`, { inherit: true });
          }
          if (config.mode === "warn") console.warn("⚠️ Installation will proceed due to 'warn' mode.");
        } else {
          console.log(`✅ No vulnerabilities found for ${pkg}`);
        }
      } catch (_) { }
    }
  }
}


async function auditPackage(pkgSpec, version) {
  const [pkg] = splitPkgSpec(pkgSpec);

  try {

    await checkVulnerabilities(pkg);
  } catch (error) {
    console.error(`❌ Failed to audit ${pkg}@${version}: ${error.message}`);
    process.exit(1);
  }



}

async function resolveSafeVersion(pkgSpec) {
  const [pkg, versionRange] = splitPkgSpec(pkgSpec);
  if (config.exclude.includes(pkg)) {
    console.log(`⚠️  ${pkg} is excluded from restrictions. Running without validation.`);
    return pkgSpec; // return as-is
  }

  const res = await fetch(`https://registry.npmjs.org/${pkg}`);
  if (!res.ok) {
    throw new Error(`❌ Failed to fetch metadata for ${pkg}`);
  }
  const meta = await res.json();
  const versions = Object.keys(meta.versions);
  const time = meta.time;

  const minAge = config.minAge || 0;
  const candidates = versions.filter(v => {
    const publishedDate = time[v];
    if (!publishedDate) return false;
    const published = new Date(publishedDate).getTime();
    const ageDays = Math.floor((Date.now() - published) / (1000 * 60 * 60 * 24));
    return ageDays >= minAge;
  });

  if (candidates.length === 0) {
    throw new Error(`❌ No versions of ${pkg} are at least ${minAge} days old`);
  }

  let resolvedVersion;
  if (!versionRange) {
    resolvedVersion = semver.maxSatisfying(candidates, "*");
  } else {
    const candidateInRange = candidates.filter(v => semver.satisfies(v, versionRange));
    if (candidateInRange.length === 0) {
      throw new Error(`❌ No version of ${pkg} satisfies "${versionRange}" and is at least ${minAge} days old`);
    }
    resolvedVersion = semver.maxSatisfying(candidateInRange, "*");
  }

  const publishedDate = time[resolvedVersion];
  const published = new Date(publishedDate).getTime();
  const ageDays = Math.floor((Date.now() - published) / (1000 * 60 * 60 * 24));

  console.log(`✅ Resolved version: ${pkg}@${resolvedVersion} (published ${ageDays} days ago)`);

  return `${pkg}@${resolvedVersion}`;
}


async function checkAndInstall(pkgSpec, asDev = false, exact = false) {
  const [pkg, versionRange] = splitPkgSpec(pkgSpec);
  const isExcludedInstall = Array.isArray(config.excludeInstall) && config.excludeInstall.includes(pkg);
  if (isExcludedInstall) {
    console.log(`⚠️  ${pkg} is excluded from installation. Skipping install.`);
    return;
  }
  if (config.exclude.includes(pkg)) {
    console.log(`⚠️  ${pkg} is excluded from restrictions. Installing without validation.`);
    execCmdSync(`npm install ${pkgSpec} --silent --no-audit ${asDev ? " --save-dev" : ""}${exact || config.exactInstall ? " --save-exact" : ""}`, { inherit: true });
    return;
  }

  const res = await fetch(`https://registry.npmjs.org/${pkg}`);
  if (!res.ok) {
    console.error(`❌ Failed to fetch metadata for ${pkg}`);
    return;
  }
  const meta = await res.json();
  const versions = Object.keys(meta.versions);
  const time = meta.time;
  let resolvedVersion;

  // Filter versions that meet minAge
  const minAge = config.minAge || 0;
  const candidates = versions.filter(v => {
    const publishedDate = time[v];
    if (!publishedDate) return false;
    const published = new Date(publishedDate).getTime();
    const ageDays = Math.floor((Date.now() - published) / (1000 * 60 * 60 * 24));
    return ageDays >= minAge;
  });

  // Helper to suggest alternative versions
  function suggestAlternativeVersions(allVersions, timeObj, minAge, versionRange) {
    // Filter by minAge
    const validVersions = allVersions.filter(v => {
      const publishedDate = timeObj[v];
      if (!publishedDate) return false;
      const published = new Date(publishedDate).getTime();
      const ageDays = Math.floor((Date.now() - published) / (1000 * 60 * 60 * 24));
      return ageDays >= minAge;
    });
    // If there is a range, filter by range
    let filtered = validVersions;
    if (versionRange) {
      filtered = validVersions.filter(v => semver.satisfies(v, versionRange));
    }
    // Sort by publish date descending
    filtered.sort((a, b) => {
      const ta = new Date(timeObj[a]).getTime();
      const tb = new Date(timeObj[b]).getTime();
      return tb - ta;
    });
    // Take up to 3 versions
    return filtered.slice(0, 3);
  }

  if (candidates.length === 0) {
    console.error(`❌ No versions of ${pkg} were found that are at least ${minAge} days old.`);
    const suggestions = suggestAlternativeVersions(versions, time, 0, versionRange);
    if (suggestions.length > 0) {
      console.log(`🔎 Suggested recent versions:`);
      suggestions.forEach((v, i) => {
        const age = Math.floor((Date.now() - new Date(time[v]).getTime()) / (1000 * 60 * 60 * 24));
        console.log(`  ${i + 1}. ${pkg}@${v} (published ${age} days ago)`);
      });
      console.log(`ℹ️  You can view all available versions and their history at: https://www.npmjs.com/package/${pkg}?activeTab=versions`);
    } else {
      console.log(`No alternative versions available.`);
    }
    console.log(`⚠️  Audit cannot run until the package is installed.`);
    return;
  }

  if (!versionRange) {
    resolvedVersion = semver.maxSatisfying(candidates, "*");
  } else {
    const candidateInRange = candidates.filter(v => semver.satisfies(v, versionRange));
      if (candidateInRange.length === 0) {
      if (config.minAge && config.minAge > 0) {
        console.error(`❌ No version of ${pkg} was found that satisfies "${versionRange}" and is at least ${minAge} days old.`);
      } else {
        console.error(`❌ No version of ${pkg} was found that satisfies "${versionRange}".`);
      }
      const suggestions = suggestAlternativeVersions(candidates, time, minAge, null);
      if (suggestions.length > 0) {
        console.log(`🔎 Suggested closest matching versions:`);
        suggestions.forEach((v, i) => {
          const age = Math.floor((Date.now() - new Date(time[v]).getTime()) / (1000 * 60 * 60 * 24));
          console.log(`  ${i + 1}. ${pkg}@${v} (published ${age} days ago)`);
        });
        console.log(`ℹ️  You can view all available versions and their history at: https://www.npmjs.com/package/${pkg}?activeTab=versions`);
      } else {
        console.log(`No alternative versions available.`);
      }
      console.log(`⚠️  Audit cannot run until the package is installed.`);
      return;
    }
    resolvedVersion = semver.maxSatisfying(candidateInRange, "*");
  }

  const publishedDate = time[resolvedVersion];
  const published = new Date(publishedDate).getTime();
  const ageDays = Math.floor((Date.now() - published) / (1000 * 60 * 60 * 24));

  console.log(`✅ Recommended version: ${pkg}@${resolvedVersion} (published ${ageDays} days ago)`);
  console.log(`✅ Installing ${pkg}@${resolvedVersion} (published ${ageDays} days ago)`);
  execCmdSync(`npm install ${pkg}@${resolvedVersion} --silent --no-audit ${asDev ? " --save-dev" : ""}${exact || config.exactInstall ? " --save-exact" : ""}`, { inherit: true });
  await checkVulnerabilities(pkg);
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

async function runAudit(argv) {
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
  for (const pkgSpec of argv.packages) {
    await auditPackage(pkgSpec);
  }
}

async function runNPX(argv) {
  const validModes = ["block", "warn", "off"];
  if (!validModes.includes(config.mode)) {
    console.error(`❌ Invalid mode in configuration: ${config.mode}. Valid options are: ${validModes.join(", ")}`);
    process.exit(1);
  }
  if (argv["min-age"]) {
    try {
      config.minAge = parseMinAge(argv["min-age"]);
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  }

  const basePkg = argv.package

  let safePkg;
  let confirm = ""

  try {
    safePkg = await resolveSafeVersion(basePkg);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  if (config.mode === "warn") {
    console.log(`⚠️ ${pkg} will use/install without user confirmation. You will use this package at your own risk.`);
    confirm = "--yes"
  } else if (config.mode === "off") {
    confirm = "--yes"
  } else {
    confirm = ""
  }

  const args = argv.args ? argv.args.join(" ") : "";

  try {
    execCmdSync(`npx ${confirm} ${safePkg} ${args} --silent`, { inherit: true });

  } catch (err) {

    if (err.status === 1) {
      console.error(`❌ Installation/use of ${basePkg} was canceled (user or process canceled it).`);
    } else if (err.stderr) {
      console.error(`❌ Installation/use of ${basePkg} failed.`);
    } else {
      console.error(`❌ Installation/use of ${basePkg} was canceled due to an unknown error.`);
    }

    process.exit(1);
  }
}