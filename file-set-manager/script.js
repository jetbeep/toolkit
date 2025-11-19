// File Set Manager - Main Application Logic

class FileSetManager {
    constructor() {
        this.baseUrl = '';
        this.apiKey = '';
        this.projectId = '';
        this.fileSets = [];
        this.currentFileSet = null;
        this.currentFiles = [];
        this.editingFileId = null;

        this.init();
    }

    init() {
        this.loadConfigFromStorage();
        this.attachEventListeners();
        this.updateUIState();
    }

    // Configuration Management
    loadConfigFromStorage() {
        const savedConfig = localStorage.getItem('fileSetManagerConfig');
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                document.getElementById('baseUrl').value = config.baseUrl || '';
                document.getElementById('apiKey').value = config.apiKey || '';
                document.getElementById('projectId').value = config.projectId || '40';

                this.baseUrl = config.baseUrl || '';
                this.apiKey = config.apiKey || '';
                this.projectId = config.projectId || '';
            } catch (e) {
                console.error('Failed to load saved config:', e);
            }
        }
    }

    saveConfigToStorage() {
        const config = {
            baseUrl: this.baseUrl,
            apiKey: this.apiKey,
            projectId: this.projectId
        };
        localStorage.setItem('fileSetManagerConfig', JSON.stringify(config));
        this.showToast('Configuration saved to browser', 'success');
    }

    clearConfigFromStorage() {
        localStorage.removeItem('fileSetManagerConfig');
        document.getElementById('baseUrl').value = 'https://dev.jetbeep.com/fleet/api';
        document.getElementById('apiKey').value = '';
        document.getElementById('projectId').value = '40';
        this.baseUrl = '';
        this.apiKey = '';
        this.projectId = '';
        this.showToast('Configuration cleared', 'info');
    }

    exportConfig() {
        const config = {
            baseUrl: this.baseUrl,
            note: 'API key is not exported for security. Please set it manually.'
        };

        const dataStr = JSON.stringify(config, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'file-set-manager-config.json';
        link.click();
        URL.revokeObjectURL(url);

        this.showToast('Configuration exported', 'success');
    }

    importConfig() {
        const fileInput = document.getElementById('configFileInput');
        fileInput.click();

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const config = JSON.parse(event.target.result);

                    if (config.baseUrl) {
                        document.getElementById('baseUrl').value = config.baseUrl;
                        this.baseUrl = config.baseUrl;
                    }

                    this.showToast('Configuration imported. Please set API key.', 'success');
                } catch (e) {
                    this.showToast('Failed to import configuration: ' + e.message, 'error');
                }
            };
            reader.readAsText(file);

            // Reset file input
            fileInput.value = '';
        };
    }

    // Event Listeners
    attachEventListeners() {
        // Configuration
        document.getElementById('connectBtn').addEventListener('click', () => this.connect());
        document.getElementById('saveConfigBtn').addEventListener('click', () => this.saveConfigToStorage());
        document.getElementById('clearConfigBtn').addEventListener('click', () => this.clearConfigFromStorage());
        document.getElementById('exportConfigBtn').addEventListener('click', () => this.exportConfig());
        document.getElementById('importConfigBtn').addEventListener('click', () => this.importConfig());

        // File Sets
        document.getElementById('refreshFileSetsBtn').addEventListener('click', () => this.loadFileSets());
        document.getElementById('searchFileSet').addEventListener('input', (e) => this.filterFileSets(e.target.value));

        // File Set Detail
        document.getElementById('refreshFileSetBtn').addEventListener('click', () => {
            if (this.currentFileSet) {
                this.loadFileSetDetail(this.currentFileSet.id);
            }
        });

        // File Upload
        document.getElementById('uploadFileBtn').addEventListener('click', () => this.uploadFiles());
        document.getElementById('fileInput').addEventListener('change', (e) => this.updateFilePreview(e));

        // Edit File Modal
        document.getElementById('saveFileEditBtn').addEventListener('click', () => this.saveFileEdit());
    }

    // API Methods
    async makeRequest(endpoint, method = 'GET', body = null, isFormData = false) {
        const url = `${this.baseUrl}${endpoint}`;

        const headers = {
            'api-key': this.apiKey,
            'project-id': this.projectId
        };

        // Only add Content-Type for non-FormData requests
        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }

        const options = {
            method,
            headers
        };

        if (body) {
            options.body = isFormData ? body : JSON.stringify(body);
        }

        try {
            const response = await fetch(url, options);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            // Handle 204 No Content responses
            if (response.status === 204) {
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    // Connection
    async connect() {
        this.baseUrl = document.getElementById('baseUrl').value.trim();
        this.apiKey = document.getElementById('apiKey').value.trim();
        this.projectId = document.getElementById('projectId').value.trim();

        if (!this.baseUrl || !this.apiKey || !this.projectId) {
            this.showToast('Please fill in all configuration fields', 'error');
            return;
        }

        try {
            await this.loadFileSets();
            this.updateUIState();
            this.showToast('Connected successfully', 'success');
        } catch (error) {
            this.showToast('Connection failed: ' + error.message, 'error');
        }
    }

    // Load File Sets
    async loadFileSets() {
        document.getElementById('fileSetsLoading').style.display = 'block';
        document.getElementById('fileSetsList').innerHTML = '';

        try {
            const data = await this.makeRequest('/f-file-sets/?extensions=creator,filesStats&perPage=100');
            this.fileSets = data.rows || [];
            this.renderFileSets();
            document.getElementById('fileSetsLoading').style.display = 'none';
        } catch (error) {
            document.getElementById('fileSetsLoading').style.display = 'none';
            this.showToast('Failed to load file sets: ' + error.message, 'error');
        }
    }

    // Render File Sets
    renderFileSets(filter = '') {
        const listContainer = document.getElementById('fileSetsList');
        listContainer.innerHTML = '';

        const filteredSets = this.fileSets.filter(set => {
            if (!filter) return true;
            const searchLower = filter.toLowerCase();
            return set.name.toLowerCase().includes(searchLower) ||
                   set.group.toLowerCase().includes(searchLower) ||
                   (set.creator && set.creator.name.toLowerCase().includes(searchLower));
        });

        if (filteredSets.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-inbox"></i>
                    <p>No file sets found</p>
                </div>
            `;
            return;
        }

        filteredSets.forEach(set => {
            const item = document.createElement('div');
            item.className = 'list-group-item file-set-item';
            if (this.currentFileSet && this.currentFileSet.id === set.id) {
                item.classList.add('active');
            }

            const fileStats = set.filesStats || {};
            const totalFiles = Object.values(fileStats).reduce((sum, count) => sum + count, 0);

            item.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${this.escapeHtml(set.name)}</h6>
                        <small class="d-block">
                            <i class="bi bi-tag-fill me-1"></i>${this.escapeHtml(set.group)}
                        </small>
                        <small class="d-block">
                            <i class="bi bi-person-fill me-1"></i>${set.creator ? this.escapeHtml(set.creator.name) : 'Unknown'}
                        </small>
                    </div>
                    <div class="text-end">
                        <span class="badge bg-primary">${totalFiles} files</span>
                        <small class="d-block mt-1 text-muted">
                            ID: ${set.id}
                        </small>
                    </div>
                </div>
            `;

            item.addEventListener('click', () => this.selectFileSet(set));
            listContainer.appendChild(item);
        });
    }

    filterFileSets(searchTerm) {
        this.renderFileSets(searchTerm);
    }

    // Select File Set
    async selectFileSet(fileSet) {
        this.currentFileSet = fileSet;
        this.renderFileSets(document.getElementById('searchFileSet').value);
        await this.loadFileSetDetail(fileSet.id);
    }

    // Load File Set Detail
    async loadFileSetDetail(fileSetId) {
        document.getElementById('filesLoading').style.display = 'block';
        document.getElementById('fileSetDetailPanel').style.display = 'block';

        try {
            const data = await this.makeRequest(`/f-file-sets/${fileSetId}?extensions=files,creator`);
            console.log('File set detail loaded:', data);
            this.currentFileSet = data;
            this.currentFiles = data.files || [];
            console.log('Files in set:', this.currentFiles);
            this.renderFileSetDetail();
            document.getElementById('filesLoading').style.display = 'none';
        } catch (error) {
            document.getElementById('filesLoading').style.display = 'none';
            this.showToast('Failed to load file set details: ' + error.message, 'error');
        }
    }

    // Render File Set Detail
    renderFileSetDetail() {
        if (!this.currentFileSet) return;

        // Update header
        document.getElementById('fileSetName').textContent = this.currentFileSet.name;

        // Render metadata
        const metadataContainer = document.getElementById('fileSetMetadata');
        metadataContainer.innerHTML = `
            <div class="row g-2">
                <div class="col-md-6">
                    <div class="metadata-item">
                        <strong>ID:</strong> ${this.currentFileSet.id}
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="metadata-item">
                        <strong>Group:</strong> ${this.escapeHtml(this.currentFileSet.group)}
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="metadata-item">
                        <strong>Created By:</strong> ${this.currentFileSet.creator ? this.escapeHtml(this.currentFileSet.creator.name) : 'Unknown'}
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="metadata-item">
                        <strong>Created At:</strong> ${new Date(this.currentFileSet.createdAt).toLocaleString()}
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="metadata-item">
                        <strong>CRC32:</strong> ${this.currentFileSet.crc32}
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="metadata-item">
                        <strong>Readonly:</strong> ${this.currentFileSet.readonly ? 'Yes' : 'No'}
                    </div>
                </div>
            </div>
        `;

        // Render files
        this.renderFiles();
    }

    // Render Files
    renderFiles() {
        const tbody = document.getElementById('filesTableBody');
        tbody.innerHTML = '';

        document.getElementById('filesCount').textContent = this.currentFiles.length;

        if (this.currentFiles.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4 text-muted">
                        <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                        No files in this file set
                    </td>
                </tr>
            `;
            return;
        }

        this.currentFiles.forEach(async (file) => {
            const row = document.createElement('tr');

            // Create cell for type badge
            const typeCell = document.createElement('td');
            typeCell.innerHTML = `
                <span class="badge file-type-badge file-type-${file.type}">
                    ${file.type}
                </span>
            `;

            // Create cell for path with optional image thumbnail
            const pathCell = document.createElement('td');
            if (file.type === 'screenImage') {
                const thumbnailContainer = document.createElement('span');
                const img = document.createElement('img');
                img.className = 'file-thumbnail me-2';
                img.alt = file.path;
                img.style.cursor = 'pointer';

                // Load image with authentication
                const dataUrl = await this.getFileDataUrl(file.id);
                if (dataUrl) {
                    img.src = dataUrl;
                    img.onclick = () => this.showImagePreview(file.id, file.path);
                }

                thumbnailContainer.appendChild(img);
                pathCell.appendChild(thumbnailContainer);
            }

            const pathCode = document.createElement('code');
            pathCode.textContent = file.path;
            pathCell.appendChild(pathCode);

            // Create other cells
            const createdByCell = document.createElement('td');
            createdByCell.textContent = file.createdBy || 'N/A';

            const createdAtCell = document.createElement('td');
            const createdAtSmall = document.createElement('small');
            createdAtSmall.textContent = new Date(file.createdAt).toLocaleString();
            createdAtCell.appendChild(createdAtSmall);

            const actionsCell = document.createElement('td');
            actionsCell.innerHTML = `
                <button class="btn btn-sm btn-outline-primary action-btn me-1"
                        onclick="fileSetManager.editFile(${file.id})">
                    <i class="bi bi-pencil-fill"></i> Edit
                </button>
                <button class="btn btn-sm btn-outline-danger action-btn"
                        onclick="fileSetManager.deleteFile(${file.id}, '${this.escapeHtml(file.path)}')">
                    <i class="bi bi-trash-fill"></i> Delete
                </button>
            `;

            // Append all cells to row
            row.appendChild(typeCell);
            row.appendChild(pathCell);
            row.appendChild(createdByCell);
            row.appendChild(createdAtCell);
            row.appendChild(actionsCell);

            tbody.appendChild(row);
        });
    }

    // Update File Preview
    updateFilePreview(event) {
        const fileInput = event.target;
        const files = fileInput.files;
        const filePreview = document.getElementById('filePreview');
        const fileCount = document.getElementById('fileCount');
        const fileList = document.getElementById('fileList');
        const uploadBtnText = document.getElementById('uploadBtnText');
        const fileType = document.getElementById('fileType').value;

        if (files.length === 0) {
            filePreview.style.display = 'none';
            uploadBtnText.textContent = 'File(s)';
            return;
        }

        fileCount.textContent = files.length;
        fileList.innerHTML = '';

        const isImageType = fileType === 'screenImage';

        Array.from(files).forEach((file, index) => {
            const fileSize = (file.size / 1024).toFixed(2);

            if (isImageType && file.type.startsWith('image/')) {
                // Create preview with image thumbnail
                const previewItem = document.createElement('div');
                previewItem.className = 'file-preview-item';

                const img = document.createElement('img');
                img.className = 'file-preview-thumbnail';
                img.alt = file.name;

                // Create object URL for preview
                const reader = new FileReader();
                reader.onload = (e) => {
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);

                const info = document.createElement('div');
                info.className = 'file-preview-info';
                info.innerHTML = `
                    <div><strong>${this.escapeHtml(file.name)}</strong></div>
                    <div class="text-muted small">${fileSize} KB</div>
                `;

                previewItem.appendChild(img);
                previewItem.appendChild(info);
                fileList.appendChild(previewItem);
            } else {
                // Regular list item for non-images
                const li = document.createElement('li');
                li.textContent = `${file.name} (${fileSize} KB)`;
                fileList.appendChild(li);
            }
        });

        filePreview.style.display = 'block';
        uploadBtnText.textContent = files.length === 1 ? 'File' : `${files.length} Files`;
    }

    // Upload Files (supports multiple files)
    async uploadFiles() {
        const fileInput = document.getElementById('fileInput');
        const fileType = document.getElementById('fileType').value;

        if (!fileInput.files || fileInput.files.length === 0) {
            this.showToast('Please select file(s) to upload', 'error');
            return;
        }

        if (!this.currentFileSet) {
            this.showToast('Please select a file set first', 'error');
            return;
        }

        const files = Array.from(fileInput.files);
        const totalFiles = files.length;
        let successCount = 0;
        let failCount = 0;

        // Disable upload button during upload
        const uploadBtn = document.getElementById('uploadFileBtn');
        const originalBtnText = uploadBtn.innerHTML;
        uploadBtn.disabled = true;

        try {
            this.showToast(`Uploading ${totalFiles} file(s)...`, 'info');

            // Upload files sequentially to avoid overwhelming the server
            for (let i = 0; i < files.length; i++) {
                const file = files[i];

                try {
                    // Update button with progress
                    uploadBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Uploading ${i + 1}/${totalFiles}`;

                    // Read file as base64
                    const base64Data = await this.readFileAsBase64(file);

                    // Prepare request body
                    const requestBody = {
                        setId: parseInt(this.currentFileSet.id),
                        type: fileType,
                        path: file.name,
                        binSerializer: "base64",
                        dataBinStr: base64Data
                    };

                    // Upload file
                    await this.makeRequest('/f-file-sets/files', 'POST', requestBody);

                    successCount++;
                    console.log(`Uploaded ${i + 1}/${totalFiles}: ${file.name}`);
                } catch (error) {
                    failCount++;
                    console.error(`Failed to upload ${file.name}:`, error);
                }
            }

            // Show summary
            if (successCount === totalFiles) {
                this.showToast(`Successfully uploaded ${successCount} file(s)`, 'success');
            } else if (successCount > 0) {
                this.showToast(`Uploaded ${successCount} file(s), ${failCount} failed`, 'info');
            } else {
                this.showToast(`All uploads failed`, 'error');
            }

            // Clear file input and preview
            fileInput.value = '';
            document.getElementById('filePreview').style.display = 'none';
            document.getElementById('uploadBtnText').textContent = 'File(s)';

            // Reload file set detail
            await this.loadFileSetDetail(this.currentFileSet.id);
        } catch (error) {
            this.showToast('Upload process failed: ' + error.message, 'error');
        } finally {
            // Re-enable button
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = originalBtnText;
        }
    }

    // Helper: Read file as base64
    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Delete File
    async deleteFile(fileId, fileName) {
        if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
            return;
        }

        try {
            await this.makeRequest(`/f-file-sets/files/${fileId}`, 'DELETE');
            this.showToast(`File "${fileName}" deleted successfully`, 'success');

            // Reload file set detail
            await this.loadFileSetDetail(this.currentFileSet.id);
        } catch (error) {
            this.showToast('Failed to delete file: ' + error.message, 'error');
        }
    }

    // Get File as Data URL
    async getFileDataUrl(fileId) {
        try {
            const data = await this.makeRequest(`/f-file-sets/files/${fileId}?extensions=data,creator`);

            if (data && data.dataBinBase64) {
                // Convert base64 to data URL
                return `data:image/jpeg;base64,${data.dataBinBase64}`;
            }
            return null;
        } catch (error) {
            console.error('Failed to load file:', error);
            return null;
        }
    }

    // Show Image Preview
    async showImagePreview(fileId, fileName) {
        const modal = new bootstrap.Modal(document.getElementById('imagePreviewModal'));
        const img = document.getElementById('imagePreviewImg');
        const title = document.getElementById('imagePreviewTitle');

        title.textContent = fileName;
        img.src = ''; // Clear previous image

        // Show loading state
        img.alt = 'Loading...';

        const dataUrl = await this.getFileDataUrl(fileId);
        if (dataUrl) {
            img.src = dataUrl;
            img.alt = fileName;
            modal.show();
        } else {
            this.showToast('Failed to load image preview', 'error');
        }
    }

    // Edit File
    editFile(fileId) {
        const file = this.currentFiles.find(f => f.id === fileId);
        if (!file) return;

        this.editingFileId = fileId;

        document.getElementById('editFileName').textContent = file.path;
        document.getElementById('editFileType').value = file.type;
        document.getElementById('editFileInput').value = '';

        const modal = new bootstrap.Modal(document.getElementById('editFileModal'));
        modal.show();
    }

    // Save File Edit
    async saveFileEdit() {
        if (!this.editingFileId) return;

        const fileInput = document.getElementById('editFileInput');
        const fileType = document.getElementById('editFileType').value;

        if (!fileInput.files || fileInput.files.length === 0) {
            this.showToast('Please select a file to upload', 'error');
            return;
        }

        const file = fileInput.files[0];

        try {
            // Read file as base64
            const base64Data = await this.readFileAsBase64(file);

            // Prepare request body with binSerializer and dataBinStr
            // Note: PATCH endpoint does not accept 'type' field, only path, binSerializer, and dataBinStr
            const requestBody = {
                path: file.name,
                binSerializer: "base64",
                dataBinStr: base64Data
            };

            // Update file
            await this.makeRequest(`/f-file-sets/files/${this.editingFileId}`, 'PATCH', requestBody);

            this.showToast(`File updated successfully`, 'success');

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('editFileModal'));
            modal.hide();

            // Reload file set detail
            await this.loadFileSetDetail(this.currentFileSet.id);
        } catch (error) {
            this.showToast('Failed to update file: ' + error.message, 'error');
        }
    }

    // UI State Management
    updateUIState() {
        const isConnected = this.baseUrl && this.apiKey && this.projectId;

        document.getElementById('fileSetsPanel').style.display = isConnected ? 'block' : 'none';

        if (!isConnected) {
            document.getElementById('fileSetDetailPanel').style.display = 'none';
        }
    }

    // Toast Notifications
    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');

        const toastId = 'toast-' + Date.now();
        const toastHtml = `
            <div class="toast toast-${type}" role="alert" id="${toastId}">
                <div class="toast-body d-flex align-items-center">
                    <i class="bi bi-${this.getToastIcon(type)} me-2"></i>
                    <span class="flex-grow-1">${this.escapeHtml(message)}</span>
                    <button type="button" class="btn-close btn-close-white ms-2" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;

        toastContainer.insertAdjacentHTML('beforeend', toastHtml);

        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
        toast.show();

        // Remove from DOM after hidden
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }

    getToastIcon(type) {
        const icons = {
            success: 'check-circle-fill',
            error: 'x-circle-fill',
            info: 'info-circle-fill'
        };
        return icons[type] || icons.info;
    }

    // HTML Escape
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize application
let fileSetManager;
document.addEventListener('DOMContentLoaded', () => {
    fileSetManager = new FileSetManager();
});
