// Parse custom timestamp
function parseCustomTimestamp(line) {
    const match = line.match(/(\d+)d\s+(\d{2}):(\d{2}):(\d{2})\s+(\d+)\.(\d+)/);
    if (!match) return null;

    const [, days, hours, minutes, seconds, milliseconds, nanoseconds] = match.map(Number);

    const daysMs = days * 86400000;
    const hoursMs = hours * 3600000;
    const minutesMs = minutes * 60000;
    const secondsMs = seconds * 1000;
    const nanosecondsMs = nanoseconds / 1000000;

    return daysMs + hoursMs + minutesMs + secondsMs + milliseconds + nanosecondsMs;
}


// Determine log type
function getLogType(line) {
    if (line.includes('asp_script_print')) return 'asp_script_print';
    if (line.includes('asp_script_rw_data')) return 'asp_script_rw_data';
    if (line.includes('jb_modem')) return 'jb_modem';
    return 'default';
}

document.addEventListener('DOMContentLoaded', () => {
    updateSummary(); // Populate the summary before the UI is displayed
    setupClipboardPaste(); // Add clipboard paste functionality
});

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

// Function to process the file
function processFile(file) {
const reader = new FileReader();
reader.onload = function (event) {
    const logContent = event.target.result;
    processLogs(logContent);
};
reader.readAsText(file);
}

let previousTimestamp = null;
let lastTypeTimestamps = {}; // Object to track last timestamp per log type


