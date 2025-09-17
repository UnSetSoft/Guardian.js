# Shield.js

Shield.js is a command-line tool that helps you install npm packages while ensuring that the packages meet a minimum release age requirement. This is particularly useful for avoiding newly released packages.

## Installation

You can install Shield.js globally using npm:

```bash
npm install -g shield.js
```

## Usage

```bash
shield install [packages..] [options]
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
shield install react@18 lodash@4 --min-age 30
```

```bash
shield install Jlib --min-age 24hs
```

To install a package as a devDependency, use the `--dev` or `-D` flag:
```bash
shield install webpack --dev
```

## Use config file

You can create a `shield.config.json` file in your project root to set default options. For example:

```json
{
  "minAge": 30,
  "exclude": [
    "react",
    "lodash"
  ]
}