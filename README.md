# Guardian.js

Guardian.js is a command-line tool that helps you install npm packages while ensuring that the packages meet a minimum release age requirement. This is particularly useful for avoiding newly released packages.

## Installation

You can install Guardian.js globally using npm:

```bash
npm install -g @unsetsoft/guardian.js
```

## Usage

```bash
guardian install [packages..] [options]
```

### Options

- `--min-age`, `-m`: Specify the minimum age of the package in days.

supported formats:
  - `0` (days)
  - `xw` (weeks)
  - `xm` (months)
  - `xh` (hour)
  - `xhs` (hours)

## Example

```bash
guardian install react@18 lodash@4 --min-age 30
```

```bash
guardian install @unsetsoft/jlib --min-age 24hs
```

To install a package as a devDependency, use the `--dev` or `-D` flag:
```bash
guardian install webpack --dev
```

If you want to update packages, you can use the `update` command:
```bash
guardian update --min-age 30
```

if you use the config file, you can just run:
```bash
guardian update
```

To use a package with npx, you can use:

```bash
guardian use <package> [args..]
```
`guardian use` is affected by the “mode” setting. Be careful when using it if you use ‘warn’ or “off.” Also, this command does not use audit to remove it. 

## Use config file

You can create a `guardian.config.json` file in your project root to set default options. For example:

```json
{
  "minAge": 30,
  "mode": "block",
  "exclude": [
    "react",
    "lodash"
  ],
  "exactInstall": false,
}
```
### Create a config file with default values

```bash
guardian init
```

### Configuration Options
- `minAge`: Default minimum age in days for packages. This can be overridden by the `--min-age` flag in the CLI. valid formats are:
  - `0` (days) integer
  - `xw` (weeks) string
  - `xm` (months) string
  - `xh` (hour) string
  - `xhs` (hours) string
- `exclude`: An array of package names to exclude from age restrictions.
- `exactInstall`: Boolean to determine if packages should be installed with exact versions by default. Alternatively, you can use the `--exact` flag in the CLI.
- `mode`: Defines the behavior when vulnerabilities are found. Options are:
  - `block`: Depending on the severity of the vulnerabilities, the dependency will be removed.
  - `warn`: Log a warning but allow installation to proceed.
  - `off`: Hide vulnerability logs and allow installation to proceed.