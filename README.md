# MCP-UI SDK [![npm](https://img.shields.io/npm/v/mcp-ui-sdk.svg)](https://npmjs.com/package/mcp-ui-sdk)

[![Unit Test](https://github.com/modelcontextprotocol-ui/sdk/actions/workflows/unit-test.yml/badge.svg)](https://github.com/modelcontextprotocol-ui/sdk/actions/workflows/unit-test.yml)

A TypeScript SDK for implementing embeddable UI elements that conform to the [MCP-UI Embedding Protocol Specification](https://github.com/modelcontextprotocol-ui/.github/blob/main/README.md) (Version 1.0.0).

## Overview

The MCP-UI SDK provides a reference implementation for the MCP-UI Embedding Protocol, which enables interactive UI components to be embedded within AI chat interfaces. This protocol is designed for systems where AI agents are orchestrated via a Multi-Party Computation (MCP) server or similar system that registers and manages available tools.

The SDK includes:

- Client-side library for embedded UIs
- Host-side library for chat interfaces
- Type definitions and utilities for protocol messages
- JWT authentication utilities

## Installation

```bash
npm install mcp-ui-sdk
```

## Usage

The SDK is divided into three main modules:

### 1. Client Module (for Embedded UIs)

```typescript
import { createMCPUI } from 'mcp-ui-sdk/client'

// Create a new MCP-UI client instance
const ui = createMCPUI()

// Set up event listeners
ui.on('initialized', (data) => {
  console.log('UI initialized with context:', ui.getContext())
})

ui.on('contextUpdated', (context) => {
  console.log('Context updated:', context)
})

ui.on('themeUpdated', (themeSettings) => {
  console.log('Theme updated:', themeSettings)
})

ui.on('permissionResponse', (response) => {
  console.log(
    `Permission ${response.scope} ${response.granted ? 'granted' : 'denied'}`,
  )
})

// Request optional permissions
ui.requestPermission(
  'write:user_data',
  'This allows the UI to save your preferences',
)

// Send actions to the host
ui.sendAction('item_selected', { itemId: '123' })

// Enable auto-resizing
ui.enableAutoResize(document.getElementById('content'))
```

### 2. Host Module (for Chat Interfaces)

```typescript
import { createMCUHost, URLUtils } from 'mcp-ui-sdk/host'

// Create a host instance
const host = createMCUHost({
  jwksUrl: 'https://your-domain.com/.well-known/jwks.json',
  issuer: 'https://your-domain.com',
})

// Register a UI definition (typically from an MCP server)
const uiRegistration = {
  ui_name: 'Interactive Product Explorer',
  ui_url_template:
    'https://shop.example.com/embed/product-explorer?pid={product_id}&theme={theme_base}',
  description: 'Provides an interactive exploration of a product...',
  capabilities: ['image_gallery_zoomable', '3d_model_viewer'],
  permissions: {
    required_scopes: ['read:product_info_basic'],
    optional_scopes: ['read:user_reviews'],
  },
  protocol_support: {
    min_version: '1.0.0',
    target_version: '1.0.0',
  },
}

// Fill URL template with parameters
const url = URLUtils.fillTemplate(uiRegistration.ui_url_template, {
  product_id: '12345',
  theme_base: 'dark',
})

// Embed the UI
const container = document.getElementById('ui-container')
const embeddedUI = host.embedUI(
  'product-explorer',
  container,
  uiRegistration,
  url,
)

// Create authentication token
const auth = await host.createAuth('user-123', 'https://shop.example.com', [
  'read:product_info_basic',
])

// Initialize the UI
embeddedUI.init({
  user: { id: 'user-123' },
  auth,
  context: {
    productDetails: {
      /* ... */
    },
  },
  themeSettings: { mode: 'dark', primary_color: '#336699' },
})

// Handle UI actions
embeddedUI.setActionHandler((actionName, payload) => {
  console.log(`UI action: ${actionName}`, payload)
})

// Custom permission request handler
embeddedUI.setPermissionRequestHandler(async (scope, reasoning) => {
  // Show a custom permission dialog to the user
  return await showPermissionDialog(scope, reasoning)
})
```

### 3. Types Module (Shared Types)

```typescript
import {
  UIRegistrationPayload,
  ThemeSettings,
  PROTOCOL_VERSION,
} from 'mcp-ui-sdk/types'

// Define a UI registration payload
const registration: UIRegistrationPayload = {
  ui_name: 'Data Visualization',
  ui_url_template: 'https://viz.example.com/embed?chart={chart_type}',
  description: 'Interactive data visualization component',
  capabilities: ['bar_chart', 'line_chart', 'pie_chart'],
  permissions: {
    required_scopes: ['read:data_basic'],
    optional_scopes: ['export:chart'],
  },
  protocol_support: {
    min_version: '1.0.0',
    target_version: '1.0.0',
  },
}

// Define theme settings
const theme: ThemeSettings = {
  mode: 'light',
  primary_color: '#4285F4',
  secondary_color: '#34A853',
  font_family: 'Roboto, sans-serif',
  border_radius: '4px',
}

console.log(`Using protocol version: ${PROTOCOL_VERSION}`)
```

## Protocol Specification

This SDK implements the MCP-UI Embedding Protocol Specification (Version 1.0.0), which defines:

1. **Registration of Embeddable UIs**: How UIs are registered with metadata for discovery
2. **Agent Logic for UI Selection**: How AI agents select appropriate UIs
3. **Embedding Mechanism**: How UIs are embedded in chat interfaces
4. **Authentication Protocol**: How UIs are authenticated using JWTs
5. **Security Considerations**: Sandbox restrictions and best practices
6. **Host-UI Communication**: Message types and formats
7. **User Consent and Permissions**: How permissions are requested and granted

For the full specification, see the [MCP-UI Embedding Protocol Specification](https://github.com/modelcontextprotocol-ui/.github/blob/main/README.md).

## Security Considerations

When implementing this SDK:

- Always use proper iframe sandboxing (`allow-scripts allow-forms allow-same-origin`)
- Validate message origins in both host and UI
- Use short-lived, scoped JWT tokens
- Store tokens in memory only, not in localStorage/sessionStorage
- Implement proper user consent flows for permissions
- Follow the data minimization principle

## Examples

### Client-side Example (React)

```tsx
import React, { useEffect, useRef } from 'react'
import { createMCPUI } from 'mcp-ui-sdk/client'

function EmbeddableUI() {
  const uiRef = useRef(createMCPUI())
  const contentRef = useRef<HTMLDivElement>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [context, setContext] = useState(null)
  const [theme, setTheme] = useState(null)

  useEffect(() => {
    const ui = uiRef.current

    ui.on('initialized', () => {
      setIsInitialized(true)
      setContext(ui.getContext())
      setTheme(ui.getThemeSettings())
    })

    ui.on('contextUpdated', (newContext) => {
      setContext(newContext)
    })

    ui.on('themeUpdated', (newTheme) => {
      setTheme(newTheme)
    })

    // Enable auto-resizing
    if (contentRef.current) {
      ui.enableAutoResize(contentRef.current)
    }

    return () => {
      ui.disableAutoResize()
    }
  }, [])

  return (
    <div ref={contentRef}>
      {isInitialized ? (
        <div className={theme?.mode === 'dark' ? 'dark-theme' : 'light-theme'}>
          {/* Your UI content here */}
        </div>
      ) : (
        <div>Loading...</div>
      )}
    </div>
  )
}
```

### Host-side Example (Express.js)

```typescript
import express from 'express'
import { createMCUHost } from 'mcp-ui-sdk/host'

const app = express()
const host = createMCUHost({
  jwksUrl: 'https://your-domain.com/.well-known/jwks.json',
  issuer: 'https://your-domain.com',
})

// Serve JWKS for token validation
app.get('/.well-known/jwks.json', async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.send(await host.serveJWKS())
})

app.listen(3000, () => {
  console.log('Server running on port 3000')
})
```

## License

[MIT](./LICENSE) License © 2025 [Nick Randall](https://github.com/nicksrandall)
