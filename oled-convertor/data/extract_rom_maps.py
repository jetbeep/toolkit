#!/usr/bin/env python3
"""Extract US2066 ROM character mappings from CGRomCharacters.cs to JSON + CSV."""

import argparse
import csv
import json
import re
import unicodedata
from pathlib import Path

# Path to the C# source file
CS_SOURCE = Path(__file__).parent / (
    "Smdn.Devices.US2066-main/src/Smdn.Devices.US2066/"
    "Smdn.Devices.US2066/encodings/CGRomCharacters.cs"
)

# Path to bitmap files
BITMAP_DIR = Path(__file__).parent / "Smdn.Devices.US2066-main/misc/cgrom-bitmap"

# Sentinel values from the C# source
C_UNDEF = "\uF800"
C_UNMAP = "\uE200"

# Manual bitmap-identified mappings for ROM B characters that have unique glyphs
# not shared with ROM A or C (so bitmap cross-reference can't resolve them).
ROM_B_MANUAL_MAPPINGS = {
    # Special graphic characters
    0x18: '\u25C7',  # ◇ WHITE DIAMOND
    0x19: '\u2016',  # ‖ DOUBLE VERTICAL LINE (approximate)

    # Central European accented (0xA0-0xAF)
    0xA0: '\u00C4',  # Ä (diaeresis + A, duplicate of 0xC4)
    0xA1: '\u0104',  # Ą LATIN CAPITAL LETTER A WITH OGONEK
    0xA2: '\u0106',  # Ć LATIN CAPITAL LETTER C WITH ACUTE
    0xA4: '\u010E',  # Ď LATIN CAPITAL LETTER D WITH CARON
    0xA5: '\u011A',  # Ě LATIN CAPITAL LETTER E WITH CARON
    0xA6: '\u0119',  # ę LATIN SMALL LETTER E WITH OGONEK
    0xA7: '\u011E',  # Ğ LATIN CAPITAL LETTER G WITH BREVE
    0xA9: '\u0131',  # ı LATIN SMALL LETTER DOTLESS I
    0xAB: '\u013E',  # ľ LATIN SMALL LETTER L WITH CARON
    0xAC: '\u0143',  # Ń LATIN CAPITAL LETTER N WITH ACUTE
    0xAD: '\u0147',  # Ň LATIN CAPITAL LETTER N WITH CARON
    0xAE: '\u0150',  # Ő LATIN CAPITAL LETTER O WITH DOUBLE ACUTE
    0xAF: '\u0158',  # Ř LATIN CAPITAL LETTER R WITH CARON

    # Central European continued (0xB0-0xB9)
    0xB0: '\u015A',  # Ś LATIN CAPITAL LETTER S WITH ACUTE
    0xB1: '\u015E',  # Ş LATIN CAPITAL LETTER S WITH CEDILLA
    0xB2: '\u015F',  # ş LATIN SMALL LETTER S WITH CEDILLA
    0xB4: '\u0162',  # Ţ LATIN CAPITAL LETTER T WITH CEDILLA
    0xB5: '\u0164',  # Ť LATIN CAPITAL LETTER T WITH CARON
    0xB7: '\u0170',  # Ű LATIN CAPITAL LETTER U WITH DOUBLE ACUTE
    0xB8: '\u0179',  # Ź LATIN CAPITAL LETTER Z WITH ACUTE
    0xB9: '\u017B',  # Ż LATIN CAPITAL LETTER Z WITH DOT ABOVE

    # Latin-1 Supplement uppercase (0xC0-0xDE)
    0xC0: '\u00C0',  # À
    0xC2: '\u00C2',  # Â
    0xC3: '\u00C3',  # Ã
    0xC6: '\u00C6',  # Æ
    0xC7: '\u00C7',  # Ç
    0xCB: '\u00CB',  # Ë
    0xCC: '\u00CC',  # Ì
    0xCE: '\u00CE',  # Î
    0xCF: '\u00CF',  # Ï
    0xD0: '\u00D0',  # Ð
    0xD1: '\u00D1',  # Ñ
    0xD5: '\u00D5',  # Õ
    0xD9: '\u00D9',  # Ù
    0xDB: '\u00DB',  # Û
    0xDE: '\u00DE',  # Þ

    # Latin-1 Supplement lowercase (0xE3-0xFE)
    0xE3: '\u00E3',  # ã
    0xE6: '\u00E6',  # æ
    0xE7: '\u00E7',  # ç
    0xF0: '\u00F0',  # ð
    0xF1: '\u00F1',  # ñ
    0xF5: '\u00F5',  # õ
    0xFE: '\u00FE',  # þ
}


