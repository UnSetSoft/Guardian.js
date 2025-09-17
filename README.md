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
guardian install Jlib --min-age 24hs
```

To install a package as a devDependency, use the `--dev` or `-D` flag:
```bash
guardian install webpack --dev
```

## Use config file

You can create a `guardian.config.json` file in your project root to set default options. For example:

```json
{
  "minAge": 30,
  "exclude": [
    "react",
    "lodash"
  ],
  "exactInstall": false
}
```
### Configuration Options
- `minAge`: Default minimum age in days for packages.
- `exclude`: An array of package names to exclude from age restrictions.
- `exactInstall`: Boolean to determine if packages should be installed with exact versions by default. Alternatively, you can use the `--exact` flag in the CLI.