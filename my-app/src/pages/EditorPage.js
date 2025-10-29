import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import DragDropZone from "../components/DragDropZone";
import AceEditor from "react-ace";

//Ace editor themes & languages
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/mode-c_cpp";
import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/mode-java";

import "./EditorPage.css";

//---------------------- File Tree Builder ----------------------
const buildFileTree = (files) => {
  const root = { name: "root", children: [] };
  files.forEach((file) => {
    const parts = file.path.split("/");
    let current = root;
    parts.forEach((part, i) => {
      let existing = current.children.find((child) => child.name === part);
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
        className={`file-item ${node.path === activeFilePath ? "active" : ""}`}
        onClick={() => onFileClick(node.path)}
      >
        📄 <span>{node.name}</span>
      </li>
    );
  }
  return (
    <li>
      <div onClick={() => setIsOpen(!isOpen)} className="folder-node">
        <span>{isOpen ? "📂" : "📁"}</span>
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

//---------------------- EditorPage Component ----------------------
const EditorPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [droppedItems, setDroppedItems] = useState([]);
  const [isProjectLoaded, setIsProjectLoaded] = useState(false);
  const [activeFilePath, setActiveFilePath] = useState(null);
  const [activeFileContent, setActiveFileContent] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [consoleOutput, setConsoleOutput] = useState("");
  const [consoleHeight, setConsoleHeight] = useState(150);

  //----------------- WebSocket Setup ------------------
  const socketRef = useRef(null);
  // --- FIX: Ref to track active file path for stale closure
  const activeFilePathRef = useRef(activeFilePath);

  // --- FIX: Keep the ref in sync with the state
  useEffect(() => {
    activeFilePathRef.current = activeFilePath;
  }, [activeFilePath]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080");
    socketRef.current = ws;

    ws.onopen = () => {
      console.log("Connected to WebSocket server");
      ws.send(JSON.stringify({ type: "join", roomId }));
    };

    ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        console.warn("Received non-JSON message:", event.data);
        return;
      }

      // --- FIX: This 'init' handler now works for both joins and init_project broadcasts
      if (data.type === "init" && data.files) {
        const filesArray = Object.keys(data.files).map((p) => ({
          path: p,
          content: data.files[p],
        }));

        if (filesArray.length > 0) {
          setDroppedItems(filesArray);
          setIsProjectLoaded(true);

          // Check if the current active file still exists
          const currentPath = activeFilePathRef.current;
          const activeFileExists = filesArray.some((f) => f.path === currentPath);

          if (activeFileExists) {
            // Refresh content of the currently active file
            const file = filesArray.find((f) => f.path === currentPath);
            setActiveFileContent(file.content);
          } else {
            // Fallback to the first file if current is null or gone
            setActiveFilePath(filesArray[0].path);
            setActiveFileContent(filesArray[0].content);
          }
        }
        return;
      }

      if (data.type === "edit" && data.path) {
        // --- FIX: Check against the ref to avoid stale state
        if (data.path === activeFilePathRef.current) {
          // Use functional update to avoid stale content
          setActiveFileContent((prev) => data.content);
        }

        // Update the master list
        setDroppedItems((prevItems) =>
          prevItems.map((itm) =>
            itm.path === data.path ? { ...itm, content: data.content } : itm
          )
        );

        return;
      }

      if (data.type === "cursor") {
        return;
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
    };

    return () => {
      try {
        ws.close();
      } catch (e) {}
    };
    // --- FIX: Dependency array only contains roomId
  }, [roomId]);

  //------------------ Handle Code Change ------------------
  const handleCodeChange = (newContent) => {
    setActiveFileContent(newContent);

    // Update master list locally
    setDroppedItems((prev) =>
      prev.map((item) =>
        item.path === activeFilePath ? { ...item, content: newContent } : item
      )
    );

    // Send edit to server
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && activeFilePath) {
      ws.send(
        JSON.stringify({
          type: "edit",
          path: activeFilePath,
          content: newContent,
        })
      );
    }
  };

  //------------------ File Management ------------------
  const handleFilesLoaded = (files) => {
    setDroppedItems(files);
    if (files.length > 0) {
      setIsProjectLoaded(true);
      setActiveFilePath(files[0].path);
      setActiveFileContent(files[0].content);

      // --- FIX: Send the initial project state to the server ---
      const filesMap = files.reduce((acc, file) => {
        acc[file.path] = file.content;
        return acc;
      }, {});

      const ws = socketRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "init_project",
            files: filesMap,
          })
        );
      }
      // --------------------------------------------------------

    } else {
      setIsProjectLoaded(false);
      alert("No files were loaded.");
    }
  };

  const handleFileClick = (filePath) => {
    const file = droppedItems.find((item) => item.path === filePath);
    if (file) {
      setActiveFilePath(filePath);
      setActiveFileContent(file.content);
    }
  };

  const handleLeaveRoom = () => {
    if (window.confirm("Are you sure you want to leave this room?")) {
      navigate("/");
    }
  };

  const handleDownloadProject = () => {
    const zip = new JSZip();
    droppedItems.forEach((file) => {
      zip.file(file.path, file.content);
    });
    zip
      .generateAsync({ type: "blob" })
      .then((content) => saveAs(content, "code-fusion-project.zip"))
      .catch((err) => {
        console.error("Zip error:", err);
        alert("Failed to download project.");
      });
  };

  //------------------ Judge0 Integration (FIXED) ------------------
  const handleRun = async () => {
    const languageMap = {
      javascript: 63,
      c_cpp: 50,
      python: 71,
      java: 62,
    };

    // --- FIX: Remove client-side btoa ---
    // const encodedCode = btoa(unescape(encodeURIComponent(activeFileContent)));

    try {
      const response = await fetch("http://localhost:5000/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_code: activeFileContent, // --- FIX: Send raw code
          language_id: languageMap[language],
          // base64_encoded: true, // --- FIX: Remove this, server handles it
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const output =
        data.stdout ||
        data.stderr ||
        data.compile_output ||
        data.message ||
        "No output";
      setConsoleOutput(output);
    } catch (error) {
      console.error("Error running code:", error);
      setConsoleOutput(
        `Error: Could not connect to the judge server. ${error.message}`
      );
    }
  };

  //------------------ Resizable Console ------------------
  const handleResize = (e) => {
    const newHeight = window.innerHeight - e.clientY;
    if (newHeight >= 100 && newHeight <= 500) {
      setConsoleHeight(newHeight);
    }
  };

  //------------------ Render ------------------
  const fileTree = buildFileTree(droppedItems);

  if (!isProjectLoaded) {
    return (
      <div className="initial-state-container">
        <div className="center-content">
          <h3 className="editor-welcome-text">
            Welcome to your collaborative workspace!
          </h3>
          <p className="editor-hint">
            {/* --- FIX: Clarified text --- */}
            To get started, drag & drop a project folder.
            <br />
            (Or wait for the host to load one)
          </p>
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
          <h2>
            Room: <span className="room-name">{roomId}</span>
          </h2>
        </div>
        <nav className="editor-nav">
          <button
            className="nav-button download-button"
            onClick={handleDownloadProject}
          >
            Download Project
          </button>
          <button
            className="nav-button leave-room-button"
            onClick={handleLeaveRoom}
          >
            Leave Room
          </button>
        </nav>
      </header>

      <div className="editor-main-content">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h3>Project Explorer</h3>
          </div>
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
              {activeFilePath
                ? `Editing: ${activeFilePath}`
                : "Select a file"}
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
            <button onClick={handleRun} className="run-button">
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
            style={{ height: `${consoleHeight}px` }}
            onMouseDown={(e) => {
              const onMouseMove = (moveEvent) => handleResize(moveEvent);
              const onMouseUp = () =>
                document.removeEventListener("mousemove", onMouseMove);
              document.addEventListener("mousemove", onMouseMove);
              document.addEventListener("mouseup", onMouseUp, { once: true });
            }}
          >
            <pre>
              <strong>Console Output</strong>
              {consoleOutput ||
                "> Build successful!\n> Ready for collaboration."}
            </pre>
          </div>
        </main>
      </div>
    </div>
  );
};

export default EditorPage;