def tokenize_row(row_content: str) -> list[str]:
    """Tokenize a C# array row, handling edge cases like ',' and '\\' and /*!*/ comments."""
    tokens = []
    i = 0
    s = row_content.strip()
    if s.startswith("{"):
        s = s[1:]
    if s.endswith("}"):
        s = s[:-1]
    s = s.strip()

    while i < len(s):
        # Skip whitespace
        if s[i] in " \t\n\r":
            i += 1
            continue
        # Skip commas between tokens
        if s[i] == ",":
            i += 1
            continue
        # Skip inline comments /*!*/
        if s[i:i+2] == "/*":
            end = s.index("*/", i)
            i = end + 2
            continue
        # Identifier (c_undef, c_unmap)
        if s[i].isalpha() or s[i] == "_":
            j = i
            while j < len(s) and (s[j].isalnum() or s[j] == "_"):
                j += 1
            tokens.append(s[i:j])
            i = j
            continue
        # Character literal
        if s[i] == "'":
            # Find the character inside the quotes
            i += 1  # skip opening quote
            if s[i] == "\\":
                # Escaped character
                esc = s[i + 1]
                if esc == "'":
                    ch = "'"
                elif esc == "\\":
                    ch = "\\"
                elif esc == "u":
                    # Unicode escape \uXXXX
                    hex_str = s[i + 2 : i + 6]
                    ch = chr(int(hex_str, 16))
                    i += 6  # past the hex digits
                    i += 1  # skip closing quote
                    tokens.append(ch)
                    continue
                else:
                    ch = esc
                i += 2  # past backslash + escaped char
            else:
                ch = s[i]
                i += 1
            i += 1  # skip closing quote
            tokens.append(ch)
            continue
        # Skip anything else
        i += 1

    return tokens


def parse_rom_map(lines: list[str]) -> dict[int, str]:
    """Parse a 16x16 ROM character map from C# source lines.

    Returns dict mapping byte_code -> character string.
    """
    char_map = {}

    for line in lines:
        # Match rows like: new[] /* 0x_0 */ { ... }
        m = re.match(r".*?/\*\s*0x_([0-9A-Fa-f])\s*\*/\s*\{(.*)\}", line)
        if not m:
            continue
        lo = int(m.group(1), 16)
        row_content = m.group(2)
        tokens = tokenize_row(row_content)

        if len(tokens) != 16:
            raise ValueError(
                f"Expected 16 tokens for row 0x_{lo:X}, got {len(tokens)}: {tokens}"
            )

        for hi, token in enumerate(tokens):
            byte_code = (hi << 4) | lo
            if token == "c_undef":
                char_map[byte_code] = C_UNDEF
            elif token == "c_unmap":
                char_map[byte_code] = C_UNMAP
            else:
                char_map[byte_code] = token

    return char_map


