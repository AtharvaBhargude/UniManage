import React, { useState, useEffect } from 'react';
import { ApiService } from '../services/api.js';
import { 
  Menu, LogOut, Sun, Moon, Bug 
} from 'lucide-react';

export const Layout = ({ children, user, onLogout, title, sidebarItems = [], activeSidebarItem, onSidebarItemClick }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportForm, setReportForm] = useState({ glitch: '', suggestion: '' });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const submitReport = async () => {
    if (!reportForm.glitch.trim()) return alert('Please describe the glitch.');
    await ApiService.addReport({
      id: `rep${Date.now()}`,
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      department: user.department || '',
      glitch: reportForm.glitch.trim(),
      suggestion: reportForm.suggestion.trim(),
      createdAt: new Date().toISOString()
    });
    setReportForm({ glitch: '', suggestion: '' });
    setShowReportModal(false);
    alert('Report submitted.');
  };

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
            {user.role !== 'DEVELOPER' && (
              <button
                onClick={() => setShowReportModal(true)}
                className="footer-btn"
              >
                <Bug size={18} />
                Report Issue
              </button>
            )}
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
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-lg p-5">
            <h3 className="font-bold text-lg mb-3 dark:text-white">Report App Issue</h3>
            <div className="space-y-3">
              <div>
                <label className="ui-label" htmlFor="report_glitch">Glitch / Bug</label>
                <textarea
                  id="report_glitch"
                  name="report_glitch"
                  className="ui-input"
                  rows={4}
                  value={reportForm.glitch}
                  onChange={(e) => setReportForm(prev => ({ ...prev, glitch: e.target.value }))}
                  placeholder="Describe what happened..."
                />
              </div>
              <div>
                <label className="ui-label" htmlFor="report_suggestion">Feedback / Improvement Suggestion</label>
                <textarea
                  id="report_suggestion"
                  name="report_suggestion"
                  className="ui-input"
                  rows={3}
                  value={reportForm.suggestion}
                  onChange={(e) => setReportForm(prev => ({ ...prev, suggestion: e.target.value }))}
                  placeholder="How can this be improved?"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button className="footer-btn" onClick={() => setShowReportModal(false)}>Cancel</button>
                <button className="footer-btn" onClick={submitReport}>Submit</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
