# Guardian.js

Guardian.js is a command-line tool that helps you install npm packages while ensuring that the packages meet a minimum release age requirement. This is particularly useful for avoiding newly released packages.

## Installation

You can install Guardian.js globally using npm:

```bash
npm install -g guardian.js
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
guardian install react@18 lodash@5 --min-age 30
```

```bash
guardian install react@18 lodash@5 --min-age 2w
```

```bash
guardian install react@18 lodash@5 --min-age 24hs
```