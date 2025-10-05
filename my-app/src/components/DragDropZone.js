import React, { useRef } from 'react';

const DragDropZone = ({ onDropFiles, message, subMessage }) => {
    const fileInputRef = useRef(null);

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const dataTransfer = e.dataTransfer;
        const droppedItems = dataTransfer.items;

        if (droppedItems && droppedItems[0].webkitGetAsEntry) {
            const promises = [];
            for (let i = 0; i < droppedItems.length; i++) {
                const entry = droppedItems[i].webkitGetAsEntry();
                if (entry) {
                    promises.push(readEntry(entry));
                }
            }

            Promise.all(promises)
                .then(results => {
                    const allFiles = results.flat();
                    onDropFiles(allFiles);
                    console.log('Processed dropped files and folders:', allFiles);
                })
                .catch(error => {
                    console.error('Error reading dropped files:', error);
                    alert('An error occurred while reading the dropped files.');
                });
        } else {
            alert('Your browser does not support drag-and-drop for folders. Please use the "Upload Folder" button instead.');
            onDropFiles([]);
        }
    };

    const readEntry = (entry, path = '') => {
        return new Promise((resolve, reject) => {
            if (entry.isDirectory) {
                const dirReader = entry.createReader();
                const allFiles = [];
                const readEntries = () => {
                    dirReader.readEntries(entries => {
                        if (entries.length === 0) {
                            Promise.all(allFiles)
                                .then(results => resolve(results.flat()))
                                .catch(reject);
                        } else {
                            const promises = entries.map(innerEntry => {
                                const newPath = `${path}${entry.name}/`;
                                return readEntry(innerEntry, newPath);
                            });
                            allFiles.push(...promises);
                            readEntries();
                        }
                    }, reject);
                };
                readEntries();
            } else if (entry.isFile) {
                entry.file(file => {
                    file.text().then(content => {
                        resolve({
                            path: `${path}${file.name}`,
                            content: content,
                            lastModified: file.lastModified,
                            size: file.size,
                        });
                    }).catch(reject);
                }, reject);
            }
        });
    };

    const handleFileInputChange = (e) => {
        const files = e.target.files;
        if (files.length === 0) {
            onDropFiles([]);
            return;
        }

        const promises = Array.from(files).map(file => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    resolve({
                        path: file.webkitRelativePath,
                        content: event.target.result,
                        lastModified: file.lastModified,
                        size: file.size,
                    });
                };
                reader.onerror = reject;
                reader.readAsText(file);
            });
        });

        Promise.all(promises)
            .then(allFiles => onDropFiles(allFiles))
            .catch(error => {
                console.error("Error reading files from input:", error);
                alert("An error occurred while reading the files.");
            });
    };

    const handleClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleStartProject = () => {
        const emptyFile = [{
            path: 'main.c',
            content: '',
            lastModified: Date.now(),
            size: 0
        }];
        onDropFiles(emptyFile);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    return (
        <div
            className="drop-zone"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={(e) => e.currentTarget.classList.add('dragging-over')}
            onDragLeave={(e) => e.currentTarget.classList.remove('dragging-over')}
        >
            <p>{message}</p>
            <p className="small-text">{subMessage}</p>
            <div className="or-divider">OR</div>

            <button className="main-button upload-button" onClick={handleClick}>
                Upload Folder
            </button>

            <input
                id="folder-upload-input"
                type="file"
                webkitdirectory="true"
                directory="true"
                onChange={handleFileInputChange}
                ref={fileInputRef}
                style={{ display: 'none' }}
            />

            <button className="main-button start-project-button" onClick={handleStartProject}>
                Start a Project
            </button>
        </div>
    );
};

export default DragDropZone;
