import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';  
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';
import Navbar from './components/NavBar';
import CameraInterface from './components/CameraInterface';
import RegisterFace from './components/RegisterFace';
import AuthPage from './components/AuthPage';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('camera');
  const [recognizedFaces, setRecognizedFaces] = useState([]);

  // Check authentication on component mount
  useEffect(() => {
    // Check if token exists in localStorage
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      try {
        // Set default Authorization header
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Parse and set user
        const parsedUser = JSON.parse(storedUser);
        setIsAuthenticated(true);
        setUser(parsedUser);
      } catch (error) {
        // Clear invalid token and user data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
        setUser(null);

        // Use toast for error
        toast.error('Session expired. Please log in again.', {
          position: "bottom-right",
          autoClose: 3000,
          theme: "colored"
        });
      }
    }
  }, []);

  const handleLogin = (userData, token) => {
    // Store token and user data in localStorage
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData)); 
    localStorage.setItem('user_email', userData.email);

    // Set Authorization header for axios
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    // Update state
    setIsAuthenticated(true);
    setUser(userData);
    setCurrentPage('camera');

    // Success toast
    toast.success(`Welcome, ${userData.name || 'User'}!`, {
      position: "bottom-right",
      autoClose: 3000,
      theme: "colored"
    });
  };

  const handleLogout = () => {
    // Remove token and user data from localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Remove Authorization header
    delete axios.defaults.headers.common['Authorization'];
    
    // Reset authentication state
    setIsAuthenticated(false);
    setUser(null);
    setRecognizedFaces([]);

    // Logout toast
    toast.info('You have been logged out.', {
      position: "bottom-right",
      autoClose: 3000,
      theme: "colored"
    });
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleRecognizedFace = (face) => {
    console.log('Handling Recognized Face:', face);
    setRecognizedFaces(prev => {
      // Prevent duplicate entries for the same name on the same day
      const exists = prev.some(f => 
        f.name === face.name && 
        new Date(f.timestamp).toDateString() === new Date().toDateString()
      );
      
      if (!exists) {
        const newFace = {
          ...face,
          timestamp: face.timestamp || new Date().toLocaleString()
        };
        return [...prev, newFace];
      }
      return prev;
    });
  };

  const clearRecognizedFaces = () => {
    setRecognizedFaces([]);
  };

  // Error handling function for components
  const handleComponentError = (errorMessage) => {
    toast.error(errorMessage, {
      position: "bottom-right",
      autoClose: 3000,
      theme: "colored"
    });
  };

  return (
    <Router>
      {isAuthenticated && (
        <Navbar 
          onPageChange={handlePageChange} 
          onLogout={handleLogout} 
          user={user} 
        />
      )}
      <ToastContainer />
      <Routes>
        <Route 
          path="/login" 
          element={
            isAuthenticated ? <Navigate to="/" replace /> : 
            <AuthPage onLogin={handleLogin} />
          } 
        />
        <Route 
          path="/" 
          element={
            isAuthenticated ? (
              <>
                {currentPage === 'camera' && (
                  <CameraInterface 
                    onRecognizedFace={handleRecognizedFace} 
                    onError={handleComponentError}
                  />
                )}
                
                {currentPage === 'register' && (
                  <RegisterFace onError={handleComponentError} />
                )}
              </>
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
        <Route 
          path="/register" 
          element={
            isAuthenticated ? <RegisterFace onError={handleComponentError} /> : 
            <Navigate to="/login" replace />
          }
        />
        <Route 
          path="/camera" 
          element={
            isAuthenticated ? <CameraInterface onRecognizedFace={handleRecognizedFace} onError={handleComponentError} /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="*" 
          element={
            isAuthenticated ? <Navigate to="/" replace /> : 
            <Navigate to="/login" replace />
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;