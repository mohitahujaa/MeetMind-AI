# Generating Extension Icons

The extension needs PNG icons in the following sizes:
- 16x16 (toolbar)
- 32x32 (retina toolbar)
- 48x48 (extension management)
- 128x128 (Chrome Web Store)

## Quick Method: Use Online Converter

1. Open the `icon.svg` file
2. Go to https://cloudconvert.com/svg-to-png
3. Upload `icon.svg`
4. Set output size to 128x128
5. Download as `icon128.png`
6. Repeat for other sizes: 48x48, 32x32, 16x16

## Alternative: Use ImageMagick (if installed)

```bash
# In extension/public/icons/ directory
magick icon.svg -resize 128x128 icon128.png
magick icon.svg -resize 48x48 icon48.png
magick icon.svg -resize 32x32 icon32.png
magick icon.svg -resize 16x16 icon16.png
```

## Temporary Workaround

For development, you can use a simple purple square:
1. Create a 128x128 purple image in any image editor
2. Save as icon128.png, icon48.png, icon32.png, icon16.png
3. Place in this directory

The extension will work without custom icons, but Chrome will show a default puzzle piece icon.
