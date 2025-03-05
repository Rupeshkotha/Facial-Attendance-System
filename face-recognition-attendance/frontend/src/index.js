import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Set base URL for axios
axios.defaults.baseURL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// Configure default headers
axios.defaults.headers.common['Content-Type'] = 'application/json';
axios.defaults.headers.common['Accept'] = 'application/json';

// Function to update authorization header
export const updateAuthHeader = (token = null) => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('token', token);
  } else {
    delete axios.defaults.headers.common['Authorization'];
    localStorage.removeItem('token');
    localStorage.removeItem('user');  // Clear user data as well
  }
};

// Check for existing token on app load and verify it
const token = localStorage.getItem('token');
if (token) {
  // Attempt to verify token with backend profile endpoint
  axios.get('/api/auth/profile', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(response => {
    // Token is valid, keep it
    updateAuthHeader(token);
  })
  .catch(error => {
    // Token is invalid, clear it
    updateAuthHeader();
  });
}

// Add interceptor for handling authentication errors and network issues
axios.interceptors.response.use(
  response => response,
  error => {
    // Prevent multiple error messages
    if (error.config && error.config.__alreadyHandled) {
      return Promise.reject(error);
    }
    error.config.__alreadyHandled = true;

    // Clear any existing toasts
    toast.dismiss();

    // Network error or no response
    if (!error.response) {
      toast.error('Network error. Please check your connection.', {
        position: "bottom-right",
        autoClose: 3000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: false,
        theme: "colored"
      });
      return Promise.reject({
        message: 'Network error. Please check your connection.',
        type: 'network'
      });
    }

    // Consistent toast configuration
    const toastConfig = {
      position: "bottom-right",
      autoClose: 3000,
      hideProgressBar: true,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: false,
      theme: "colored"
    };

    // Handle specific HTTP status codes
    switch (error.response.status) {
      case 401:  // Unauthorized
        toast.error('Authentication failed. Please log in again.', toastConfig);
        updateAuthHeader();  // Clear token and user data
        window.location.href = '/login';
        break;
      
      case 403:  // Forbidden
        toast.error('You do not have permission to access this resource.', toastConfig);
        return Promise.reject({
          message: 'You do not have permission to access this resource.',
          type: 'forbidden'
        });
      
      case 404:  // Not Found
        toast.error('The requested resource could not be found.', toastConfig);
        return Promise.reject({
          message: 'The requested resource could not be found.',
          type: 'not_found'
        });
      
      case 500:  // Internal Server Error
        toast.error('An unexpected server error occurred. Please try again later.', toastConfig);
        return Promise.reject({
          message: 'An unexpected server error occurred. Please try again later.',
          type: 'server_error'
        });
      
      default:
        // For any other error status
        const errorMessage = error.response.data.error || 'An unexpected error occurred';
        toast.error(errorMessage, toastConfig);
        return Promise.reject({
          message: errorMessage,
          type: 'unknown'
        });
    }
  }
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();