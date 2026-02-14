import React, { useState, useEffect } from 'react';
import { 
  Menu, LogOut, Sun, Moon 
} from 'lucide-react';

export const Layout = ({ children, user, onLogout, title, sidebarItems = [], activeSidebarItem, onSidebarItemClick }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Keep sidebar closed on mobile initially
  return (
    <div className="layout-container">
      {isSidebarOpen && (
        <div 
          className="layout-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`layout-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-content">
          <div className="sidebar-header">
            <h1 className="brand-title">UniManage</h1>
            <p className="brand-subtitle">Academic Project Portal</p>
          </div>

          <div className="user-profile">
            <div className="user-avatar">
              {user.username.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="user-name">{user.fullName}</p>
              <p className="user-role">{user.role.toLowerCase()}</p>
            </div>
          </div>

          <div className="sidebar-nav">
             {sidebarItems.map(item => (
               <button
                 key={item.id}
                 className={`sidebar-nav-item ${activeSidebarItem === item.id ? 'active' : ''}`}
                 onClick={() => {
                   onSidebarItemClick?.(item.id);
                   setSidebarOpen(false);
                 }}
               >
                 {item.label}
               </button>
             ))}
          </div>

          <div className="sidebar-footer">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="footer-btn"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              {isDarkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
            <button
              onClick={onLogout}
              className="footer-btn logout"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="main-wrapper">
        <header className="main-header">
          <div className="header-content">
            <div className="header-left">
              <button 
                onClick={() => setSidebarOpen(true)}
                className="menu-btn"
              >
                <Menu size={20} />
              </button>
              <h2 className="page-title">{title}</h2>
            </div>
          </div>
        </header>

        <main className="main-content">
          <div className="content-container animate-fadeIn">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
