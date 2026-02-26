#!/usr/bin/env python3
"""Generate Baltic language character availability map for US2066 ROMs A, B, C.

Reads rom_{A,B,C}_characters.json and produces:
  - baltic_char_map.json  (structured availability + fallbacks)
  - baltic_char_map.csv   (flat table, UTF-8 BOM for Excel)
"""

import argparse
import csv
import json
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

BALTIC_CHARS = {
    "Estonian": "ÄäÖöÜüÕõŠšŽž",
    "Latvian": "ĀāČčĒēĢģĪīĶķĻļŅņŠšŪūŽž",
    "Lithuanian": "ĄąČčĘęĖėĮįŠšŲųŪūŽž",
}

ROM_IDS = ["A", "B", "C"]


def load_rom_reverse_lookup(json_path: Path) -> dict[str, str]:
    """Load a ROM JSON and return {unicode_char: hex_byte_code}."""
    data = json.loads(json_path.read_text(encoding="utf-8"))
    lookup: dict[str, str] = {}
    for entry in data.values():
        val = entry["rom_value"]
        if val in ("UNDEFINED", "UNMAPPED"):
            continue
        # First occurrence wins (some ROMs may have duplicates)
        if val not in lookup:
            lookup[val] = entry["hex"]
    return lookup


def get_base_letter(ch: str) -> str | None:
    """Extract the ASCII base letter via NFD decomposition."""
    decomposed = unicodedata.normalize("NFD", ch)
    if decomposed and decomposed[0].isascii() and decomposed[0].isalpha():
        return decomposed[0]
    return None


def compute_fallbacks(ch: str, rom_lookup: dict[str, str]) -> list[str]:
    """Compute ordered fallback list for a character missing from a ROM.

    1. ROM-aware: other chars in the ROM sharing the same base letter
    2. ASCII base letter (last resort)
    """
    base = get_base_letter(ch)
    if base is None:
        return []

    fallbacks: list[str] = []

    # ROM-aware: find chars in this ROM that share the same base letter
    for rom_char in rom_lookup:
        if rom_char == ch:
            continue
        rom_base = get_base_letter(rom_char)
        if rom_base and rom_base.lower() == base.lower():
            # Prefer same case first
            fallbacks.append(rom_char)

    # Sort: same case first, then opposite case
    is_upper = ch.isupper()
    fallbacks.sort(key=lambda c: (c.isupper() != is_upper, c))

    # ASCII base letter as last resort
    if base not in fallbacks:
        fallbacks.append(base)

    return fallbacks


def get_unicode_name(ch: str) -> str:
    """Get Unicode character name with fallback."""
    try:
        return unicodedata.name(ch)
    except ValueError:
        return f"UNNAMED (U+{ord(ch):04X})"


def main():
    parser = argparse.ArgumentParser(
        description="Generate Baltic character availability map for US2066 ROMs"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).parent,
        help="Output directory (default: script directory)",
    )
    args = parser.parse_args()

    script_dir = Path(__file__).parent
    output_dir: Path = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load ROM reverse lookups
    rom_lookups: dict[str, dict[str, str]] = {}
    for rom_id in ROM_IDS:
        json_path = script_dir / f"rom_{rom_id}_characters.json"
        if not json_path.exists():
            print(f"WARNING: {json_path} not found, skipping ROM {rom_id}")
            continue
        rom_lookups[rom_id] = load_rom_reverse_lookup(json_path)
        print(f"ROM {rom_id}: loaded {len(rom_lookups[rom_id])} mapped characters")

    # Collect all unique Baltic characters and their languages
    all_chars: dict[str, list[str]] = {}
    for lang, chars in BALTIC_CHARS.items():
        for ch in chars:
            all_chars.setdefault(ch, [])
            if lang not in all_chars[ch]:
                all_chars[ch].append(lang)

    # Build character entries
    characters: dict[str, dict] = {}
    for ch in sorted(all_chars, key=lambda c: (ord(c))):
        entry = {
            "unicode": f"U+{ord(ch):04X}",
            "name": get_unicode_name(ch),
            "languages": all_chars[ch],
        }
        for rom_id in ROM_IDS:
            rom_key = f"rom_{rom_id.lower()}"
            lookup = rom_lookups.get(rom_id, {})
            if ch in lookup:
                entry[rom_key] = {
                    "available": True,
                    "byte_code": lookup[ch],
                    "fallbacks": [],
                }
            else:
                entry[rom_key] = {
                    "available": False,
                    "byte_code": None,
                    "fallbacks": compute_fallbacks(ch, lookup),
                }
        characters[ch] = entry

    # Summary
    total = len(characters)
    summary = {"total_special_chars": total}
    coverage: dict[str, int] = {}
    for rom_id in ROM_IDS:
        rom_key = f"rom_{rom_id.lower()}"
        avail = sum(1 for e in characters.values() if e[rom_key]["available"])
        missing = total - avail
        summary[f"{rom_key}_coverage"] = {"available": avail, "missing": missing}
        coverage[rom_id] = avail

    best_rom = f"rom_{max(coverage, key=coverage.get).lower()}"
    summary["best_rom"] = best_rom

    # Build final JSON
    output = {
        "metadata": {
            "generated": datetime.now(timezone.utc).isoformat(),
            "description": "Baltic language character availability in US2066 ROMs",
        },
        "characters": characters,
        "summary": summary,
    }

    # Write JSON
    json_path = output_dir / "baltic_char_map.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\nWritten: {json_path}")

    # Write CSV (UTF-8 BOM)
    csv_path = output_dir / "baltic_char_map.csv"
    fieldnames = [
        "character", "unicode", "name", "languages",
        "rom_a_byte", "rom_b_byte", "rom_c_byte", "fallback",
    ]
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for ch, entry in characters.items():
            # Collect all unique fallbacks across ROMs
            all_fb = []
            for rom_id in ROM_IDS:
                rom_key = f"rom_{rom_id.lower()}"
                for fb in entry[rom_key]["fallbacks"]:
                    if fb not in all_fb:
                        all_fb.append(fb)
            writer.writerow({
                "character": ch,
                "unicode": entry["unicode"],
                "name": entry["name"],
                "languages": "; ".join(entry["languages"]),
                "rom_a_byte": entry["rom_a"]["byte_code"] or "",
                "rom_b_byte": entry["rom_b"]["byte_code"] or "",
                "rom_c_byte": entry["rom_c"]["byte_code"] or "",
                "fallback": ", ".join(all_fb),
            })
    print(f"Written: {csv_path}")

    # Print summary
    print(f"\n--- Summary ---")
    print(f"Total Baltic special characters: {total}")
    for rom_id in ROM_IDS:
        rom_key = f"rom_{rom_id.lower()}"
        cov = summary[f"{rom_key}_coverage"]
        print(f"  ROM {rom_id}: {cov['available']} available, {cov['missing']} missing")
    print(f"  Best ROM: {best_rom}")


if __name__ == "__main__":
    main()
