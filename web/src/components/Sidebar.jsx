import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const Sidebar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const path = location.pathname;

    return (
        <aside className="sidebar">
            <div className="logo-area">
                <span className="logo-icon">🐍</span>
                <span className="logo-text">SNAKE XENZIA</span>
            </div>
            <nav className="nav-menu">
                <div className={`nav-item ${path === '/' ? 'active' : ''}`} onClick={() => navigate('/')}>
                    <span className="icon">🎮</span>
                    <span>Snake Party</span>
                </div>
                <div className={`nav-item ${path === '/multiplayer' ? 'active' : ''}`} onClick={() => navigate('/multiplayer')}>
                    <span className="icon">⚔️</span>
                    <span>Multiplayer</span>
                </div>
                <div className={`nav-item ${path === '/tournament' ? 'active' : ''}`} onClick={() => navigate('/tournament')}>
                    <span className="icon">🏆</span>
                    <span>Tournament</span>
                </div>
            </nav>
        </aside>
    );
};

export default Sidebar;
