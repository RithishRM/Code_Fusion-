import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import './App.css';
import EditorPage from './pages/EditorPage';
import DragDropZone from './components/DragDropZone';

function LandingPage() {
    const [roomCode, setRoomCode] = useState('');
    const navigate = useNavigate();

    const handleCreateRoom = () => {
        const newRoomId = `fusion-${Math.random().toString(36).substring(2, 9)}`;
        navigate(`/room/${newRoomId}`);
    };

    const handleJoinRoom = (e) => {
        e.preventDefault();
        if (roomCode.trim()) {
            navigate(`/room/${roomCode.trim()}`);
        } else {
            alert('Please enter a room code to join.');
        }
    };

    return (
        <div className="landing-page">
            <header className="landing-header">
                <h1>Code Fusion</h1>
                <p className="tagline">Real-time Collaborative Code Editor</p>
            </header>

            <main className="landing-main">
                <section className="action-section">
                    <h2>Start Collaborating!</h2>
                    <button className="main-button" onClick={handleCreateRoom}>
                        Create New Room
                    </button>
                    <div className="or-divider">OR</div>
                    <form className="join-room-form" onSubmit={handleJoinRoom}>
                        <input
                            type="text"
                            placeholder="Enter Room Code"
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value)}
                            className="room-input"
                            aria-label="Room Code"
                        />
                        <button type="submit" className="main-button join-button">
                            Join Room
                        </button>
                    </form>
                </section>

                <section className="description-section">
                    <p>
                        Code Fusion allows you to instantly collaborate on code with friends or colleagues.
                        Simply create a new room or join an existing one using a unique code,
                        and start coding together in real-time.
                    </p>
                    <ul>
                        <li>✨ Instant Sync</li>
                        <li>👥 Real-time Presence</li>
                        <li>🚀 Easy Sharing</li>
                    </ul>
                </section>
            </main>

            <footer className="landing-footer">
                &copy; 2025 Code Fusion. All rights reserved.
            </footer>
        </div>
    );
}

function App() {
    return (
        <div className="app-container-wrapper">
            <Router>
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/room/:roomId" element={<EditorPage />} />
                </Routes>
            </Router>

            <div className="background-lines-container">
                {Array.from({ length: 30 }).map((_, i) => (
                    <div
                        key={i}
                        className="background-line"
                        style={{
                            top: `${Math.random() * 100}vh`,
                            left: `${Math.random() * 100}vw`,
                            animationDelay: `${Math.random() * 15}s`,
                            animationDuration: `${20 + Math.random() * 15}s`,
                            transform: `scale(${0.3 + Math.random() * 0.7}) rotate(${Math.random() * 360}deg)`,
                            opacity: `${0.05 + Math.random() * 0.15}`
                        }}
                    ></div>
                ))}
            </div>
        </div>
    );
}

export default App;
