import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import DragDropZone from '../components/DragDropZone';
import AceEditor from 'react-ace';

import 'ace-builds/src-noconflict/theme-monokai';
import 'ace-builds/src-noconflict/mode-c_cpp';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/mode-java';


import './EditorPage.css'; 

const buildFileTree = (files) => {
  const root = { name: 'root', children: [] };
  files.forEach(file => {
    const parts = file.path.split('/');
    let current = root;
    parts.forEach((part, i) => {
      let existing = current.children.find(child => child.name === part);
      if (!existing) {
        existing = {
          name: part,
          children: [],
          isFile: i === parts.length - 1,
          path: i === parts.length - 1 ? file.path : null,
        };
        current.children.push(existing);
      }
      current = existing;
    });
  });
  return root;
};

const FileNode = ({ node, onFileClick, activeFilePath }) => {
  const [isOpen, setIsOpen] = useState(true);
  if (node.isFile) {
    return (
      <li
        className={`file-item ${node.path === activeFilePath ? 'active' : ''}`}
        onClick={() => onFileClick(node.path)}
      >
        📄 <span>{node.name}</span>
      </li>
    );
  }
  return (
    <li>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="folder-node"
      >
        <span>{isOpen ? '📂' : '📁'}</span>
        {node.name}
      </div>
      {isOpen && node.children.length > 0 && (
        <ul className="file-tree">
          {node.children.map((child, idx) => (
            <FileNode
              key={idx}
              node={child}
              onFileClick={onFileClick}
              activeFilePath={activeFilePath}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

const EditorPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [droppedItems, setDroppedItems] = useState([]);
  const [isProjectLoaded, setIsProjectLoaded] = useState(false);
  const [activeFilePath, setActiveFilePath] = useState(null);
  const [activeFileContent, setActiveFileContent] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [consoleOutput, setConsoleOutput] = useState('');
  const [consoleHeight, setConsoleHeight] = useState(150); 

  const handleFilesLoaded = (files) => {
    setDroppedItems(files);
    if (files.length > 0) {
      setIsProjectLoaded(true);
      setActiveFilePath(files[0].path);
      setActiveFileContent(files[0].content);
    } else {
      setIsProjectLoaded(false);
      alert('No files were loaded.');
    }
  };

  const handleFileClick = (filePath) => {
    const file = droppedItems.find(item => item.path === filePath);
    if (file) {
      setActiveFilePath(filePath);
      setActiveFileContent(file.content);
    }
  };

  const handleCodeChange = (newContent) => {
    setActiveFileContent(newContent);
    setDroppedItems(droppedItems.map(item =>
      item.path === activeFilePath ? { ...item, content: newContent } : item
    ));
  };

  const handleLeaveRoom = () => {
    if (window.confirm("Are you sure you want to leave this room?")) {
      navigate('/');
    }
  };

  const handleDownloadProject = () => {
    const zip = new JSZip();
    droppedItems.forEach(file => {
      zip.file(file.path, file.content);
    });
    zip.generateAsync({ type: 'blob' })
      .then(content => saveAs(content, 'code-fusion-project.zip'))
      .catch(err => {
        console.error("Zip error:", err);
        alert("Failed to download project.");
      });
  };

  const handleRun = async () => {
    const languageMap = {
      javascript: 63,
      c_cpp: 50,
      python: 71,
      java: 62
    };

    const encodedCode = btoa(unescape(encodeURIComponent(activeFileContent)));

    try {
      const response = await fetch('http://localhost:5000/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_code: encodedCode,
          language_id: languageMap[language],
          base64_encoded: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const output = data.stdout || data.stderr || data.compile_output || data.message || 'No output';
      setConsoleOutput(output);
    } catch (error) {
      console.error("Error running code:", error);
      setConsoleOutput(`Error: Could not connect to the judge server or an unexpected error occurred. ${error.message}`);
    }
  };

  const handleResize = (e) => {
  
    const newHeight = window.innerHeight - e.clientY;
     
    if (newHeight >= 100 && newHeight <= 500) {
      setConsoleHeight(newHeight);
    }
  };


  const fileTree = buildFileTree(droppedItems);

  if (!isProjectLoaded) {
    return (
      <div className="initial-state-container">
        <div className="center-content">
          <h3 className="editor-welcome-text">Welcome to your collaborative workspace!</h3>
          <p className="editor-hint">To get started, load a project.</p>
          <DragDropZone
            onDropFiles={handleFilesLoaded}
            message={"Drag & drop your project folder here"}
            subMessage="(Or use the button below)"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="editor-page-container">
      <header className="editor-header">
        <div className="room-info">
          <h2>Room: <span className="room-name">{roomId}</span></h2>
        </div>
        <nav className="editor-nav">
          <button className="nav-button download-button" onClick={handleDownloadProject}>Download Project</button>
          <button className="nav-button leave-room-button" onClick={handleLeaveRoom}>Leave Room</button>
        </nav>
      </header>

      <div className="editor-main-content">
        <aside className="sidebar"> 
          <div className="sidebar-header"><h3>Project Explorer</h3></div>
          <div className="file-list-container">
            <ul className="file-tree">
              {fileTree.children.map((node, index) => (
                <FileNode
                  key={index}
                  node={node}
                  onFileClick={handleFileClick}
                  activeFilePath={activeFilePath}
                />
              ))}
            </ul>
          </div>
          <div className="users-placeholder">
            <h3>Participants</h3>
            <ul className="users-list">
              <li>You (Host)</li>
              <li>Collaborator 1</li>
              <li>Collaborator 2</li>
            </ul>
          </div>
        </aside>

        <main className="editor-panel">
          <div className="file-meta-bar">
            <h3 className="loaded-project-title">
              {activeFilePath ? `Editing: ${activeFilePath}` : 'Select a file'}
            </h3>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="language-dropdown"
            >
              <option value="javascript">JavaScript</option>
              <option value="c_cpp">C / C++</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
            </select>
            <button
              onClick={handleRun}
              className="run-button"
            >
              Run
            </button>
          </div>

          <div className="ace-editor-container">
            <AceEditor
              mode={language}
              theme="monokai"
              value={activeFileContent}
              onChange={handleCodeChange}
              name="ace-editor"
              editorProps={{ $blockScrolling: true }}
              width="100%"
              height="100%" 
              fontSize={14}
              setOptions={{ useWorker: false }}
              className="ace-editor-wrapper"
            />
          </div>

          <div
            className="console-container"
            style={{ height: `${consoleHeight}px` }} /* Only dynamic height here */
            onMouseDown={(e) => {
              const onMouseMove = (moveEvent) => handleResize(moveEvent);
              const onMouseUp = () => document.removeEventListener('mousemove', onMouseMove);
              document.addEventListener('mousemove', onMouseMove);
              document.addEventListener('mouseup', onMouseUp, { once: true });
            }}
          >
            <pre>
              <strong>Console Output</strong>
              {consoleOutput || '> Build successful!\n> Ready for collaboration.'}
            </pre>
          </div>
        </main>
      </div>
    </div>
  );
};

export default EditorPage;
