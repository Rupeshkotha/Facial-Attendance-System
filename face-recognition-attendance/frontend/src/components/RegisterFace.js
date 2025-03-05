import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Camera, User, Hash, Upload, Check, X } from 'react-feather';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function RegisterFace({ onError }) {
  const webcamRef = useRef(null);
  const [name, setName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  // Camera access check
  useEffect(() => {
    const checkCameraAccess = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        setCameraError(null);
      } catch (error) {
        setCameraError('Camera access denied. Please check your browser settings.');
      }
    };

    checkCameraAccess();
  }, []);

  const captureImage = useCallback(() => {
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      setCapturedImage(imageSrc);
    } catch (error) {
      toast.error('Failed to capture image. Please try again.', {
        position: "bottom-right",
        autoClose: 3000,
        theme: "colored"
      });
    }
  }, []);

  const clearCapture = () => {
    setCapturedImage(null);
  };

  const validateInputs = () => {
    if (!name.trim()) {
      throw new Error('Name is required');
    }
    if (!rollNumber.trim()) {
      throw new Error('Roll Number is required');
    }
    if (!capturedImage) {
      throw new Error('Please capture an image first');
    }
    
    if (!/^[a-zA-Z\s]+$/.test(name)) {
      throw new Error('Name should contain only letters');
    }
    
    if (!/^\d+$/.test(rollNumber)) {
      throw new Error('Roll Number should contain only numbers');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      validateInputs();
      setIsSubmitting(true);

      const token = localStorage.getItem('access_token');
      if (!token) {
        toast.error('Authentication token not found. Please log in again.', {
          position: "bottom-right",
          autoClose: 3000,
          theme: "colored"
        });
        return;
      }

      const blob = await (await fetch(capturedImage)).blob();
      
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('roll_number', rollNumber.trim());
      formData.append('image', blob, 'registration.jpg');

      const response = await axios.post(`${BACKEND_URL}/register`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });

      toast.success('Registration Successful', {
        position: "bottom-right",
        autoClose: 3000,
        theme: "colored"
      });
      
      // Reset form
      setName('');
      setRollNumber('');
      setCapturedImage(null);
    } catch (error) {
      console.error("Registration error", error);
      
      const errorMessage = error.response 
        ? error.response.data.error 
        : error.message || 'Registration Failed';
      
      toast.error(errorMessage, {
        position: "bottom-right",
        autoClose: 5000,
        theme: "colored"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            <User size={24} style={styles.titleIcon} />
            Face Registration
          </h2>
          <p style={styles.subtitle}>
            Capture your face for attendance tracking
          </p>
        </div>

        <div style={styles.webcamSection}>
          {cameraError ? (
            <div style={styles.cameraErrorContainer}>
              <X size={48} color="#e74c3c" />
              <p style={styles.cameraErrorText}>{cameraError}</p>
            </div>
          ) : (
            <div style={styles.webcamContainer}>
              {!capturedImage ? (
                <>
                  <Webcam
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ 
                      width: 640, 
                      height: 480,
                      facingMode: "user"
                    }}
                    style={styles.webcam}
                  />
                  <button 
                    onClick={captureImage} 
                    style={styles.captureButton}
                  >
                    <Camera size={20} style={styles.buttonIcon} />
                    Capture Image
                  </button>
                </>
              ) : (
                <div style={styles.capturedImageContainer}>
                  <img 
                    src={capturedImage} 
                    alt="Captured" 
                    style={styles.capturedImage}
                  />
                  <div style={styles.capturedImageOverlay}>
                    <button 
                      onClick={clearCapture} 
                      style={styles.recaptureButton}
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <div style={styles.inputIcon}>
              <User size={20} />
            </div>
            <input 
              type="text" 
              placeholder="Full Name" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.input}
              required 
            />
          </div>
          
          <div style={styles.inputGroup}>
            <div style={styles.inputIcon}>
              <Hash size={20} />
            </div>
            <input 
              type="text" 
              placeholder="Roll Number" 
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              style={styles.input}
              required 
            />
          </div>
          
          <button 
            type="submit" 
            style={{
              ...styles.submitButton,
              ...(isSubmitting ? styles.submitButtonDisabled : {})
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div style={styles.spinner}></div>
                Registering...
              </>
            ) : (
              <>
                <Upload size={20} style={styles.buttonIcon} />
                Register
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 'calc(100vh - 80px)',
    background: 'linear-gradient(135deg, #2c3e50, #34495e)',
    padding: '20px',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '20px',
    boxShadow: '0 15px 35px rgba(0,0,0,0.1)',
    padding: '40px',
    width: '100%',
    maxWidth: '600px',
    transition: 'all 0.3s ease',
    ':hover': {
      transform: 'translateY(-10px)',
      boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
    },
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#2c3e50',
    margin: 0,
    fontSize: '24px',
  },
  titleIcon: {
    marginRight: '10px',
    color: '#3498db',
  },
  subtitle: {
    color: '#7f8c8d',
    margin: '10px 0 0',
    fontSize: '16px',
  },
  webcamSection: {
    marginBottom: '30px',
  },
  webcamContainer: {
    position: 'relative',
    width: '100%',
    height: '400px',
    backgroundColor: '#ecf0f1',
    borderRadius: '15px',
    overflow: 'hidden',
    boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
  },
  webcam: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  captureButton: {
    position: 'absolute',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    padding: '12px 24px',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '50px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    ':hover': {
      backgroundColor: '#2980b9',
      transform: 'translateX(-50%) scale(1.05)',
    },
  },
  buttonIcon: {
    marginRight: '10px',
  },
  capturedImageContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  capturedImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  capturedImageOverlay: {
    position: 'absolute',
    top: '10px',
    right: '10px',
  },
  recaptureButton: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    border: 'none',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    ':hover': {
      backgroundColor: 'rgba(255,255,255,1)',
      transform: 'rotate(90deg)',
    },
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '15px',
    color: '#7f8c8d',
    zIndex: 10,
  },
  input: {
    width: '100%',
    padding: '15px 15px 15px 50px',
    border: '1px solid #bdc3c7',
    borderRadius: '10px',
    fontSize: '16px',
    transition: 'all 0.3s ease',
    ':focus': {
      borderColor: '#3498db',
      boxShadow: '0 0 0 2px rgba(52, 152, 219, 0.2)',
    },
  },
  submitButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '15px',
    backgroundColor: '#2ecc71',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '18px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    ':hover': {
      backgroundColor: '#27ae60',
      transform: 'translateY(-2px)',
    },
  },
  submitButtonDisabled: {
    backgroundColor: '#95a5a6',
    cursor: 'not-allowed',
  },
  spinner: {
    borderRadius: '50%',
    width: '20px',
    height: '20px',
    border: '3px solid rgba(255,255,255,0.3)',
    borderTopColor: 'white',
    animation: 'spin 1s linear infinite',
    marginRight: '10px',
  },
  cameraErrorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    textAlign: 'center',
    padding: '20px',
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
  },
  cameraErrorText: {
    color: '#e74c3c',
    marginTop: '15px',
  },
};

export default RegisterFace;