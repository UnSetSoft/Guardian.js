# Guardian.js

Guardian.js is a command-line tool that helps you install and update npm packages safely by enforcing a **minimum release age requirement**. This prevents installing packages that are too new and potentially unstable, making your projects more reliable and secure.

## Why Guardian.js?

- 🛡️ **Safety First**: Avoid newly released packages that might have undiscovered bugs or vulnerabilities.
- 🔍 **Age Requirement**: Set a minimum age for packages (e.g., 30 days, 1 week).
- 📦 **Flexible Control**: Exclude specific packages, control updates separately, and manage dev dependencies.
- 🚨 **Vulnerability Detection**: Automatically detects and handles high/critical vulnerabilities.
- ⚙️ **Configuration**: Use `guardian.config.json` for project-level settings.

## Installation

Install Guardian.js globally:

```bash
npm install -g @unsetsoft/guardian.js
```

## Quick Start

### 1. Initialize Configuration

Create a default config file inside your project directory:

```bash
guardian init
```

This creates `guardian.config.json` with sensible defaults.

### 2. Install Packages Safely

Install one or more packages with a minimum age requirement:

```bash
guardian install react@18 lodash@4 --min-age 30
```

Install all dependencies from `package.json`:

```bash
guardian install --all --min-age 30
```

### 3. Update Packages

Update all dependencies to the latest safe versions:

```bash
guardian update --min-age 30
```

Or with config file defaults:

```bash
guardian update
```

## Commands

### `install` - Install packages safely

```bash
guardian install [packages..] [options]
```

**Options:**
- `--min-age`, `-m`: Minimum package age (default: from config)
- `--dev`, `-D`: Install as devDependency
- `--exact`: Install exact version (no semver ranges)
- `--all`: Install all dependencies from package.json

**Examples:**

```bash
# Install specific packages
guardian install react@19 --min-age 30

# Install as dev dependency
guardian install webpack --dev --min-age 14

# Install all packages from package.json
guardian install --all --min-age 1w

# Install with exact version
guardian install lodash --exact --min-age 30
```

### `update` - Update packages safely

```bash
guardian update [options]
```

**Options:**
- `--all`: Update all dependencies (default: true)
- `--min-age`, `-m`: Minimum package age
- `--exact`: Install exact versions

**Examples:**

```bash
# Update all dependencies
guardian update

# Update with specific age requirement
guardian update --min-age 7d

# Update with minimum 1 week age
guardian update --min-age 1w

# Update to exact versions
guardian update --exact --min-age 2w
```

### `audit` - Audit packages for vulnerabilities

```bash
guardian audit [packages..]
```

**Examples:**

```bash
# Audit specific packages
guardian audit mongoose react

# Audit with minimum age check
guardian audit next --min-age 7d
```

### `use` - Run packages with age verification

```bash
guardian use <package> [args..]
```

**Examples:**

```bash
# Run a package via npx with age verification
guardian use create-react-app my-app

# Run with arguments
guardian use ts-node --esm script.ts
```

### `init` - Create configuration file

```bash
guardian init
```

Creates a `guardian.config.json` with default settings in your project root.

## Configuration File

Create a `guardian.config.json` or `.guardianrc.json` file in your project root:

```json
{
  "minAge": 30,
  "mode": "block",
  "exclude": [
    "react",
    "lodash"
  ],
  "excludeUpdate": [],
  "excludeInstall": [],
  "exactInstall": false
}
```

## Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `minAge` | string/number | Default minimum package age in days. Formats: `0` (days), `7d` (days), `1w` (weeks), `2m` (months), `24h` (hours) |
| `exclude` | array | Packages excluded from age restrictions (installed without validation) |
| `excludeUpdate` | array | Packages excluded from the `update` command (skipped entirely) |
| `excludeInstall` | array | Packages excluded from the `install` command (skipped entirely) |
| `exactInstall` | boolean | Install packages with exact versions by default (no semver ranges) |
| `mode` | string | Behavior when vulnerabilities are found: `block` (remove), `warn` (warn), `off` (silent) |

