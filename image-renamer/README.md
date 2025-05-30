

# Image Renamer – README

## Overview

**Image Renamer** is a privacy-safe, 100% browser-based tool for mapping and renaming images between multiple archives and a set of original (reference) images.  
It’s especially useful for batch-renaming extracted images from ZIP files by visually matching them to original/reference images—even if file names or orders don’t match.

---

## Features

- **Upload Multiple ZIP Archives:**  
  Supports uploading up to 6 archives, each containing multiple images (JPG, PNG).
- **Upload Reference Images:**  
  Supports uploading originals as individual image files or as a single ZIP archive.
- **Drag & Drop or File Picker:**  
  Both archives and originals can be added by drag & drop or file picker.
- **Automatic Visual Matching:**  
  Uses perceptual hashing in the browser to visually match images, not just by file name.
- **Filename Pre-Filtering (Optional):**  
  Boosts accuracy and speed by filtering potential matches using filename similarity.
- **Manual Override:**  
  For each original image, the top 5 visually closest matches are shown. You can manually select the correct match from a dropdown.
- **Preview Panel:**  
  Shows each original image, its top matches (with distance/confidence), and thumbnails for side-by-side review before renaming.
- **Robust Error Handling:**  
  Unmatched images are clearly indicated and will not cause any app crash.
- **Download Renamed Archives:**  
  After matching, you can download each archive as a ZIP with the matched images renamed to the original filenames.
- **Download Mapping as CSV:**  
  Get a complete mapping (old name, new name, archive, match distance) as a CSV for records or further processing.
- **Logging Panel:**  
  See step-by-step progress, including success messages when files are loaded, hashing and matching status, and download confirmations.
- **Runs 100% Client-Side:**  
  No files are uploaded to a server; all processing and matching are done in your browser for privacy and speed.

---

## How to Use

1. **Open `image-renamer.html` in Chrome, Firefox, or Edge.**
2. **Upload Archives:**  
   - Drag & drop up to 6 ZIP files (each should contain the images you want to rename).
3. **Upload Originals:**  
   - Drag & drop original reference images, either as individual files or as a ZIP archive.
4. **Click "Start Mapping":**  
   - Wait while the app hashes and matches images.
   - Review the preview panel: see each original’s best matches, change matches manually if needed.
5. **Download Results:**  
   - Download each archive as a new ZIP (images inside renamed to match your originals).
   - Download a CSV mapping file with all matches and match distances.
6. **Check the Log:**  
   - The log panel at the bottom shows progress and any issues for transparency.

---

## Requirements

- **Modern Browser:**  
  Chrome, Firefox, or Edge recommended.
- **No installation required:**  
  Just open the HTML file. No server or backend needed.

---

## Limitations

- Works best for image archives where contents visually match the provided originals.
- Unmatched images will be shown in the preview/log and omitted from renamed archives.

---

## FAQ

**Q: Will my files ever leave my computer?**  
A: No. Everything runs locally in your browser.

**Q: What image formats are supported?**  
A: JPG and PNG.

**Q: What if the app can’t find a match for some images?**  
A: Unmatched originals are shown as "No matches found" in the preview and log. They are not renamed in the archive export, and are marked as such in the CSV.

---

## Credits

- [JSZip](https://stuk.github.io/jszip/) for ZIP file handling
- [blockhash.js](https://github.com/commonsmachinery/blockhash-js) for perceptual image hashing

---

If you need more help or want to add features, just ask!