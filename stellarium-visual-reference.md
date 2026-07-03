# Stellarium Visual Reference — For Three.js Implementation

## Source
- MiMo-V2.5 analysis of Scottie Clarke's video: https://youtu.be/oPJmV95giS4
- Stellarium official config.ini documentation
- Stellarium user guide

## Stellarium Default Colors (from config.ini)

### Sky & Background
- **sky_background_color**: 0.0, 0.0, 0.0 (pure black)
- **default_color**: 0.5, 0.5, 0.7 (blue-gray, used for UI elements)

### Constellations
- **const_lines_color**: 0.2, 0.2, 0.6 (blue-purple) — RGB 51, 51, 153
- **const_names_color**: 0.4, 0.6, 0.9 (light blue) — RGB 102, 153, 230
- **const_boundary_color**: 0.3, 0.1, 0.1 (dark red) — RGB 77, 26, 26
- **asterism_lines_color**: 0.4, 0.4, 0.8 (purple-blue) — RGB 102, 102, 205

### Stars
- **star_label_color**: 0.4, 0.3, 0.5 (purple-gray) — RGB 102, 77, 128
- Stars rendered as point sprites with magnitude-based sizing
- Bright stars have halo/glow (flagDrawBigStarHalo)
- Optional spiky rays for bright stars (flagStarSpiky)

### Planets
- **planet_names_color**: 0.5, 0.5, 0.7 (blue-gray) — RGB 128, 128, 179
- **planet_pointers_color**: 1.0, 0.3, 0.3 (red) — RGB 255, 77, 77
- Planets rendered as solid colored circles (2-8px diameter)

### Ecliptic & Grids
- **ecliptic_J2000_color**: 0.7, 0.2, 0.2 (red) — RGB 179, 51, 51
- **equatorial_J2000_color**: 0.6, 0.1, 0.4 (magenta)

## Clarke's Video Visual Style (from MiMo Analysis)

### Constellation Lines
- Thin cyan/light-blue lines (#66CCFF at 40% opacity, ~1px stroke)
- Connect IAU stick-figure pattern (NOT artistic illustrations)
- Constellation art toggle is OFF
- No filled shapes

### Star Labels
- Font: Sans-serif (Segoe UI or similar, 12-14px)
- Color: White text with ~80-90% alpha
- Placement: Offset right/below each star point
- Only 1st-3rd magnitude stars labeled
- Constellation names: "VIRGO", "LEO" in ALL CAPS, slightly larger

### Stars
- Small white/blue-white dots (1-4px diameter based on magnitude)
- Magnitude determines visibility and size
- Subtle glow from atmospheric rendering

### Planets
- Larger circles than stars (2-8px diameter)
- Jupiter: Pale yellow-white, noticeably larger
- Venus: Very bright white/yellow (magnitude -4)
- Mercury: Small, grayish-white
- Mars: Distinct orange-red tint
- Saturn: Pale yellow-gold (when shown)

### Sun
- Bright white-yellow circle (~20-30px diameter)
- Natural atmospheric bloom (no special corona effect)
- Atmosphere ON creates orange/blue gradient glow at horizon

### Moon
- Small crescent (~8-12px)
- Position near Spica/Virgo's foot region
- Natural rendering, no special effects

### Jupiter Trail
- Thin colored line (white or light yellow)
- Traces Jupiter's ecliptic path over months
- Shows retrograde loop through Virgo

### Camera & Viewpoint
- Observer location: Jerusalem, Israel (31.77°N, 35.23°E)
- Fixed geocentric view
- FOV: ~60-90° (standard Stellarium field of view)
- Mostly static for main alignment demonstration
- Manual pan/zoom via mouse drag/scroll

### Background
- Deep space black/dark blue (#0a0a1a to #000510)
- With atmosphere ON: Gradient from horizon (lighter blue/orange at twilight) to zenith (deep black-blue)
- Horizon line shows greenish-brown landscape silhouette

### UI Elements
- Date/time display in bottom toolbar
- Format: YYYY-MM-DD HH:MM:SS
- Time acceleration controls visible
- Minimal text overlays (mostly narration-driven)

## Three.js Implementation Plan

### Colors to Use
```javascript
const STELLARIUM_COLORS = {
  skyBackground: 0x0a0a1a,      // Deep space black
  constellationLines: 0x66CCFF,  // Cyan (Clarke's style)
  constellationNames: 0x6699E6, // Light blue
  starLabels: 0xCCCCCC,         // White with alpha
  jupiterTrail: 0xFFFFCC,       // Light yellow
  sun: 0xFFFFEE,                // White-yellow
  jupiter: 0xE8D8A0,           // Pale yellow
  mars: 0xCC5544,              // Orange-red
  venus: 0xFFFFDD,             // Bright white
  mercury: 0xB0B8C0,           // Grayish-white
}
```

### Star Rendering
- Point sprites with magnitude-based sizing
- Size range: 1-4px (magnitude 0-4)
- Color: white/blue-white (#FFFFFF to #EEEEFF)
- Subtle glow (not UnrealBloomPass magnitude)

### Constellation Lines
- Thin lines (~1px stroke)
- Color: #66CCFF at 40% opacity
- Connect IAU stick-figure star patterns
- No boundary lines (Clarke turns them off)

### Jupiter Trail
- Thin line tracing Jupiter's path
- Color: light yellow (#FFFFCC)
- Shows full retrograde loop through Virgo
- Progress-based opacity (fades in as time advances)

### Camera
- Fixed geocentric from Jerusalem coordinates
- FOV: 60-90° (adjustable)
- Smooth pan/zoom controls

### UI
- Prominent date counter (bottom bar)
- Time acceleration controls
- Minimal text overlays