### Mode Explanations

- **`block`** (default): If a package has high/critical vulnerabilities, it's automatically removed after installation
- **`warn`**: Log warnings about vulnerabilities but allow installation to proceed
- **`off`**: Don't display vulnerability information

## Common Use Cases

### 1. Safe Development Setup

```bash
# Initialize project
guardian init

# Install all dependencies with 30-day minimum age
guardian install --all --min-age 30
```

### 2. Regular Updates

```bash
# Update all packages with 7-day minimum age
guardian update --min-age 7d
```

### 3. Mixed Dependencies

```json
{
  "minAge": 30,
  "exclude": ["react", "react-dom"],
  "excludeUpdate": ["typescript"],
  "exactInstall": true
}
```

Then:
```bash
# React installs without age check, TypeScript never updates
guardian install --all

# Updates skip TypeScript
guardian update
```

### 4. CI/CD Pipeline

```bash
# In your CI pipeline - ensure dependencies meet age requirement
guardian install --all --min-age 60  # 60-day minimum age

# Before release - update all dependencies
guardian update --min-age 30 --exact
```

## Troubleshooting

### Package Not Found

If you see "Package not found in npm registry", verify the package name is correct:

```bash
# ❌ This will fail if @wrong/scope/pkg doesn't exist
guardian install @wrong/scope/pkg

# ✅ Make sure the package name is correct
guardian install lodash
```

### Peer Dependency Conflicts

If you see `ERESOLVE` errors (peer dependency conflicts), Guardian.js automatically retries with `--legacy-peer-deps`. 

**If the error persists after retry:**

Guardian.js will report "Unresolvable peer dependency conflict" - this means even with `--legacy-peer-deps`, the package cannot be installed due to incompatible dependencies. Options:

1. **Exclude from validation**: Add the package to `excludeInstall` or `excludeUpdate` in your config:
   ```json
   {
     "excludeInstall": ["react-chrono"]
   }
   ```

2. **Update conflicting packages**: Try installing dependencies separately to resolve conflicts:
   ```bash
   guardian install react@latest
   guardian install react-chrono@latest
   ```

3. **Review peer requirements**: Check the package documentation for peer dependency requirements and ensure your dependencies match

### No Valid Versions Found

If you see "No versions meet the minimum age requirement":

```json
{
  "minAge": 1000  // too large
}
```

Solutions:
- Reduce `minAge` in your config
- Use `guardian init` to set a reasonable default (1 day)
- Pass `--min-age 0` to install the latest version without age restriction

### Version Specification Issues

If a specific version doesn't exist:

```bash
# ❌ This version doesn't exist
guardian install lodash@9.9.9

# ✅ Use a valid version
guardian install lodash@4.17.21
```

Guardian will check the npm registry and only show versions that meet your minimum age requirement.

## Min-Age Formats

The `--min-age` parameter accepts multiple formats:

```bash
guardian install react --min-age 0        # 0 days (any version)
guardian install react --min-age 30       # 30 days
guardian install react --min-age 1w       # 1 week = 7 days
guardian install react --min-age 2m       # 2 months ≈ 60 days
guardian install react --min-age 24h      # 24 hours = 1 day
guardian install react --min-age 24hs     # Same as above
```

## Tips & Best Practices

✅ **Do:**
- Use a config file for consistent settings across your team
- Set a reasonable default age (7-30 days for most projects)
- Review excluded packages regularly
- Run `guardian update` periodically for security patches
- Use `--exact` in production deployments for reproducibility

❌ **Don't:**
- Use `--min-age 0` in production (defeats the purpose)
- Exclude too many packages (you lose safety)
- Ignore vulnerability warnings in `warn` mode
- Skip security updates for too long

## License

MPL-2.0

## Support

For issues, suggestions, or contributions, visit: [github.com/unsetsoft/guardian.js](https://github.com/unsetsoft/guardian.js)