def parse_bitmap_file(filepath: Path) -> dict[int, tuple[int, ...]]:
    """Parse a CGRomBitmap.X.cs file, returning byte_code -> tuple of 8 ints."""
    text = filepath.read_text(encoding="utf-8")
    bitmaps = {}

    # Match each entry: comment with byte code, then 8 binary literals
    entry_pattern = re.compile(
        r"// 0x([0-9A-Fa-f]{2}) \(0b_\d{4}_\d{4}\)\s*\n"
        r"\s*new byte\[8\] \{\s*\n"
        r"((?:\s*0b_\d{5},\s*//.*\n){8})"
        r"\s*\}",
    )

    for m in entry_pattern.finditer(text):
        byte_code = int(m.group(1), 16)
        row_block = m.group(2)
        values = []
        for row_m in re.finditer(r"0b_(\d{5})", row_block):
            values.append(int(row_m.group(1), 2))
        if len(values) == 8:
            bitmaps[byte_code] = tuple(values)

    return bitmaps


def render_bitmap_ascii(pattern, on='#', off='.'):
    """Render a 5x8 bitmap pattern as ASCII art for visual verification."""
    lines = []
    for row_val in pattern:
        line = ''
        for bit in range(4, -1, -1):
            line += on if (row_val >> bit) & 1 else off
        lines.append(line)
    return '\n'.join(lines)


def apply_manual_mappings(rom_map, manual_map):
    """Apply manually identified bitmap-to-character mappings for a ROM.

    Only overwrites entries currently marked as C_UNMAP.
    Returns updated rom_map and count of applied mappings.
    """
    applied = 0
    updated = dict(rom_map)
    for byte_code, char in manual_map.items():
        if updated.get(byte_code) == C_UNMAP:
            updated[byte_code] = char
            applied += 1
    return updated, applied


def build_bitmap_lookup(
    rom_maps: dict[str, dict[int, str]],
    bitmap_files: dict[str, dict[int, tuple[int, ...]]],
) -> dict[tuple[int, ...], str]:
    """Build a lookup from bitmap pattern -> Unicode char using all mapped positions."""
    lookup: dict[tuple[int, ...], str] = {}

    for rom_id in ["A", "B", "C"]:
        char_map = rom_maps.get(rom_id, {})
        bitmaps = bitmap_files.get(rom_id, {})

        for byte_code, char in char_map.items():
            # Only use mapped (real) characters
            if char == C_UNDEF or char == C_UNMAP:
                continue
            if byte_code in bitmaps:
                pattern = bitmaps[byte_code]
                # Skip all-zero patterns
                if any(v != 0 for v in pattern):
                    # First mapping wins (avoid overwriting)
                    if pattern not in lookup:
                        lookup[pattern] = char

    return lookup


def resolve_unmapped(
    rom_map: dict[int, str],
    bitmaps: dict[int, tuple[int, ...]],
    bitmap_lookup: dict[tuple[int, ...], str],
) -> tuple[dict[int, str], int]:
    """Resolve unmapped characters by cross-referencing bitmap patterns.

    Returns updated rom_map and count of resolved entries.
    """
    resolved_count = 0
    updated = dict(rom_map)

    for byte_code, char in rom_map.items():
        if char != C_UNMAP:
            continue
        if byte_code not in bitmaps:
            continue
        pattern = bitmaps[byte_code]
        # Skip all-zero bitmaps (truly empty)
        if all(v == 0 for v in pattern):
            continue
        if pattern in bitmap_lookup:
            updated[byte_code] = bitmap_lookup[pattern]
            resolved_count += 1

    return updated, resolved_count


def get_unicode_name(ch: str) -> str:
    """Get the Unicode name for a character, with fallback."""
    try:
        return unicodedata.name(ch)
    except ValueError:
        code = ord(ch)
        if code < 0x20:
            return f"CONTROL CHARACTER (U+{code:04X})"
        return f"UNNAMED (U+{code:04X})"


