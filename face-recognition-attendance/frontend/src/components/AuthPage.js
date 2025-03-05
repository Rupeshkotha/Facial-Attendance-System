import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import { Camera } from 'react-feather';
import './AuthPage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function AuthPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    // Comprehensive prevention of default form submission
    try {
      if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
      if (e && typeof e.stopPropagation === 'function') {
        e.stopPropagation();
      }
    } catch (preventionError) {
      console.error('Form submission prevention error:', preventionError);
    }
    
    // Validate inputs
    if (!formData.email || !formData.password) {
      toast.error('Please fill in all required fields', {
        position: "bottom-right",
        autoClose: 3000,
        theme: "colored"
      });
      return false;
    }

    // Disable submit button during submission
    setIsLoading(true);

    try {
      const endpoint = isLogin 
        ? `${BACKEND_URL}/api/auth/login` 
        : `${BACKEND_URL}/api/auth/register`;
      
      // Simple request logging
      console.log(`Attempting ${isLogin ? 'Login' : 'Registration'} for: ${formData.email}`);

      const response = await axios.post(endpoint, formData, {
        // Add timeout to prevent hanging
        timeout: 10000,
        // Prevent automatic error handling
        validateStatus: function (status) {
          return status >= 200 && status < 500;
        }
      });
      
      // Simple response logging
      console.log(`Authentication Response: ${response.status}`);

      // Handle different response scenarios
      if (response.status >= 200 && response.status < 300) {
        if (isLogin) {
          // Prepare user data
          const userData = {
            name: response.data.user_name,
            email: response.data.user_email
          };

          // Update axios default header with access token
          axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;

          // Store user info and token
          localStorage.setItem('token', response.data.access_token);
          
          // Trigger login callback
          onLogin(userData, response.data.access_token);
          
          // Navigate to camera page
          navigate('/');
        } else {
          // Registration successful
          toast.success('Registration successful! Please login.', {
            position: "bottom-right",
            autoClose: 3000,
            theme: "colored"
          });
          
          setIsLogin(true);
          
          // Reset form data after successful registration
          setFormData({
            name: '',
            email: '',
            password: ''
          });
        }
      } else {
        // Handle non-successful responses
        throw new Error(response.data.error || 'Unexpected response');
      }
    } catch (error) {
      // Simplified error logging
      console.error('Authentication Error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      // Detailed error handling
      const errorMessage = 
        error.response?.data?.error || 
        error.message || 
        'An unexpected error occurred';
      
      // Special handling for authentication errors
      if (error.response && error.response.status === 401) {
        // Handle different authentication scenarios
        const errorStatus = error.response.data.status;

        // Specific error handling for login
        if (errorStatus === 'unregistered_email') {
          toast.error(errorMessage, {
            position: "bottom-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            theme: "colored"
          });
          
          // Automatically switch to registration form
          setIsLogin(false);
        } else {
          // Generic authentication error
          toast.error(errorMessage, {
            position: "bottom-right",
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "colored"
          });
        }
      } 
      // Handle face recognition specific errors
      else if (error.response && error.response.status === 404) {
        const errorStatus = error.response.data.status;
        
        // Specific error scenarios for face recognition
        switch(errorStatus) {
          case 'no_students_registered':
            toast.error('Please register students before recognition', {
              position: "bottom-right",
              autoClose: 3000,
              theme: "colored"
            });
            break;
          case 'no_face_encodings':
            toast.error('No student faces registered. Please add student faces', {
              position: "bottom-right",
              autoClose: 3000,
              theme: "colored"
            });
            break;
          case 'face_not_recognized':
            toast.error('Face not recognized. Please register this student', {
              position: "bottom-right",
              autoClose: 3000,
              theme: "colored"
            });
            break;
          default:
            // Generic 404 error
            toast.error(errorMessage, {
              position: "bottom-right",
              autoClose: 3000,
              theme: "colored"
            });
        }
      }
      // Handle other types of errors
      else {
        toast.error(errorMessage, {
          position: "bottom-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored"
        });
      }

      // Ensure no further propagation
      return false;
    } finally {
      // Always ensure loading state is reset
      setIsLoading(false);
    }

    // Ensure no form submission
    return false;
  };

  return (
    <div className="auth-container">
      <div className="auth-wrapper">
        <div className="auth-image">
          <div className="auth-brand">
            <Camera size={64} className="auth-brand-icon" />
            <div className="auth-brand-text">
              <h1>Attendance</h1>
              <p>Smart Face Recognition System</p>
            </div>
          </div>
        </div>
        <form 
          className="auth-form" 
          onSubmit={handleSubmit}
        >
          <h2 className="auth-title">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          
          {!isLogin && (
            <input
              type="text"
              name="name"
              placeholder="Full Name"
              className="auth-input"
              value={formData.name}
              onChange={handleChange}
              required
              disabled={isLoading}
            />
          )}
          
          <input
            type="email"
            name="email"
            placeholder="Email Address"
            className="auth-input"
            value={formData.email}
            onChange={handleChange}
            required
            disabled={isLoading}
          />
          
          <input
            type="password"
            name="password"
            placeholder="Password"
            className="auth-input"
            value={formData.password}
            onChange={handleChange}
            required
            minLength="8"
            disabled={isLoading}
          />
          
          <button 
            type="submit" 
            className="auth-button"
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
          </button>
          
          <div className="auth-switch">
            {isLogin 
              ? "Don't have an account? " 
              : "Already have an account? "}
            <span 
              onClick={() => {
                if (!isLoading) {
                  setIsLogin(!isLogin)
                }
              }}
              style={{
                color: '#667eea', 
                cursor: isLoading ? 'default' : 'pointer',
                opacity: isLoading ? 0.5 : 1
              }}
            >
              {isLogin ? 'Register' : 'Login'}
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AuthPage;