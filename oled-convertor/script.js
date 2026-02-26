class OledConvertor {
    constructor() {
        this.romData = { A: null, B: null, C: null };
        this.balticCharMap = null;
        this.reverseLookups = { A: null, B: null, C: null };
        this.customMappings = { A: {}, B: {}, C: {} };
        this.conversionResult = [];
        this.currentRom = 'A';
        this.fileName = null;
        this.modalCharIndex = -1;
        this.modalSelectedReplacement = null;

        this.loadCustomMappings();
        this.bindEvents();
        this.init();
    }

    async init() {
        try {
            const [romA, romB, romC, baltic] = await Promise.all([
                fetch('data/rom_A_characters.json').then(r => r.json()),
                fetch('data/rom_B_characters.json').then(r => r.json()),
                fetch('data/rom_C_characters.json').then(r => r.json()),
                fetch('data/baltic_char_map.json').then(r => r.json())
            ]);
            this.romData.A = romA;
            this.romData.B = romB;
            this.romData.C = romC;
            this.balticCharMap = baltic.characters;

            this.buildReverseLookup('A');
            this.buildReverseLookup('B');
            this.buildReverseLookup('C');

            document.getElementById('btnPreview').disabled = false;
        } catch (err) {
            console.error('Failed to load ROM data:', err);
            alert('Failed to load ROM character data. Please check that data files are present.');
        }
    }

    buildReverseLookup(romType) {
        const rom = this.romData[romType];
        // Map: unicodeChar -> ascii_value string
        const lookup = new Map();

        for (const [, entry] of Object.entries(rom)) {
            const rv = entry.rom_value;
            if (rv === 'UNDEFINED' || rv === 'UNMAPPED') continue;
            // Skip control characters in ascii_value
            if (entry.ascii_value.startsWith('CONTROL')) continue;
            // Map the rom_value character to its ascii_value replacement
            if (!lookup.has(rv)) {
                lookup.set(rv, entry.ascii_value);
            }
        }

        // Merge baltic_char_map entries where rom is available
        if (this.balticCharMap) {
            const romKey = `rom_${romType.toLowerCase()}`;
            for (const [char, info] of Object.entries(this.balticCharMap)) {
                const romInfo = info[romKey];
                if (romInfo && romInfo.available && romInfo.byte_code) {
                    // Resolve byte_code to ascii_value at that position
                    const asciiVal = this.getAsciiValueAtByte(romType, romInfo.byte_code);
                    if (asciiVal) {
                        lookup.set(char, asciiVal);
                    }
                }
            }
        }

        this.reverseLookups[romType] = lookup;
    }

    getAsciiValueAtByte(romType, byteCode) {
        // byteCode is like "0x5B" - convert to decimal, then to binary key
        const decimal = parseInt(byteCode, 16);
        const binary = decimal.toString(2).padStart(8, '0');
        const key = binary.slice(0, 4) + '_' + binary.slice(4);
        const entry = this.romData[romType][key];
        if (entry && !entry.ascii_value.startsWith('CONTROL')) {
            return entry.ascii_value;
        }
        return null;
    }

    getRomValueAtByte(romType, byteCode) {
        const decimal = parseInt(byteCode, 16);
        const binary = decimal.toString(2).padStart(8, '0');
        const key = binary.slice(0, 4) + '_' + binary.slice(4);
        const entry = this.romData[romType][key];
        if (entry) return entry.rom_value;
        return null;
    }

    getEntryAtDecimal(romType, decimal) {
        const binary = decimal.toString(2).padStart(8, '0');
        const key = binary.slice(0, 4) + '_' + binary.slice(4);
        return this.romData[romType][key] || null;
    }

    convertText(text, romType) {
        const lookup = this.reverseLookups[romType];
        const custom = this.customMappings[romType];
        const unmappedMode = document.getElementById('unmappedMode').value;
        const romKey = `rom_${romType.toLowerCase()}`;
        const result = [];

        for (const char of text) {
            const entry = { inputChar: char, replacementChar: null, status: 'unmapped', alternatives: [] };

            // Whitespace/newlines pass through
            if (char === '\n' || char === '\r' || char === '\t') {
                entry.replacementChar = char;
                entry.status = 'passthrough';
                result.push(entry);
                continue;
            }

            // 1. Check reverse lookup (rom_value -> ascii_value)
            if (lookup.has(char)) {
                entry.replacementChar = lookup.get(char);
                entry.status = 'mapped';
                result.push(entry);
                continue;
            }

            // 2. Check custom mappings
            if (custom[char]) {
                entry.replacementChar = custom[char];
                entry.status = 'custom';
                result.push(entry);
                continue;
            }

            // 3. Gather alternatives from baltic_char_map fallbacks
            if (this.balticCharMap && this.balticCharMap[char]) {
                const charInfo = this.balticCharMap[char];
                const romInfo = charInfo[romKey];
                if (romInfo && romInfo.fallbacks) {
                    for (const fb of romInfo.fallbacks) {
                        if (lookup.has(fb)) {
                            entry.alternatives.push({
                                displayChar: fb,
                                replacementChar: lookup.get(fb)
                            });
                        }
                    }
                }
            }

            // 4. Handle based on mode
            if (unmappedMode === 'auto' && entry.alternatives.length > 0) {
                entry.replacementChar = entry.alternatives[0].replacementChar;
                entry.status = 'auto-fallback';
            } else if (unmappedMode === 'replace') {
                entry.replacementChar = '?';
                entry.status = 'mapped';
            }
            // manual mode: leave as unmapped

            result.push(entry);
        }

        return result;
    }

    renderPreview() {
        const text = document.getElementById('inputText').value;
        if (!text) return;

        this.currentRom = document.querySelector('input[name="romType"]:checked').value;
        this.conversionResult = this.convertText(text, this.currentRom);

        const previewArea = document.getElementById('previewArea');
        const highlight = document.getElementById('highlightToggle').checked;
        previewArea.innerHTML = '';

        let mapped = 0, unmapped = 0, custom = 0, autoFallback = 0;

        this.conversionResult.forEach((entry, idx) => {
            if (entry.status === 'passthrough') {
                previewArea.appendChild(document.createTextNode(entry.inputChar));
                return;
            }

            const span = document.createElement('span');
            const displayChar = entry.replacementChar || entry.inputChar;
            span.textContent = displayChar;
            span.title = `Input: "${entry.inputChar}" (U+${entry.inputChar.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})`;

            if (highlight) {
                if (entry.status === 'mapped') {
                    span.className = 'char-mapped';
                    mapped++;
                } else if (entry.status === 'custom') {
                    span.className = 'char-custom';
                    custom++;
                } else if (entry.status === 'auto-fallback') {
                    span.className = 'char-auto-fallback';
                    autoFallback++;
                    span.title += ` — Auto-replaced: "${entry.inputChar}" → "${entry.replacementChar}" — Click to change`;
                    span.addEventListener('click', () => this.openCharacterModal(idx));
                } else {
                    span.className = 'char-unmapped';
                    unmapped++;
                    span.title += ' — Click to map';
                    span.addEventListener('click', () => this.openCharacterModal(idx));
                }
            } else {
                if (entry.status === 'mapped') mapped++;
                else if (entry.status === 'custom') custom++;
                else if (entry.status === 'auto-fallback') {
                    autoFallback++;
                    span.style.cursor = 'pointer';
                    span.addEventListener('click', () => this.openCharacterModal(idx));
                } else {
                    unmapped++;
                    span.style.cursor = 'pointer';
                    span.addEventListener('click', () => this.openCharacterModal(idx));
                }
            }

            if (entry.replacementChar) {
                span.title += ` → "${entry.replacementChar}"`;
            }

            previewArea.appendChild(span);
        });

        let statsText = `${mapped + custom} mapped`;
        if (autoFallback > 0) statsText += ` / ${autoFallback} auto-replaced`;
        if (unmapped > 0) statsText += ` / ${unmapped} unmapped`;
        if (custom > 0) statsText += ` (${custom} custom)`;
        document.getElementById('statsBar').textContent = statsText;

        document.getElementById('previewCard').style.display = '';
        document.getElementById('mappingsCard').style.display = '';
        document.getElementById('btnDownload').disabled = false;
        this.renderMappingsTable();
        this.renderUnmappedList();
    }

    renderUnmappedList() {
        const card = document.getElementById('unmappedCard');
        const container = document.getElementById('unmappedList');

        // Collect unique chars with status 'unmapped' or 'auto-fallback'
        const charMap = new Map(); // inputChar -> { entry, indices }
        this.conversionResult.forEach((entry, idx) => {
            if (entry.status !== 'unmapped' && entry.status !== 'auto-fallback') return;
            if (!charMap.has(entry.inputChar)) {
                charMap.set(entry.inputChar, { entry, indices: [idx] });
            } else {
                charMap.get(entry.inputChar).indices.push(idx);
            }
        });

        if (charMap.size === 0) {
            card.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        card.style.display = '';
        let html = '<table class="table table-sm"><thead><tr>' +
            '<th>Input</th><th>Unicode</th><th>Count</th><th>Current</th><th>Alternatives</th></tr></thead><tbody>';

        for (const [char, { entry, indices }] of charMap) {
            const cp = char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
            const current = entry.status === 'auto-fallback'
                ? `<span class="badge bg-warning text-dark">${this.escapeHtml(entry.replacementChar)} (auto)</span>`
                : '<span class="badge bg-danger">?</span>';

            let altButtons = '';
            if (entry.alternatives.length > 0) {
                entry.alternatives.forEach((alt, altIdx) => {
                    const isActive = entry.status === 'auto-fallback' && entry.replacementChar === alt.replacementChar;
                    const btnClass = isActive ? 'btn btn-warning btn-sm' : 'btn btn-outline-secondary btn-sm';
                    altButtons += `<button class="${btnClass} me-1 mb-1 font-monospace" ` +
                        `data-unmapped-char="${this.escapeAttr(char)}" ` +
                        `data-alt-idx="${altIdx}" ` +
                        `title="${this.escapeHtml(alt.displayChar)} → ${this.escapeHtml(alt.replacementChar)}"` +
                        `>${this.escapeHtml(alt.displayChar)}</button>`;
                });
            } else {
                altButtons = '<span class="text-muted small">None available</span>';
            }

            html += `<tr>
                <td class="font-monospace fs-5 unmapped-input-char" data-char-idx="${indices[0]}"
                    title="Click to open character mapping">${this.escapeHtml(char)}</td>
                <td class="text-muted small">U+${cp}</td>
                <td>${indices.length}</td>
                <td>${current}</td>
                <td>${altButtons}</td>
            </tr>`;
        }

        html += '</tbody></table>';
        container.innerHTML = html;

        // Bind click handlers for alternative buttons
        container.querySelectorAll('[data-unmapped-char]').forEach(btn => {
            btn.addEventListener('click', () => {
                const ch = btn.getAttribute('data-unmapped-char');
                const altIdx = parseInt(btn.getAttribute('data-alt-idx'));
                const { entry } = charMap.get(ch);
                const alt = entry.alternatives[altIdx];
                if (!alt) return;

                // Save as custom mapping and re-render
                this.customMappings[this.currentRom][ch] = alt.replacementChar;
                this.saveCustomMappings();
                this.renderPreview();
            });
        });

        // Bind click handlers for input character cells
        container.querySelectorAll('.unmapped-input-char').forEach(td => {
            td.addEventListener('click', () => {
                const idx = parseInt(td.getAttribute('data-char-idx'));
                this.openCharacterModal(idx);
            });
        });
    }

    openCharacterModal(charIndex) {
        this.modalCharIndex = charIndex;
        this.modalSelectedReplacement = null;
        const entry = this.conversionResult[charIndex];
        const char = entry.inputChar;
        const codePoint = char.codePointAt(0);

        document.getElementById('modalCharDisplay').textContent = `"${char}"`;
        document.getElementById('modalCharInfo').textContent =
            `Unicode: U+${codePoint.toString(16).toUpperCase().padStart(4, '0')} | ` +
            `Decimal: ${codePoint} | ROM: ${this.currentRom}`;

        // Suggestions
        const suggestionsList = document.getElementById('suggestionsList');
        suggestionsList.innerHTML = '';
        const suggestionsSection = document.getElementById('suggestionsSection');

        if (entry.alternatives.length > 0) {
            suggestionsSection.style.display = '';
            entry.alternatives.forEach(alt => {
                const btn = document.createElement('button');
                btn.className = 'btn btn-outline-secondary suggestion-btn';
                btn.textContent = alt.displayChar;
                btn.title = `"${alt.displayChar}" → byte output: "${alt.replacementChar}"`;
                btn.addEventListener('click', () => {
                    this.selectModalReplacement(alt.replacementChar, btn);
                });
                suggestionsList.appendChild(btn);
            });
        } else {
            suggestionsSection.style.display = 'none';
        }

        // ROM Grid
        this.renderRomGrid();

        // Reset direct input
        document.getElementById('directInput').value = '';
        document.getElementById('btnApplyMapping').disabled = true;

        const modal = new bootstrap.Modal(document.getElementById('charModal'));
        modal.show();
    }

    renderRomGrid() {
        const grid = document.getElementById('romGrid');
        grid.innerHTML = '';

        // Header row with column indices
        const cornerCell = document.createElement('div');
        cornerCell.className = 'rom-grid-cell rom-grid-header';
        cornerCell.textContent = '';
        grid.style.gridTemplateColumns = 'auto repeat(16, 1fr)';
        grid.appendChild(cornerCell);

        for (let col = 0; col < 16; col++) {
            const header = document.createElement('div');
            header.className = 'rom-grid-cell rom-grid-header';
            header.textContent = col.toString(16).toUpperCase();
            grid.appendChild(header);
        }

        for (let row = 0; row < 16; row++) {
            // Row header
            const rowHeader = document.createElement('div');
            rowHeader.className = 'rom-grid-cell rom-grid-header';
            rowHeader.textContent = row.toString(16).toUpperCase() + 'x';
            grid.appendChild(rowHeader);

            for (let col = 0; col < 16; col++) {
                const decimal = row * 16 + col;
                const entry = this.getEntryAtDecimal(this.currentRom, decimal);
                const cell = document.createElement('div');
                cell.className = 'rom-grid-cell';

                if (!entry || entry.rom_value === 'UNDEFINED' || entry.rom_value === 'UNMAPPED' ||
                    entry.ascii_value.startsWith('CONTROL')) {
                    cell.className += ' undefined';
                    cell.textContent = '·';
                    cell.title = `0x${decimal.toString(16).toUpperCase().padStart(2, '0')} — ${entry ? entry.rom_value : 'N/A'}`;
                } else {
                    cell.textContent = entry.rom_value;
                    cell.title = `ROM: "${entry.rom_value}" → Output: "${entry.ascii_value}" (0x${entry.hex.slice(2).toUpperCase()})`;
                    cell.addEventListener('click', () => {
                        this.selectModalReplacement(entry.ascii_value, cell);
                    });
                }

                grid.appendChild(cell);
            }
        }
    }

    selectModalReplacement(replacement, element) {
        this.modalSelectedReplacement = replacement;
        document.getElementById('btnApplyMapping').disabled = false;

        // Clear previous selections
        document.querySelectorAll('.rom-grid-cell.selected, .suggestion-btn.selected').forEach(el => {
            el.classList.remove('selected');
        });
        if (element) element.classList.add('selected');
    }

    applyModalMapping() {
        if (this.modalSelectedReplacement === null || this.modalCharIndex < 0) return;

        const entry = this.conversionResult[this.modalCharIndex];
        const inputChar = entry.inputChar;
        const replacement = this.modalSelectedReplacement;

        // Save if checkbox checked
        if (document.getElementById('saveMapping').checked) {
            this.customMappings[this.currentRom][inputChar] = replacement;
            this.saveCustomMappings();
        }

        // Close modal and re-render
        bootstrap.Modal.getInstance(document.getElementById('charModal')).hide();
        this.renderPreview();
    }

    renderMappingsTable() {
        const container = document.getElementById('mappingsTable');
        const noMappings = document.getElementById('noMappings');
        const mappings = this.customMappings[this.currentRom];
        const keys = Object.keys(mappings);

        if (keys.length === 0) {
            container.innerHTML = '';
            noMappings.style.display = '';
            return;
        }

        noMappings.style.display = 'none';
        let html = '<table class="table table-sm mappings-table"><thead><tr>' +
            '<th>Input</th><th>Unicode</th><th>Output (ascii_value)</th><th></th></tr></thead><tbody>';

        for (const char of keys) {
            const cp = char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
            html += `<tr>
                <td>${this.escapeHtml(char)}</td>
                <td>U+${cp}</td>
                <td>${this.escapeHtml(mappings[char])}</td>
                <td><button class="btn btn-outline-danger btn-sm py-0" data-delete-char="${this.escapeAttr(char)}">×</button></td>
            </tr>`;
        }

        html += '</tbody></table>';
        container.innerHTML = html;

        container.querySelectorAll('[data-delete-char]').forEach(btn => {
            btn.addEventListener('click', () => {
                const ch = btn.getAttribute('data-delete-char');
                delete this.customMappings[this.currentRom][ch];
                this.saveCustomMappings();
                this.renderPreview();
            });
        });
    }

    downloadConverted() {
        if (!this.conversionResult.length) return;

        const outputChars = this.conversionResult.map(e => {
            if (e.status === 'passthrough') return e.inputChar;
            return e.replacementChar || '?';
        });

        const outputStr = outputChars.join('');

        // Encode as ISO-8859-1 (Latin-1) byte array
        const bytes = new Uint8Array(outputStr.length);
        for (let i = 0; i < outputStr.length; i++) {
            const code = outputStr.charCodeAt(i);
            bytes[i] = code <= 0xFF ? code : 0x3F; // '?' for out of range
        }

        const blob = new Blob([bytes], { type: 'application/octet-stream' });
        const baseName = this.fileName
            ? this.fileName.replace(/\.[^.]+$/, '')
            : 'converted';
        const downloadName = `${baseName}_rom${this.currentRom}.txt`;

        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = downloadName;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    loadCustomMappings() {
        try {
            const stored = localStorage.getItem('oledConvertor_customMappings');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.A) this.customMappings.A = parsed.A;
                if (parsed.B) this.customMappings.B = parsed.B;
                if (parsed.C) this.customMappings.C = parsed.C;
            }
        } catch (e) {
            console.warn('Failed to load custom mappings:', e);
        }
    }

    saveCustomMappings() {
        localStorage.setItem('oledConvertor_customMappings', JSON.stringify(this.customMappings));
    }

    exportMappings() {
        const json = JSON.stringify(this.customMappings, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'oled_custom_mappings.json';
        a.click();
        URL.revokeObjectURL(a.href);
    }

    importMappings(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                if (parsed.A) Object.assign(this.customMappings.A, parsed.A);
                if (parsed.B) Object.assign(this.customMappings.B, parsed.B);
                if (parsed.C) Object.assign(this.customMappings.C, parsed.C);
                this.saveCustomMappings();
                if (this.conversionResult.length) this.renderPreview();
                alert('Mappings imported successfully.');
            } catch (err) {
                alert('Failed to import mappings: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    escapeAttr(str) {
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    }

    loadFile(file) {
        this.fileName = file.name;
        document.getElementById('fileName').textContent = file.name;
        const reader = new FileReader();
        reader.onload = (ev) => {
            document.getElementById('inputText').value = ev.target.result;
        };
        reader.readAsText(file);
    }

    bindEvents() {
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');

        // Click drop zone to open file picker
        dropZone.addEventListener('click', () => fileInput.click());

        // Drag-and-drop events
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) this.loadFile(file);
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.loadFile(file);
        });

        // Preview button
        document.getElementById('btnPreview').addEventListener('click', () => this.renderPreview());

        // Download button
        document.getElementById('btnDownload').addEventListener('click', () => this.downloadConverted());

        // Highlight toggle
        document.getElementById('highlightToggle').addEventListener('change', () => {
            if (this.conversionResult.length) this.renderPreview();
        });

        // ROM type change
        document.querySelectorAll('input[name="romType"]').forEach(radio => {
            radio.addEventListener('change', () => {
                if (this.conversionResult.length) this.renderPreview();
            });
        });

        // Unmapped mode change
        document.getElementById('unmappedMode').addEventListener('change', () => {
            if (this.conversionResult.length) this.renderPreview();
        });

        // Modal apply button
        document.getElementById('btnApplyMapping').addEventListener('click', () => this.applyModalMapping());

        // Direct input in modal
        document.getElementById('btnApplyDirect').addEventListener('click', () => {
            const val = document.getElementById('directInput').value;
            if (val) {
                // Check if this character exists in the reverse lookup
                const lookup = this.reverseLookups[this.currentRom];
                if (lookup.has(val)) {
                    this.selectModalReplacement(lookup.get(val), null);
                } else {
                    // Use the character directly as replacement
                    this.selectModalReplacement(val, null);
                }
                this.applyModalMapping();
            }
        });

        // Clear mappings
        document.getElementById('btnClearMappings').addEventListener('click', () => {
            if (confirm(`Clear all custom mappings for ROM ${this.currentRom}?`)) {
                this.customMappings[this.currentRom] = {};
                this.saveCustomMappings();
                if (this.conversionResult.length) this.renderPreview();
            }
        });

        // Export/Import mappings
        document.getElementById('btnExportMappings').addEventListener('click', () => this.exportMappings());
        document.getElementById('importMappings').addEventListener('change', (e) => {
            if (e.target.files[0]) this.importMappings(e.target.files[0]);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.oledConvertor = new OledConvertor();
});
