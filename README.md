# ui-sdk [![npm](https://img.shields.io/npm/v/ui-sdk.svg)](https://npmjs.com/package/ui-sdk)

[![Unit Test](https://github.com/modelcontextprotocol-ui/ui-sdk/actions/workflows/unit-test.yml/badge.svg)](https://github.com/modelcontextprotocol-ui/ui-sdk/actions/workflows/unit-test.yml)

ui-sdk

## Install

```bash
npm i ui-sdk
```

## Usage

```tsx
import { createMPCUI, ThemeSettings } from 'ui-sdk'

const ui = createMPCUI()

// Set up event listeners
ui.on('initialized', handleInitialized)
ui.on('contextUpdated', handleContextUpdated)
ui.on('themeUpdated', handleThemeUpdated)
ui.on('permissionResponse', handlePermissionResponse)
```

## License

[MIT](./LICENSE) License © 2025 [Nick Randall](https://github.com/nicksrandall)
