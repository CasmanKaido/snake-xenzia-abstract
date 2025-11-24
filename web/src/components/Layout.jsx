import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const Layout = () => {
    return (
        <div className="app-layout">
            <Sidebar />
            <div className="main-wrapper">
                <TopBar />
                <div className="content-area">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default Layout;
