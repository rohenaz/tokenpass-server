# TokenPass Theming Infrastructure

## Overview

The TokenPass Next.js app now has a complete dark/light theme system using `next-themes` and shadcn/ui components with an emerald/green accent color appropriate for a Bitcoin/crypto application.

## Setup Complete

### 1. Theme Provider (`src/components/theme-provider.tsx`)
- Wraps the entire app in `layout.tsx`
- Configured with `defaultTheme="dark"` to match crypto aesthetic
- Supports system preference detection with `enableSystem`
- Uses `attribute="class"` for Tailwind CSS compatibility
- Includes `suppressHydrationWarning` on `<html>` tag

### 2. Mode Toggle Component (`src/components/mode-toggle.tsx`)
- Icon-based toggle button (Sun/Moon icons from lucide-react)
- Smooth transitions between themes
- Accessible with proper aria-label and screen reader text
- Uses shadcn/ui Button component with ghost variant

### 3. Color System (`src/app/globals.css`)

#### Primary Colors (Emerald/Green for Crypto)
- **Light mode**: `oklch(0.58 0.18 166)` - Medium emerald green
- **Dark mode**: `oklch(0.65 0.20 166)` - Bright emerald green

#### Full Variable Set
Both `:root` (light) and `.dark` classes define:
- Background/Foreground
- Card styles
- Popover styles
- Primary/Secondary colors
- Muted colors
- Accent colors
- Destructive (error) states
- Border/Input/Ring colors
- Chart colors (1-5)
- Sidebar colors

### 4. Root Layout (`src/app/layout.tsx`)
```tsx
<html lang="en" suppressHydrationWarning>
  <body>
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  </body>
</html>
```

## Usage

### Importing the Mode Toggle
```tsx
import { ModeToggle } from "@/components/mode-toggle";

// In your component
<ModeToggle />
```

### Using Theme-Aware Colors
Always use semantic color classes that respect the theme:

```tsx
// ✅ Good - respects theme
<div className="bg-background text-foreground">
  <h1 className="text-primary">Title</h1>
  <p className="text-muted-foreground">Description</p>
</div>

// ❌ Bad - hardcoded colors
<div className="bg-white text-black">
  <h1 className="text-emerald-600">Title</h1>
</div>
```

## Available Components

All shadcn/ui components are theme-aware:
- Avatar
- Badge
- Button
- Card (with Header, Content, Description, Title)
- Dialog
- Input
- Label
- Radio Group
- Separator

## Color Palette

### Light Mode
- Background: Pure white
- Foreground: Near black
- Primary: Emerald green (#10b981 equivalent)
- Cards: White with subtle borders

### Dark Mode (Default)
- Background: Near black (`oklch(0.145 0 0)`)
- Foreground: Near white (`oklch(0.985 0 0)`)
- Primary: Bright emerald green
- Cards: Dark gray with subtle borders

## Testing

Build verification passed:
```bash
cd /Users/satchmo/code/tokenpass-server/web
bun run build
# ✓ Compiled successfully
```

## Next Steps

The theming infrastructure is complete and ready for page development. When creating new pages:

1. Use the existing shadcn/ui components
2. Follow theme-aware color patterns
3. Import `ModeToggle` for theme switching UI
4. All new components will automatically support both themes

## Files Modified

- `src/app/globals.css` - Added emerald accent colors and destructive-foreground
- `src/app/layout.tsx` - Added ThemeProvider wrapper and updated metadata
- `src/app/page.tsx` - Updated with demo showing theming works
- `src/components/theme-provider.tsx` - Created
- `src/components/mode-toggle.tsx` - Created

## Configuration

The theme system respects:
- User's system preference (via `enableSystem`)
- User's explicit choice (via toggle)
- localStorage persistence (automatic with next-themes)
- No flash of unstyled content (via `suppressHydrationWarning`)
