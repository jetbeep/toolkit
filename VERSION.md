# JetBeep Toolkit - Version History

## Version Information

This file tracks version numbers across the JetBeep Toolkit and its components.

## Current Versions

| Component | Version | Release Date | Location |
|-----------|---------|--------------|----------|
| **JetBeep Toolkit** (Main) | 2.0.0 | October 15, 2025 | [/index.html](index.html) |
| **Publisher** (Fleet Asset Updater) | 2.0.0 | October 15, 2025 | [/publisher/index.html](publisher/index.html) |
| **Logs Viewer** | 1.0.0 | October 15, 2025 | [/logs-viewver/index.html](logs-viewver/index.html) |
| **Image Renamer** | 1.0.0 | October 15, 2025 | [/image-renamer/index.html](image-renamer/index.html) |

## Version Naming Convention

We follow [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`

- **MAJOR**: Incompatible API changes or major feature overhauls
- **MINOR**: New features, backward-compatible functionality additions
- **PATCH**: Bug fixes, minor improvements, documentation updates

## Changelog

### Version 2.0.0 - October 15, 2025

**Main Toolkit:**
- Added version tracking to all pages
- Added footer with "Back to Toolkit" links to all tools

**Publisher (Fleet Asset Updater) - Major Update:**
- 🎉 **BREAKING CHANGE**: Migrated to new `/device-settings` API endpoint
- ⚡ **Performance**: Reduced API calls by 50% (from 2 to 1 per controller)
- 🧹 **Code Simplification**: Removed 4-step process, now uses direct POST
- ❌ **Removed**: `omit()` and `mergeConfigurations()` utility functions (no longer needed)
- 📝 **Updated**: All documentation to reflect new architecture
- ✅ **Added**: MIGRATION_NOTES.md with detailed migration guide
- 🔧 **Updated**: CLI tool (update-controller.js) to use new endpoint
- 📊 **Improved**: Clearer logging showing only settings being applied

**Logs Viewer:**
- Added version footer

**Image Renamer:**
- Added version footer

### Version 1.0.0 - Initial Release

**Main Toolkit:**
- Created central landing page with glassmorphism design
- Bootstrap 5 responsive layout
- Tool cards with descriptions and badges

**Publisher:**
- Web interface for updating controller settings
- CLI tool for automation
- Two-tab interface (Asset Updater + Unit ID Converter)
- Configuration import/export
- Curl command generation for debugging
- Progress tracking and detailed logging

**Logs Viewer:**
- Custom timestamp parsing
- Time difference analysis
- Content filtering by log type
- Drag-and-drop file upload
- Log export functionality

**Image Renamer:**
- Perceptual hash-based image matching
- ZIP file support
- Manual match override
- CSV export of mappings
- 100% browser-based processing

## How to Update Versions

When releasing a new version:

1. **Determine the version number** based on the changes (MAJOR, MINOR, or PATCH)

2. **Update the version in each HTML file:**

   - **Main Toolkit** ([/index.html](index.html) line ~132):
     ```html
     <p class="mb-0 mt-2" style="font-size: 0.85rem; opacity: 0.8;">
       Version X.Y.Z | Released: Month DD, YYYY
     </p>
     ```

   - **Publisher** ([/publisher/index.html](publisher/index.html) line ~382):
     ```html
     <strong>Fleet Asset Updater</strong> | Version X.Y.Z | Released: Month DD, YYYY
     ```

   - **Logs Viewer** ([/logs-viewver/index.html](logs-viewver/index.html) line ~122):
     ```html
     <strong>Logs Viewer</strong> | Version X.Y.Z | Released: Month DD, YYYY
     ```

   - **Image Renamer** ([/image-renamer/index.html](image-renamer/index.html) line ~1579):
     ```html
     <strong>Image Renamer</strong> | Version X.Y.Z | Released: Month DD, YYYY
     ```

3. **Update this VERSION.md file:**
   - Update the "Current Versions" table
   - Add a new section in "Changelog" with release notes

4. **Commit the changes:**
   ```bash
   git add .
   git commit -m "Release version X.Y.Z - Brief description"
   git tag vX.Y.Z
   git push origin main --tags
   ```

## GitHub Pages Deployment

After pushing to the main branch, GitHub Pages will automatically deploy the updated version.

The toolkit is accessible at: `https://<username>.github.io/toolkit/`

## Version Display Locations

Each page displays its version in the footer:

- **Main Toolkit**: Bottom of landing page
- **Publisher**: Below the main container, above scripts
- **Logs Viewer**: After all UI elements
- **Image Renamer**: After all UI elements

All tool pages include a "Back to JetBeep Toolkit" link for easy navigation.

## Notes

- Version numbers are hardcoded in HTML files (no build process)
- Each tool can have independent version numbers if needed
- Main toolkit version typically matches the highest tool version
- Always update this VERSION.md when releasing

## Future Considerations

Consider implementing:
- Automated version injection during build/deploy
- Changelog generation from git commits
- Version API endpoint for programmatic access
- Automatic version checking in tools