// Process logs and ensure click listeners are added
function processLogs(content) {
    selectedLogs.length = 0; // Ensure selectedLogs is cleared
    const lines = content.split('\n'); // Split file into lines
    const tableBody = document.getElementById('logTable').querySelector('tbody');
    tableBody.innerHTML = ''; // Clear old rows

    let previousTimestamp = null; // Track overall previous timestamp
    const lastTypeTimestamps = {}; // Track previous timestamps by log type

    lines.forEach((line) => {
        const currentTime = parseCustomTimestamp(line); // Parse timestamp
        const logType = getLogType(line); // Parse log type

        if (currentTime !== null) {
            // Calculate time differences
            let diffFromPreviousLog = previousTimestamp !== null ? Math.round(currentTime - previousTimestamp) : 0;
            let diffFromPreviousTypeLog = lastTypeTimestamps[logType] !== undefined
                ? Math.round(currentTime - lastTypeTimestamps[logType])
                : 0;

            // Update previous timestamps
            previousTimestamp = currentTime;
            lastTypeTimestamps[logType] = currentTime;

            // Construct the log object
            const log = {
                time: currentTime,
                logType: logType,
                entry: line,
                diffFromPreviousLog: diffFromPreviousLog,
                diffFromPreviousTypeLog: diffFromPreviousTypeLog,
            };
            // selectedLogs.push(log); // Add parsed log to the selectedLogs array

            // Add log to the table
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="${getTimeDiffColor(diffFromPreviousLog)}" data-time="${currentTime}">
                    <span style="text-decoration: underline; cursor: pointer;">
                        ${diffFromPreviousLog} ms
                    </span>
                </td>
                <td style="${getTimeDiffColor(diffFromPreviousTypeLog)}" data-time="${currentTime}">
                    <span style="text-decoration: underline; cursor: pointer;">
                        ${diffFromPreviousTypeLog} ms
                    </span>
                </td>
                <td class="${logType}">
                    <span style="text-decoration: underline; cursor: pointer;">
                        ${logType}
                    </span>
                </td>
                <td>${line}</td>
            `;
            tableBody.appendChild(row); // Append to the main table
        }
    });

    console.log('Log processing complete!');
    attachClickListenerToLogTable(); // Ensure click listener is attached
}
// Function to attach click event listener to the log table
function attachClickListenerToLogTable() {
    const logTable = document.getElementById('logTable');
    if (!logTable) return; // Safeguard in case logTable doesn't exist

    logTable.addEventListener('click', (event) => {
        const target = event.target;

        if (target.tagName === 'SPAN' && target.style.textDecoration === 'underline') {
            const row = target.closest('tr');
            if (row) {
                const log = {
                    time: parseInt(row.cells[0].dataset.time),
                    logType: row.cells[2].innerText.trim(),
                    entry: row.cells[3].innerText.trim()
                };
                console.log('Adding log to floating table:', log);
                addLog(log);
            }
        }
    });
}

// Initialize once the page loads
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('logTable')) {
        attachClickListenerToLogTable();
    }
});

// Drag-and-drop event listeners
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
if (file) {
    processFile(file);
}
});

// Click to select a file
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
const file = e.target.files[0];
if (file) {
    processFile(file);
}
});

const selectedLogs = [];
const logTable = document.getElementById('logTable');
const floatingTable = document.getElementById('floatingTable');
const floatingTableBody = document.getElementById('floatingTableBody');
const totalTimeSpan = document.getElementById('totalTime');

const searchInput = document.getElementById('searchInput');
searchInput.addEventListener('input', debounce(filterLogs, 500));

function getTimeDiffColor(diff) {
    if (diff < 1000) return 'background-color: lightgreen;'; // Green
    if (diff < 3000) return 'background-color: yellow;';     // Yellow
    if (diff < 6000) return 'background-color: orange;';     // Orange
    return 'background-color: red;';                         // Red
}


// Debounce function
function debounce(func, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

// Filter logs function
function filterLogs() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    // Check if the search term length is less than 2
    if (searchTerm.length < 2) {
        console.warn('Search term must be at least 2 characters');
        return; // Stop execution
    }

    const rows = document.querySelectorAll('#logTable tr:not(:first-child)');
    rows.forEach(row => {
        const cells = Array.from(row.cells);
        const matches = cells.some(cell => cell.innerText.toLowerCase().includes(searchTerm));
        row.style.display = matches ? '' : 'none';
    });
}

function updateFloatingTable() {
    const floatingTableBody = document.getElementById('floatingTableBody');
    const totalTimeSpan = document.getElementById('totalTime');
    floatingTableBody.innerHTML = ''; // Clear existing rows

    let totalTime = 0;
    

    for (let i = 0; i < selectedLogs.length; i++) {
        const log = selectedLogs[i];
        const prevLog = selectedLogs[i - 1];
        let diffFromPreviousLog = 0;
     

        // Calculate time differences
        if (i > 0) {
            let currentTime = parseCustomTimestamp(selectedLogs[i].entry);
            let previousTimestamp = parseCustomTimestamp(selectedLogs[i - 1].entry);
            diffFromPreviousLog = previousTimestamp !== null ? Math.round(currentTime - previousTimestamp) : 0;
        } else {
            diffFromPreviousLog = 0
        }

        totalTime += diffFromPreviousLog;

        // Create a row for the floating table
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="${getTimeDiffColor(diffFromPreviousLog)}">${diffFromPreviousLog} ms</td>
            <td>${log.logType}</td>
            <td>${log.entry}</td>
            <td class="delete-row" style="cursor: pointer; color: red;" onclick="removeLog(${i})">Delete</td>
        `;
        floatingTableBody.appendChild(row); // Add row to floating table
    }

    totalTimeSpan.innerText = `${totalTime} ms`; // Update total time
}


function addLog(log) {
    // Check if the log is already in the floating table
    const isAlreadyAdded = selectedLogs.some(
        (existingLog) => existingLog.time === log.time && existingLog.logType === log.logType && existingLog.entry === log.entry
    );
    if (isAlreadyAdded) {
        console.warn('Log is already added to the floating table:', log);
        return; // Skip adding if already exists
    }

    selectedLogs.push(log); // Add the log to the selectedLogs array
    selectedLogs.sort((a, b) => a.time - b.time); // Sort by timestamp
    floatingTable.style.display = 'block'; // Ensure floating table is visible
    updateFloatingTable(); // Update the floating table display
}


function removeLog(index) {
    selectedLogs.splice(index, 1);
    if (selectedLogs.length === 0) {
        floatingTable.style.display = 'none';
    }
    updateFloatingTable();
}

function updateSummary() {
    const rows = document.querySelectorAll('#logTable tr:not(:first-child)');
    const totalLogs = rows.length;

    let totalTimeDiff = 0;
    const typeCounts = {};

    rows.forEach(row => {
        const timeDiff = parseInt(row.cells[0].innerText);
        totalTimeDiff += timeDiff;

        const type = row.cells[2].innerText;
        typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const averageTimeDiff = totalTimeDiff / totalLogs || 0;
    const mostFrequentType = Object.keys(typeCounts).reduce((a, b) => typeCounts[a] > typeCounts[b] ? a : b, '');

    document.getElementById('totalLogs').innerText = totalLogs;
    document.getElementById('averageTimeDiff').innerText = averageTimeDiff.toFixed(2);
    document.getElementById('mostFrequentType').innerText = mostFrequentType;
}

function exportFloatingTableLogs() {
    if (selectedLogs.length === 0) {
        alert('No logs available to export!');
        return;
    }

    const defaultFileName = 'selected_logs.csv';
    const fileName = prompt('Enter the file name:', defaultFileName) || defaultFileName;

    // Create the CSV content
    const csvRows = ['Time,Type,Log Entry']; // CSV header

    let totalTime = 0;
    

    for (let i = 0; i < selectedLogs.length; i++) {
        const log = selectedLogs[i];
        const prevLog = selectedLogs[i - 1];
        let diffFromPreviousLog = 0;
     

        // Calculate time differences
        if (i > 0) {
            let currentTime = parseCustomTimestamp(selectedLogs[i].entry);
            let previousTimestamp = parseCustomTimestamp(selectedLogs[i - 1].entry);
            diffFromPreviousLog = previousTimestamp !== null ? Math.round(currentTime - previousTimestamp) : 0;
        } else {
            diffFromPreviousLog = 0
        }

        const row = `${diffFromPreviousLog},${log.logType},"${log.entry.replace(/"/g, '""')}"`; // Escape quotes in entries
        totalTime += diffFromPreviousLog;
        csvRows.push(row);
    }

    const totalTimeRow = `${totalTime} ms, Total Time, ""`;
    csvRows.push(totalTimeRow);

    // Join the rows with newlines to ensure proper CSV formatting
    const csvContent = csvRows.join('\n');

    // Create a Blob and trigger the download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
}


window.addLog = addLog;
window.removeLog = removeLog;

// Resizable floating table
const resizeHandleBottomRight = document.querySelector('.resize-handle');
const resizeHandleBottomLeft = document.querySelector('.resize-handle-bottom-left');
let isResizing = false;

// Function to start resizing
function startResize(e, direction) {
isResizing = true;

const floatingTableRect = floatingTable.getBoundingClientRect();
const startWidth = floatingTableRect.width;
const startHeight = floatingTableRect.height;
const startX = e.clientX;
const startY = e.clientY;

function resize(e) {
    if (isResizing) {
        if (direction === 'bottom-right') {
            const newWidth = startWidth + (e.clientX - startX);
            const newHeight = startHeight + (e.clientY - startY);
            floatingTable.style.width = `${newWidth}px`;
            floatingTable.style.height = `${newHeight}px`;
        } else if (direction === 'bottom-left') {
            const newWidth = startWidth - (e.clientX - startX);
            const newHeight = startHeight + (e.clientY - startY);
            if (newWidth > 100) { // Prevent table from collapsing
                floatingTable.style.width = `${newWidth}px`;
            }
            floatingTable.style.height = `${newHeight}px`;
        }
    }
}


function stopResize() {
    isResizing = false;
    window.removeEventListener('mousemove', resize);
    window.removeEventListener('mouseup', stopResize);
}

const dragHandle = document.getElementById('dragHandle');
let isDragging = false;

dragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const rect = floatingTable.getBoundingClientRect();

    function onMouseMove(e) {
        if (isDragging) {
            floatingTable.style.top = `${rect.top + e.clientY - startY}px`;
            floatingTable.style.left = `${rect.left + e.clientX - startX}px`;
        }
    }

    function onMouseUp() {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
});

window.addEventListener('mousemove', resize);
window.addEventListener('mouseup', stopResize);
}



// Add event listeners for resizing
resizeHandleBottomRight.addEventListener('mousedown', (e) => startResize(e, 'bottom-right'));
resizeHandleBottomLeft.addEventListener('mousedown', (e) => startResize(e, 'bottom-left'));

function clearFloatingTable() {
    if (confirm('Are you sure you want to clear all logs?')) {
        selectedLogs.length = 0;
        document.getElementById('floatingTableBody').innerHTML = '';
        document.getElementById('totalTime').innerText = '0 ms';
        document.getElementById('floatingTable').style.display = 'none';
        console.log('Floating table cleared!');
    }
}


function resetLogs() {
    updateFilteredLogs(selectedLogs); // Reset to the original logs
    console.log('Logs reset to original state.');
}

// Add this new function to handle clipboard paste
function setupClipboardPaste() {
    const pasteArea = document.createElement('textarea');
    pasteArea.id = 'pasteArea';
    pasteArea.placeholder = 'Or paste your logs here...';
    pasteArea.style.width = '80%';
    pasteArea.style.height = '100px';
    pasteArea.style.margin = '20px auto';
    pasteArea.style.display = 'block';
    pasteArea.style.padding = '10px';

    // Insert paste area after drop zone
    dropZone.parentNode.insertBefore(pasteArea, dropZone.nextSibling);

    // Add paste event listener
    pasteArea.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        if (pastedText) {
            processLogs(pastedText);
            pasteArea.value = pastedText; // Show the pasted content in the textarea
        }
    });

    // Add input event listener for manual typing
    pasteArea.addEventListener('input', (e) => {
        const text = e.target.value;
        if (text) {
            processLogs(text);
        }
    });
}