import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from '../utils/axiosConfig';
import { manageFaceRecognitionList } from '../utils/attendanceUtils';
import { Trash2, User, Clock, Calendar } from 'react-feather';
import { toast} from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function CameraInterface({ onRecognizedFace }) {
  const webcamRef = useRef(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [todaysFaces, setTodaysFaces] = useState([]);
  const [deletingRollNumber, setDeletingRollNumber] = useState(null);
  
  // Refs to track recognition state and prevent duplicate calls
  const lastRecognitionRef = useRef(0);
  const isRecognizingRef = useRef(false);

  // Centralized error message handler
  const handleRecognitionError = useCallback((errorStatus, errorMessage) => {
    // Clear any existing toasts
    toast.dismiss();

    // Determine toast type and message
    const toastConfig = {
      'no_students_registered': {
        message: "No students registered. Please add students first.",
        type: 'warning'
      },
      'no_face_encodings': {
        message: "No student faces registered. Please register student faces.",
        type: 'warning'
      },
      'face_not_recognized': {
        message: "Face not recognized. Please register this student.",
        type: 'warning'
      },
      'face_detection_failed': {
        message: "No face detected. Please ensure your face is clearly visible.",
        type: 'error'
      },
      'default': {
        message: errorMessage || 'Recognition failed',
        type: 'error'
      }
    };

    // Select appropriate toast configuration
    const config = toastConfig[errorStatus] || toastConfig['default'];

    // Show toast based on type
    switch(config.type) {
      case 'warning':
        toast.warn(config.message, {
          position: "bottom-right",
          autoClose: 3000,
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: false,
          theme: "colored"
        });
        break;
      case 'error':
      default:
        toast.error(config.message, {
          position: "bottom-right",
          autoClose: 3000,
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: false,
          theme: "colored"
        });
    }
  }, []);

  const captureAndRecognize = useCallback(async () => {
    // Prevent concurrent recognition attempts
    if (isRecognizingRef.current) return;

    const now = Date.now();
    // Prevent recognition too frequently (every 10 seconds)
    if (now - lastRecognitionRef.current < 10000) return;

    if (!webcamRef.current) return;
  
    try {
      // Set recognition flag
      isRecognizingRef.current = true;
      setIsRecognizing(true);

      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        handleRecognitionError('face_detection_failed', "Failed to capture image");
        return;
      }
  
      const blob = await (await fetch(imageSrc)).blob();
      const formData = new FormData();
      formData.append('image', blob, 'capture.jpg');
  
      // Get JWT token from local storage
      const token = localStorage.getItem('token');
      if (!token) {
        handleRecognitionError('default', "No authentication token found. Please log in again.");
        return;
      }
  
      const response = await axios.post(`${BACKEND_URL}/recognize`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        timeout: 10000 
      });

      // More robust response handling
      if (response.data && Array.isArray(response.data)) {
        // Handle multiple recognized faces
        response.data.forEach(recognitionData => {
          const recognizedFace = {
            name: recognitionData.name || 'Unknown',
            roll_number: recognitionData.roll_number || '',
            timestamp: new Date().toLocaleString(),
            confidence: recognitionData.confidence || 0,
            status: recognitionData.status || 'Unknown'
          };

          // Add to local storage and state
          manageFaceRecognitionList.addFace(recognizedFace);
          
          // Show toast notification
          toast.success(`Recognized: ${recognizedFace.name}`, {
            position: "bottom-right",
            autoClose: 3000,
            hideProgressBar: true,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: false,
            theme: "colored"
          });

          if (typeof onRecognizedFace === 'function') {
            onRecognizedFace(recognizedFace);
          }
        });

        // Update faces and last recognition
        setTodaysFaces(manageFaceRecognitionList.getTodaysFaces());
        lastRecognitionRef.current = now;
      }
    } catch (axiosError) {
      // Detailed error handling with toast
      if (axiosError.response) {
        const errorStatus = axiosError.response.data?.status;
        const errorMessage = axiosError.response.data?.error || 'Recognition failed';

        // Use centralized error handler
        handleRecognitionError(errorStatus, errorMessage);
      } else if (axiosError.request) {
        handleRecognitionError('default', 'No response from server. Check your connection.');
      } else {
        handleRecognitionError('default', 'Error setting up recognition request');
      }
    } finally {
      // Reset recognition flags
      isRecognizingRef.current = false;
      setIsRecognizing(false);
    }
  }, [onRecognizedFace, handleRecognitionError]);

  // Load today's faces on component mount
  useEffect(() => {
    setTodaysFaces(manageFaceRecognitionList.getTodaysFaces());
  }, []);

  const handleDeleteAttendance = async (rollNumber) => {
    try {
      console.log('Attempting to delete attendance for roll number:', rollNumber);
      
      const deleted = await manageFaceRecognitionList.deleteAttendance(rollNumber);
      
      console.log('Delete attempt result:', deleted);
      
      if (deleted) {
        // Refresh the list
        const updatedFaces = manageFaceRecognitionList.getTodaysFaces();
        setTodaysFaces(updatedFaces);
        
        // Success toast
        toast.success('Attendance deleted successfully', {
          position: "bottom-right",
          autoClose: 3000,
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: false,
          theme: "colored"
        });
      } else {
        // Show error toast with more context
        toast.error('Failed to delete attendance. Check console for details.', {
          position: "bottom-right",
          autoClose: 3000,
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: false,
          theme: "colored"
        });
      }
    } catch (error) {
      console.error('Complete Delete Attendance Error:', error);
      toast.error('An unexpected error occurred during deletion', {
        position: "bottom-right",
        autoClose: 3000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: false,
        theme: "colored"
      });
    } finally {
      setDeletingRollNumber(null);
    }
  };

  // Automatic recognition every 5 seconds
  useEffect(() => {
    const interval = setInterval(captureAndRecognize, 5000);
    return () => clearInterval(interval);
  }, [captureAndRecognize]);

  return (
    <div style={styles.container}>
      <div style={styles.contentWrapper}>
        <div style={styles.webcamSection}>
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
          
          {isRecognizing && (
            <div style={styles.recognizingOverlay}>
              <p>Recognizing...</p>
            </div>
          )}
        </div>

        <div style={styles.attendanceSection}>
          <div style={styles.attendanceHeader}>
            <h3 style={styles.sectionTitle}>
              <Calendar size={20} style={styles.titleIcon} />
              Today's Attendance
            </h3>
            {todaysFaces.length > 0 && (
              <span style={styles.attendanceCount}>
                {todaysFaces.length} Students
              </span>
            )}
          </div>

          {todaysFaces.length === 0 ? (
            <div style={styles.emptyState}>
              <User size={48} style={styles.emptyStateIcon} />
              <p>No attendance records today</p>
            </div>
          ) : (
            <div style={styles.attendanceList}>
              {todaysFaces.map((face) => (
                <div 
                  key={face.roll_number} 
                  style={{
                    ...styles.attendanceCard,
                    ...(deletingRollNumber === face.roll_number ? styles.deletingCard : {})
                  }}
                >
                  <div style={styles.studentInfo}>
                    <div style={styles.studentDetails}>
                      <span style={styles.studentName}>
                        <User size={16} style={styles.cardIcon} />
                        {face.name}
                      </span>
                      <span style={styles.studentRoll}>
                        Roll: {face.roll_number}
                      </span>
                    </div>
                    <div style={styles.timeInfo}>
                      <span style={styles.attendanceTime}>
                        <Clock size={16} style={styles.cardIcon} />
                        {new Date(face.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  
                  <button 
                    style={{
                      ...styles.deleteBtn,
                      ...(deletingRollNumber === face.roll_number ? styles.deletingBtn : {})
                    }}
                    onClick={() => handleDeleteAttendance(face.roll_number)}
                    disabled={deletingRollNumber === face.roll_number}
                  >
                    {deletingRollNumber === face.roll_number ? (
                      <span>Deleting...</span>
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    padding: '20px',
    backgroundColor: 'linear-gradient(135deg, #2c3e50, #34495e)',
  },
  contentWrapper: {
    display: 'flex',
    gap: '20px',
    maxWidth: '1200px',
    width: '100%',
  },
  webcamSection: {
    position: 'relative',
    width: '640px',
    height: '480px',
    backgroundColor: '#e0e0e0',
    borderRadius: '10px',
    overflow: 'hidden',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  },
  webcam: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  recognizingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    color: 'white',
    fontSize: '1.2rem',
  },
  attendanceSection: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: '10px',
    padding: '20px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  },
  attendanceHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
    borderBottom: '1px solid #e0e0e0',
    paddingBottom: '10px',
  },
  sectionTitle: {
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#333',
  },
  titleIcon: {
    color: '#4CAF50',
  },
  attendanceCount: {
    backgroundColor: '#4CAF50',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '20px',
    fontSize: '0.8rem',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '300px',
    color: '#888',
    textAlign: 'center',
  },
  emptyStateIcon: {
    color: '#4CAF50',
    marginBottom: '15px',
  },
  attendanceList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  attendanceCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    padding: '15px',
    transition: 'all 0.3s ease',
  },
  deletingCard: {
    opacity: 0.5,
    backgroundColor: '#ffebee',
  },
  studentInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  studentDetails: {
    display: 'flex',
    flexDirection: 'column',
  },
  studentName: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 'bold',
    color: '#333',
  },
  studentRoll: {
    color: '#666',
    fontSize: '0.9rem',
    marginTop: '5px',
  },
  timeInfo: {
    display: 'flex',
    alignItems: 'center',
    marginRight: '14px',
  },
  attendanceTime: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#4CAF50',
    fontSize: '0.9rem',
  },
  cardIcon: {
    color: '#4CAF50',
  },
  deleteBtn: {
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    borderRadius: '18px',
    padding: '8px',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
  },
  deletingBtn: {
    backgroundColor: '#d32f2f',
    cursor: 'not-allowed',
  }
};

export default CameraInterface;