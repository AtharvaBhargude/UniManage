import React, { useState, useEffect } from 'react';
import { AuthPage } from './pages/AuthPage.jsx';
import { AdminDashboard } from './pages/AdminDashboard.jsx';
import { TeacherDashboard } from './pages/TeacherDashboard.jsx';
import { StudentDashboard } from './pages/StudentDashboard.jsx';
import { DeveloperDashboard } from './pages/DeveloperDashboard.jsx';

export default function App() {
  const [user, setUser] = useState(null);

  // Load user from localStorage on app mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (err) {
        console.error('Failed to parse saved user:', err);
        localStorage.removeItem('user');
      }
    }
  }, []);
  
  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  if (!user) {
    return <AuthPage onLogin={handleLogin} />;
  }

  return (
    <>
      {user.role === 'ADMIN' && <AdminDashboard user={user} onLogout={handleLogout} />}
      {user.role === 'TEACHER' && <TeacherDashboard user={user} onLogout={handleLogout} />}
      {user.role === 'STUDENT' && (
        <StudentDashboard user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
      )}
      {user.role === 'DEVELOPER' && <DeveloperDashboard user={user} onLogout={handleLogout} />}
    </>
  );
}
