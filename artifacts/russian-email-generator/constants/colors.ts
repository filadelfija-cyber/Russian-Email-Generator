/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#F8F3EA',
    tint: '#F26A4F',

    // Core surfaces
    background: '#0E1525',
    foreground: '#F8F3EA',

    // Cards / elevated surfaces
    card: '#172138',
    cardForeground: '#F8F3EA',

    // Primary action color (buttons, links, active states)
    primary: '#F26A4F',
    primaryForeground: '#20131A',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#25314B',
    secondaryForeground: '#F8F3EA',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#1D2A43',
    mutedForeground: '#9AA7BD',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#F7C96A',
    accentForeground: '#20131A',

    // Destructive actions (delete, error states)
    destructive: '#E85D75',
    destructiveForeground: '#FFFFFF',

    // Borders and input outlines
    border: '#2A3957',
    input: '#2A3957',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 18,
};

export default colors;