def build_records(rom_map: dict[int, str]) -> dict[str, dict]:
    """Build output records for a ROM map."""
    records = {}
    for byte_code in range(256):
        hex_str = f"0x{byte_code:02X}"
        binary_str = f"{byte_code:08b}"
        binary_str = f"{binary_str[:4]}_{binary_str[4:]}"

        rom_char = rom_map.get(byte_code, C_UNDEF)
        ascii_char = chr(byte_code)  # ISO 8859-1 / Latin-1

        # ROM value
        if rom_char == C_UNDEF:
            rom_value = "UNDEFINED"
            rom_name = "UNDEFINED"
        elif rom_char == C_UNMAP:
            rom_value = "UNMAPPED"
            rom_name = "UNMAPPED"
        else:
            rom_value = rom_char
            rom_name = get_unicode_name(rom_char)

        # ASCII/Latin-1 value
        if byte_code < 0x20 or (0x7F <= byte_code <= 0x9F):
            ascii_value = f"CONTROL (U+{byte_code:04X})"
            ascii_name = f"CONTROL CHARACTER (U+{byte_code:04X})"
        else:
            ascii_value = ascii_char
            ascii_name = get_unicode_name(ascii_char)

        records[binary_str] = {
            "hex": hex_str,
            "binary": binary_str,
            "decimal": byte_code,
            "rom_value": rom_value,
            "ascii_value": ascii_value,
            "rom_unicode_name": rom_name,
            "ascii_unicode_name": ascii_name,
        }

    return records


def write_outputs(rom_name: str, records: dict[str, dict], output_dir: Path):
    """Write JSON and CSV output files."""
    json_path = output_dir / f"rom_{rom_name}_characters.json"
    csv_path = output_dir / f"rom_{rom_name}_characters.csv"

    # JSON
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    print(f"  Written: {json_path}")

    # CSV with UTF-8 BOM for Excel compatibility
    fieldnames = [
        "hex", "binary", "decimal",
        "rom_value", "ascii_value",
        "rom_unicode_name", "ascii_unicode_name",
    ]
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for rec in records.values():
            writer.writerow(rec)
    print(f"  Written: {csv_path}")


