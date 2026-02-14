import React, { useState } from 'react';
import { Button, Input, Select, Card } from '../components/UI.jsx';
import { ApiService } from '../services/api.js';
import { DEPARTMENTS, DIVISIONS } from '../constants.js';
import logo from '../components/latestlogopccoe.png';

export const AuthPage = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [require2FA, setRequire2FA] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    secondPassword: '', // For 2FA
    fullName: '',
    department: DEPARTMENTS[0],
    role: 'STUDENT',
    division: DIVISIONS[0],
    prn: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        const payload = { 
          username: formData.username, 
          password: formData.password 
        };
        if (require2FA) {
          payload.secondPassword = formData.secondPassword;
        }

        const user = await ApiService.login(payload);
        onLogin(user);
      } else {
        if (!formData.username || !formData.password || !formData.fullName) {
          throw new Error('All fields are required');
        }
        
        const newUser = {
          id: `u${Date.now()}`,
          username: formData.username,
          password: formData.password,
          role: formData.role,
          department: formData.department,
          fullName: formData.fullName,
          division: formData.role === 'STUDENT' ? formData.division : undefined,
          prn: formData.role === 'STUDENT' ? formData.prn : undefined
        };
        
        const registeredUser = await ApiService.register(newUser);
        onLogin(registeredUser);
      }
    } catch (err) {
      if (err.data && err.data.require2FA) {
        setRequire2FA(true);
        setError('Please enter your second security password.');
      } else {
        setError(err.message || 'Authentication failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-bubbles" aria-hidden="true">
        <span className="bubble"></span>
        <span className="bubble"></span>
        <span className="bubble"></span>
        <span className="bubble"></span>
        <span className="bubble"></span>
        <span className="bubble"></span>
        <span className="bubble"></span>
        <span className="bubble"></span>
      </div>
      <Card className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <img src={logo} alt="App Logo" className="logo-img" />
          </div>
          <h1 className="auth-title">UniManage</h1>
          <p className="auth-subtitle">
            {require2FA ? 'Security Verification' : 'Project Management System'}
          </p>
        </div>

        {!require2FA && (
          <div className="auth-tabs">
            <button 
              className={`auth-tab ${isLogin ? 'active' : ''}`}
              onClick={() => setIsLogin(true)}
            >
              Login
            </button>
            <button 
              className={`auth-tab ${!isLogin ? 'active' : ''}`}
              onClick={() => setIsLogin(false)}
            >
              Sign Up
            </button>
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {!require2FA ? (
            <>
              <Input 
                label="Username" 
                value={formData.username}
                onChange={e => setFormData({...formData, username: e.target.value})}
                required
              />
              <Input 
                label="Password" 
                type="password"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                required
              />

              {!isLogin && (
                <>
                  <Input 
                    label="Full Name" 
                    value={formData.fullName}
                    onChange={e => setFormData({...formData, fullName: e.target.value})}
                    required
                  />
                  <Select 
                    label="Role"
                    options={[
                      { value: 'STUDENT', label: 'Student' },
                      { value: 'TEACHER', label: 'Teacher' },
                      { value: 'ADMIN', label: 'Admin' },
                    ]}
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value})}
                  />
                  <Select 
                    label="Department"
                    options={DEPARTMENTS.map(d => ({ value: d, label: d }))}
                    value={formData.department}
                    onChange={e => setFormData({...formData, department: e.target.value})}
                  />
                  
                  {formData.role === 'STUDENT' && (
                    <>
                      <Select 
                        label="Division"
                        options={DIVISIONS.map(d => ({ value: d, label: d }))}
                        value={formData.division}
                        onChange={e => setFormData({...formData, division: e.target.value})}
                      />
                      <Input 
                        label="PRN" 
                        value={formData.prn}
                        onChange={e => setFormData({...formData, prn: e.target.value})}
                        required
                      />
                    </>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="animate-fadeIn">
              <Input 
                label="Security Code (Second Password)" 
                type="password"
                value={formData.secondPassword}
                onChange={e => setFormData({...formData, secondPassword: e.target.value})}
                required
                className="border-indigo-500 ring-2 ring-indigo-200"
                placeholder="Enter 2nd Step Password"
              />
              <p className="text-xs text-gray-500 mb-2 text-center">
                Developer Access Verification Required
              </p>
            </div>
          )}

          <Button type="submit" className="w-full mt-4" disabled={isLoading}>
            {isLoading ? 'Processing...' : (isLogin ? (require2FA ? 'Verify & Login' : 'Login') : 'Create Account')}
          </Button>
          
          {require2FA && (
            <button 
              type="button" 
              onClick={() => { setRequire2FA(false); setError(''); }}
              className="text-sm text-center text-gray-500 hover:text-gray-800 w-full mt-2"
            >
              Cancel Verification
            </button>
          )}
        </form>
      </Card>
    </div>
  );
};