def write_grid_csv(rom_name: str, rom_map: dict[int, str], output_dir: Path):
    """Write a 16x16 grid CSV matching the datasheet ROM table layout."""
    csv_path = output_dir / f"rom_{rom_name}_grid.csv"
    col_headers = [f"{hi:04b}" for hi in range(16)]
    header_row = ["b3-b0 \\ b7-b4"] + col_headers

    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header_row)
        for lo in range(16):
            row = [f"{lo:04b}"]
            for hi in range(16):
                byte_code = (hi << 4) | lo
                ch = rom_map.get(byte_code, C_UNDEF)
                if ch == C_UNDEF or ch == C_UNMAP:
                    row.append("")
                else:
                    row.append(ch)
            writer.writerow(row)
    print(f"  Written: {csv_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Extract US2066 ROM character mappings to JSON + CSV"
    )
    parser.add_argument(
        "--verify-bitmaps",
        action="store_true",
        help="Print ASCII art of each manually-mapped ROM B character for visual verification",
    )
    args = parser.parse_args()

    source = CS_SOURCE.read_text(encoding="utf-8")
    lines = source.splitlines()

    # Extract ROM sections by finding CharacterMapRom* declarations
    rom_sections = {}
    rom_pattern = re.compile(r"CharacterMapRom([ABC])\s*=")

    i = 0
    while i < len(lines):
        m = rom_pattern.search(lines[i])
        if m:
            rom_id = m.group(1)
            # Collect lines until closing ");
            section_lines = []
            while i < len(lines):
                section_lines.append(lines[i])
                if lines[i].strip().startswith(");"):
                    break
                i += 1
            rom_sections[rom_id] = section_lines
        i += 1

    # Parse character maps from CGRomCharacters.cs
    rom_maps = {}
    for rom_id in ["A", "B", "C"]:
        if rom_id in rom_sections:
            rom_maps[rom_id] = parse_rom_map(rom_sections[rom_id])

    # Parse bitmap files
    bitmap_files = {}
    for rom_id in ["A", "B", "C"]:
        bitmap_path = BITMAP_DIR / f"CGRomBitmap.{rom_id}.cs"
        if bitmap_path.exists():
            bitmap_files[rom_id] = parse_bitmap_file(bitmap_path)
            print(f"Parsed {len(bitmap_files[rom_id])} bitmap entries from {bitmap_path.name}")

    # Build cross-reference lookup from all mapped characters
    bitmap_lookup = build_bitmap_lookup(rom_maps, bitmap_files)
    print(f"Built bitmap lookup with {len(bitmap_lookup)} unique patterns")

    # Resolve unmapped characters for each ROM
    for rom_id in ["A", "B", "C"]:
        if rom_id in rom_maps and rom_id in bitmap_files:
            rom_maps[rom_id], resolved = resolve_unmapped(
                rom_maps[rom_id], bitmap_files[rom_id], bitmap_lookup
            )
            if resolved > 0:
                print(f"ROM {rom_id}: resolved {resolved} UNMAPPED entries via bitmap cross-reference")

    # Apply manual bitmap-identified mappings for ROM B
    if "B" in rom_maps:
        rom_maps["B"], manual_count = apply_manual_mappings(
            rom_maps["B"], ROM_B_MANUAL_MAPPINGS
        )
        if manual_count > 0:
            print(f"ROM B: applied {manual_count} manual bitmap-identified mappings")

    # Verify bitmaps if requested
    if args.verify_bitmaps and "B" in bitmap_files:
        print("\n--- ROM B Manual Mapping Verification ---")
        for byte_code in sorted(ROM_B_MANUAL_MAPPINGS):
            char = ROM_B_MANUAL_MAPPINGS[byte_code]
            name = get_unicode_name(char)
            print(f"\n0x{byte_code:02X} -> '{char}' {name}")
            if byte_code in bitmap_files["B"]:
                print(render_bitmap_ascii(bitmap_files["B"][byte_code]))
            else:
                print("  (no bitmap data)")
        print("\n--- End Verification ---\n")

    output_dir = Path(__file__).parent

    for rom_id in ["A", "B", "C"]:
        if rom_id not in rom_maps:
            print(f"WARNING: ROM {rom_id} not found in source!")
            continue

        print(f"Processing ROM {rom_id}...")
        records = build_records(rom_maps[rom_id])
        write_outputs(rom_id, records, output_dir)
        write_grid_csv(rom_id, rom_maps[rom_id], output_dir)

    # Quick verification
    print("\n--- Verification ---")
    for rom_id in ["A", "B", "C"]:
        json_path = output_dir / f"rom_{rom_id}_characters.json"
        data = json.loads(json_path.read_text(encoding="utf-8"))
        print(f"ROM {rom_id}: {len(data)} entries")

        # Count UNMAPPED entries
        unmapped = sum(1 for r in data.values() if r["rom_value"] == "UNMAPPED")
        print(f"  UNMAPPED remaining: {unmapped}")

        # Check 0xA3 (binary key: 1010_0011)
        key_a3 = "1010_0011"
        if key_a3 in data:
            r = data[key_a3]
            print(f"  0xA3: rom='{r['rom_value']}' ({r['rom_unicode_name']}), "
                  f"ascii='{r['ascii_value']}' ({r['ascii_unicode_name']})")
        # Spot-check standard ASCII 'A' = 0x41 (binary key: 0100_0001)
        key_41 = "0100_0001"
        if key_41 in data:
            r = data[key_41]
            print(f"  0x41: rom='{r['rom_value']}', ascii='{r['ascii_value']}'")

    # Verify keys are binary format
    sample_path = output_dir / "rom_A_characters.json"
    sample_data = json.loads(sample_path.read_text(encoding="utf-8"))
    first_key = next(iter(sample_data))
    print(f"\nFirst JSON key format: '{first_key}' (expected binary like '0000_0000')")


if __name__ == "__main__":
    main()
